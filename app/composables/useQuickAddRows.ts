import type { FormError } from '@nuxt/ui'
import { print } from '@0no-co/graphql.web'
import type { ResultOf } from 'gql.tada'
import type { ListingFields } from '~/composables/useListingForm'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const RESULT_FRAGMENT = graphql(
  `
    fragment R on CreateListingPayload {
      listing {
        ...ListingCompareFields
      }
      previousAttempts {
        id
        title
        status
      }
      possibleDuplicates {
        ...ListingCompareFields
        archivedAt
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
  `,
  [LISTING_COMPARE_FIELDS]
)

type CreateListingResult = ResultOf<typeof RESULT_FRAGMENT>
type PossibleDuplicate = NonNullable<CreateListingResult['possibleDuplicates']>[number]
type PreviousAttempt = NonNullable<CreateListingResult['previousAttempts']>[number]

// The row only shows the basics. What else the parse or import file held (kind, skills, summary...)
// is carried along without a control and saved with it.
export interface QuickAddRow extends ListingFields {
  key: number
  saved?: CreateListingResult['listing']
  duplicates?: PossibleDuplicate[]
  previousAttempts?: PreviousAttempt[]
  error?: string
  existingListingId?: number
  // The collected job this row came from, whatever its URL is edited to.
  sourceUrl?: string
}

export type SavedQuickAddRow = QuickAddRow & { saved: NonNullable<QuickAddRow['saved']> }
const isSaved = (r: QuickAddRow): r is SavedQuickAddRow => !!r.saved
// Clearing a row's flags (Keep both, Got it) moves it from flagged into added.
export const isFlaggedRow = (r: QuickAddRow) => !!(r.duplicates || r.previousAttempts)

// One aliased createListing per row keeps a batch to one request; the API saves each row on its
// own, so one failing row doesn't stop the others.
const buildMutation = (count: number) => {
  const indexes = [...Array(count).keys()]
  return batchDocument<CreateListingResult>(`
    mutation QuickAddListings(${indexes.map((i) => `$l${i}: ListingInput!`).join(', ')}) {
      ${indexes.map((i) => `r${i}: createListing(input: { listing: $l${i} }) { ...R }`).join('\n')}
    }
    ${print(RESULT_FRAGMENT)}
  `)
}

let nextKey = 0
export const newQuickAddRow = (): QuickAddRow => ({
  ...emptyListing(),
  key: nextKey++,
  locations: []
})

// The reply or file is an external AI's JSON: the listing form's cleaning keeps only values the API
// takes. The quick parse also returns each ad's link, which the full draft has no field for.
export const toQuickAddRow = (item: unknown): QuickAddRow => {
  // A stray null or text item in the reply becomes an empty row to fill in or remove.
  const d = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  const draft = cleanListingDraft(d)
  return {
    ...newQuickAddRow(),
    ...draft,
    kind: draft.kind ?? 'VACANCY',
    url: typeof d.url === 'string' ? d.url.trim() : '',
    postedOn: draft.postedOn || todayIso(),
    isAnalyzed: d.isAnalyzed === true
  }
}

const isBlank = (r: QuickAddRow) =>
  !r.title.trim() && !r.companyName && !r.jobRoleName && !r.url.trim()
const toSave = (rows: QuickAddRow[]) => rows.filter((r) => !r.saved && !isBlank(r))

