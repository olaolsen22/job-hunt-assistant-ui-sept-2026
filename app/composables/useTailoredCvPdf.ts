import type { Ref } from 'vue'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { TailoredCvDraft } from '~/composables/useTailoredCvDraft'
import type { TailoredCv } from '~/utils/tailoredCv'

const GENERATE = graphql(`
  mutation GenerateCvDocument($listingId: Int!) {
    generateCvDocument(input: { listingId: $listingId }) {
      document {
        id
        fileName
        createdAt
        sentAt
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

export const useTailoredCvPdf = ({
  listingId,
  cv,
  draft,
  saved,
  dirty,
  reviewing,
  save
}: {
  listingId: number
  cv: Ref<TailoredCv | undefined>
  draft: Ref<TailoredCvDraft | null | undefined>
  saved: Ref<string | null>
  dirty: Ref<boolean>
  // Pending AI suggestions: the PDF waits for the review, like saving does.
  reviewing: Ref<boolean>
  save: () => Promise<boolean>
}) => {
  // Every call adds another PDF, so a failure is never retried automatically. Unsaved edits (or no
  // draft yet) are saved first, since the API generates from the saved draft; a failed save stops it.
  // `useMutation` can't tell a missing draft from a missing listing (both are *NotFoundError), hence
  // the explicit handling.
  const generatePhase = ref<'saving' | 'generating'>()
  const generating = computed(() => !!generatePhase.value)
  const generated = ref<{
    id: number
    fileName: string
    createdAt: string
    sentAt: string | null
  }>()
  const generateError = ref<{
    kind: 'draft' | 'listing' | 'other'
    message: string
    detail?: string
  }>()
  const generate = async () => {
    if (generatePhase.value || !cv.value || reviewing.value) return false
    generated.value = generateError.value = undefined
    try {
      if (dirty.value || !draft.value) {
        generatePhase.value = 'saving'
        if (!(await save())) return false
      }
      generatePhase.value = 'generating'
      const { generateCvDocument } = await gql(GENERATE, { listingId })
      const error = generateCvDocument.errors?.[0]
      if (error) {
        const kind =
          error.__typename === 'TailoredCvDraftNotFoundError'
            ? 'draft'
            : error.__typename === 'ListingNotFoundError'
              ? 'listing'
              : 'other'
        generateError.value = { kind, message: error.message }
        // The draft is gone: keep the candidate and count it as unsaved, so the next try saves it again.
        if (kind === 'draft') {
          draft.value = null
          saved.value = null
        }
        return false
      }
      generated.value = generateCvDocument.document ?? undefined
      return !!generated.value
    } catch (e) {
      generateError.value = {
        kind: 'other',
        message: ERROR_MESSAGES.generic,
        detail: errorDetail(e)
      }
      return false
    } finally {
      generatePhase.value = undefined
    }
  }

  return { generatePhase, generating, generated, generateError, generate }
}
