import type { MaybeRefOrGetter } from 'vue'
import type { ListingDetail } from '~/composables/useListing'
import { OUTCOME_OPTIONS, type Outcome } from '~/constants/listing'

export const RECORD_OUTCOME = graphql(`
  mutation RecordOutcome($input: RecordOutcomeInput!) {
    recordOutcome(input: $input) {
      listing {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const UNDO_STATUS_CHANGE = graphql(`
  mutation UndoStatusChange($input: UndoStatusChangeInput!) {
    undoStatusChange(input: $input) {
      listing {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
        ... on DuplicateListingError {
          existingListingId
        }
      }
    }
  }
`)

type Listing = Pick<ListingDetail, 'id' | 'statusHistory'>
type Status = ListingDetail['status']

const isOutcome = (status: Status): status is Outcome =>
  OUTCOME_OPTIONS.some((o) => o.value === status)

// Undoes the newest status change. An outcome comes back exactly with recordOutcome (same status,
// date and note), so it undoes at once with an Undo toast. Applied and Interviewing can't be
// re-created that way (sent documents, the interview's automatic status), so they ask first.
export const useUndoStatusChange = (listing: MaybeRefOrGetter<Listing>, onChanged: () => void) => {
  const notify = useAppToast()
  const { run, loading } = useMutation(onChanged)

  // The entry just undone stays the newest until the listing refetches. A second click in that gap
  // would undo the step before it too (unconfirmed), so undo is off until the listing moves on.
  const undoneId = ref<number>()
  const current = computed(() => toValue(listing).statusHistory.at(-1))
  // Named like the card names it ("Declined by you"), not by the API's status.
  const name = computed(() => {
    const entry = current.value
    if (!entry || entry.status === 'SAVED' || entry.id === undoneId.value) return undefined
    return statusLabel(entry.status, toValue(listing).statusHistory.at(-2)?.status)
  })
  const label = computed(() => {
    if (!name.value) return undefined
    return current.value!.status === 'APPLIED' ? 'Undo application' : `Undo ${name.value}`
  })
  const confirmTitle = computed(() => (label.value ? `${label.value}?` : ''))
  const confirmDescription = computed(() =>
    current.value?.status === 'APPLIED'
      ? 'Sent documents will be marked as not sent.'
      : 'The application goes back to Applied.'
  )
  const confirmOpen = ref(false)

  const undo = async () => {
    const id = toValue(listing).id
    let blocked = false
    const ok = await run(async () => {
      const { undoStatusChange } = await gql(UNDO_STATUS_CHANGE, { input: { listingId: id } })
      const duplicate = undoStatusChange.errors?.find(
        (e) => e.__typename === 'DuplicateListingError'
      )
      if (!duplicate) return undoStatusChange.errors
      // useMutation's toast has no link, and the user needs the open listing that blocks the undo.
      blocked = true
      notify.error(duplicate.message, {
        action: { label: 'View open listing', to: `/listings/${duplicate.existingListingId}` }
      })
    })
    if (ok && !blocked) undoneId.value = current.value?.id
    return ok && !blocked
  }

  const redo = async (entry: { status: Outcome; occurredAt: string; note: string | null }) => {
    const ok = await run(async () => {
      const { recordOutcome } = await gql(RECORD_OUTCOME, {
        input: {
          listingId: toValue(listing).id,
          outcome: entry.status,
          occurredAt: entry.occurredAt,
          note: entry.note
        }
      })
      return recordOutcome.errors
    })
    if (ok) onChanged()
  }

  const request = async () => {
    const entry = current.value
    if (!entry || !name.value || loading.value) return
    const { status, occurredAt, note } = entry
    if (!isOutcome(status)) {
      confirmOpen.value = true
      return
    }
    const title = `${name.value} undone`
    if (!(await undo())) return
    onChanged()
    notify.undoable(title, () => redo({ status, occurredAt, note }))
  }

  const confirm = async () => {
    const ok = await undo()
    confirmOpen.value = false
    if (ok) onChanged()
  }

  return { label, request, confirm, confirmOpen, confirmTitle, confirmDescription, loading }
}