// `revalidate` re-runs the page's form, which spans every row.
export const useQuickAddRows = (revalidate: () => void) => {
  // Rows come from a pasted AI reply or a file; "Add row" is only for a stray manual entry.
  const state = reactive({ rows: [] as QuickAddRow[] })
  const pending = computed(() => toSave(state.rows))
  const savedCount = computed(() => state.rows.filter((r) => r.saved).length)
  const failedCount = computed(() => pending.value.filter((r) => r.error).length)
  const flagged = computed(() => state.rows.filter(isSaved).filter(isFlaggedRow))
  const added = computed(() => state.rows.filter(isSaved).filter((r) => !isFlaggedRow(r)))
  const unsaved = computed(() => state.rows.filter((r) => !r.saved))
  const pastedCount = ref(0)

  // Field names use the row key, not the index, so errors stay on the right row after a removal.
  const validate = (s: typeof state): FormError[] =>
    toSave(s.rows).flatMap((r) => listingBasicsErrors(r, (field) => `${r.key}.${field}`))

  const append = async (rows: QuickAddRow[]) => {
    if (!rows.length) return false
    // Appended, not replaced, so a second paste never drops rows already saved or edited.
    state.rows.push(...rows)
    pastedCount.value = rows.length
    // Shows what the AI missed (e.g. a null url) right away instead of on Save. The row fields use
    // eager-validation because UForm otherwise only rechecks a field on input after its first blur:
    // the error would stay while fixing it, then vanish on the Save mousedown, shifting Save away
    // from under the click.
    await nextTick()
    revalidate()
    return true
  }
  const addEmpty = () => state.rows.push(newQuickAddRow())
  const remove = (row: QuickAddRow) => state.rows.splice(state.rows.indexOf(row), 1)
  // A replaced run drops only its own unsaved drafts, keeping earlier edits and saved rows.
  const dropUnsaved = (keys: number[]) => {
    state.rows = state.rows.filter((row) => row.saved || !keys.includes(row.key))
  }

  const { success: toastSuccess } = useAppToast()
  const saving = ref(false)
  const saveError = ref('')
  // Returns how many rows were saved.
  const save = async () => {
    const rows = pending.value
    saving.value = true
    saveError.value = ''
    try {
      const data = await gql(
        buildMutation(rows.length),
        Object.fromEntries(rows.map((r, i) => [`l${i}`, toListingInput(r)]))
      )
      rows.forEach((row, i) => {
        const { listing, possibleDuplicates, previousAttempts, errors } = data[`r${i}`]!
        Object.assign(row, {
          saved: listing ?? undefined,
          duplicates: possibleDuplicates?.length ? possibleDuplicates : undefined,
          previousAttempts: previousAttempts?.length ? previousAttempts : undefined,
          error: errors?.map((e) => e.message).join(' '),
          existingListingId: errors?.find((e) => e.__typename === 'DuplicateListingError')
            ?.existingListingId
        })
      })
      const count = rows.filter((r) => r.saved).length
      if (count) {
        clearNuxtState('name-lookups')
        toastSuccess(`${count} ${count === 1 ? 'listing' : 'listings'} added`)
      }
      return count
    } catch {
      saveError.value = ERROR_MESSAGES.generic
      return 0
    } finally {
      saving.value = false
    }
  }

  const { remove: deleteListing, deleting } = useDeleteListing()
  const keepBoth = (row: QuickAddRow) => (row.duplicates = undefined)
  const acknowledgeAttempts = (row: QuickAddRow) => (row.previousAttempts = undefined)
  // Both return whether it worked, so callers only move on after a real delete.
  const deleteSaved = async (row: QuickAddRow) => {
    if (!(await deleteListing(row.saved!.id))) return false
    remove(row)
    return true
  }
  const deleteMatch = async (row: QuickAddRow, id: number) => {
    if (!(await deleteListing(id))) return false
    const rest = row.duplicates!.filter((m) => m.id !== id)
    row.duplicates = rest.length ? rest : undefined
    return true
  }

  return {
    state,
    pending,
    savedCount,
    failedCount,
    flagged,
    added,
    unsaved,
    pastedCount,
    validate,
    append,
    addEmpty,
    remove,
    dropUnsaved,
    saving,
    saveError,
    save,
    deleting,
    keepBoth,
    acknowledgeAttempts,
    deleteSaved,
    deleteMatch
  }
}

export type QuickAddRows = ReturnType<typeof useQuickAddRows>
