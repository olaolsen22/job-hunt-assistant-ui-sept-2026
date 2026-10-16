import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { CoverLetter } from '~/utils/coverLetter'

const CONTENT_FIELDS = graphql(`
  fragment CoverLetterContentFields on CoverLetterContent {
    language
    fullName
    address
    phone
    email
    date
    organization
    recipientName
    recipientAddress
    subject
    greeting
    paragraphs
    closing
  }
`)

const DRAFT_FIELDS = graphql(
  `
    fragment CoverLetterDraftFields on CoverLetterDraft {
      id
      brief
      updatedAt
      content {
        ...CoverLetterContentFields
      }
    }
  `,
  [CONTENT_FIELDS]
)

const DRAFT = graphql(
  `
    query CoverLetterDraft($listingId: Int!) {
      coverLetterDraft(listingId: $listingId) {
        ...CoverLetterDraftFields
      }
    }
  `,
  [DRAFT_FIELDS]
)

const FROM_PROFILE = graphql(
  `
    query CoverLetterDraftFromProfile($listingId: Int!) {
      coverLetterDraftFromProfile(listingId: $listingId) {
        ...CoverLetterContentFields
      }
    }
  `,
  [CONTENT_FIELDS]
)

const PROMPT = graphql(`
  query CoverLetterExternalPrompt($listingId: Int!) {
    coverLetterExternalPrompt(listingId: $listingId) {
      instructions
    }
  }
`)

const SAVE = graphql(
  `
    mutation SaveCoverLetterDraft($input: SaveCoverLetterDraftInput!) {
      saveCoverLetterDraft(input: $input) {
        coverLetterDraft {
          ...CoverLetterDraftFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [DRAFT_FIELDS]
)

const GENERATE_LETTER = graphql(
  `
    mutation GenerateCoverLetter($input: GenerateCoverLetterInput!) {
      generateCoverLetter(input: $input) {
        result {
          status
          error
          errorCode
          content {
            ...CoverLetterContentFields
          }
        }
        errors {
          __typename
          ... on Error {
            message
          }
          ... on AiSafetyError {
            code
          }
        }
      }
    }
  `,
  [CONTENT_FIELDS]
)

const PREVIEW_JSON = graphql(
  `
    mutation PreviewCoverLetterDraft($input: PreviewCoverLetterDraftInput!) {
      previewCoverLetterDraft(input: $input) {
        candidate {
          ...CoverLetterContentFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [CONTENT_FIELDS]
)

const PREVIEW_TEXT = graphql(
  `
    mutation PreviewCoverLetterText($input: PreviewCoverLetterTextInput!) {
      previewCoverLetterText(input: $input) {
        candidate {
          ...CoverLetterContentFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [CONTENT_FIELDS]
)

const GENERATE_DOCUMENT = graphql(`
  mutation GenerateCoverLetterDocument($listingId: Int!) {
    generateCoverLetterDocument(input: { listingId: $listingId }) {
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

export type CoverLetterDraft = NonNullable<ResultOf<typeof DRAFT>['coverLetterDraft']>
type CoverLetterContent = CoverLetterDraft['content']

// One shared key, so the listing card and the editor read the same fetch. Null means no draft yet.
export const useCoverLetterDraftQuery = (listingId: number) =>
  useAsyncData(
    `cover-letter-draft-${listingId}`,
    () => gql(DRAFT, { listingId }).then((r) => r.coverLetterDraft),
    { server: false }
  )

const snapshot = (letter: CoverLetter) => JSON.stringify(letter)

// The editor's state. Every way of getting a body (AI, an external chat, a pasted letter) returns a
// whole unsaved letter that replaces the editor; one snapshot from before it lets Discard undo that.
// Nothing reaches the API's draft until save().
export const useCoverLetterDraft = (listingId: number) => {
  const query = useCoverLetterDraftQuery(listingId)
  const llm = useLlmModels()
  const { attempt, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const toast = useToast()
  const draft = query.data
  const letter = ref<CoverLetter>()
  // The last saved state; null until the first save, so the profile prefill counts as unsaved.
  const saved = ref<string | null>(null)
  // The letter as first built, to tell an untouched prefill from the owner's edits.
  const seed = ref('')
  // The editor before a candidate replaced it, while that candidate is unsaved.
  const beforeCandidate = ref<string>()
  const initError = ref('')

  const dirty = computed(() => !!letter.value && snapshot(letter.value) !== saved.value)
  const pristine = computed(
    () => !draft.value && !!letter.value && snapshot(letter.value) === seed.value
  )

  const fetchFromProfile = async () => {
    const { coverLetterDraftFromProfile } = await gql(FROM_PROFILE, { listingId })
    return coverLetterDraftFromProfile
  }

  // The saved draft, or a header prefilled from the profile (nothing saved) when there is none.
  const init = async () => {
    if (letter.value || query.status.value !== 'success') return
    initError.value = ''
    if (draft.value) {
      letter.value = coverLetterFromContent(draft.value.content, draft.value.brief)
      saved.value = seed.value = snapshot(letter.value)
      return
    }
    try {
      const prefill = await fetchFromProfile()
      if (!prefill) {
        initError.value = 'This listing no longer exists.'
        return
      }
      letter.value = coverLetterFromContent(prefill)
      seed.value = snapshot(letter.value)
    } catch (e) {
      initError.value = `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
    }
  }

  // Refills the sender, recipient, date and subject from the profile; the body and notes stay.
  const resettingHeader = ref(false)
  const resetHeader = async () => {
    if (!letter.value) return
    resettingHeader.value = true
    try {
      const prefill = await fetchFromProfile()
      if (!prefill) return toast.add({ title: 'This listing no longer exists.', color: 'error' })
      const fresh = coverLetterFromContent(prefill)
      for (const key of COVER_LETTER_HEADER_KEYS) letter.value[key] = fresh[key]
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
    } finally {
      resettingHeader.value = false
    }
  }

  const load = (content: CoverLetterContent) => {
    if (!letter.value) return
    // Kept across several loads, so Discard always returns to the owner's own letter.
    beforeCandidate.value ??= snapshot(letter.value)
    letter.value = coverLetterFromContent(content, letter.value.brief)
  }
  const discard = () => {
    if (beforeCandidate.value) letter.value = JSON.parse(beforeCandidate.value)
    beforeCandidate.value = undefined
  }

  const { run, loading: saving } = useMutation()
  const save = async () => {
    if (!letter.value) return false
    let result: CoverLetterDraft | null = null
    const ok = await run(async () => {
      const { saveCoverLetterDraft } = await gql(SAVE, {
        input: { listingId, ...toCoverLetterInput(letter.value!) }
      })
      result = saveCoverLetterDraft.coverLetterDraft
      return saveCoverLetterDraft.errors
    })
    if (!ok || !result) return false
    const savedDraft: CoverLetterDraft = result
    draft.value = savedDraft
    // Back from the API in its normalized form (blank fields and paragraphs dropped).
    letter.value = coverLetterFromContent(savedDraft.content, savedDraft.brief)
    saved.value = seed.value = snapshot(letter.value)
    beforeCandidate.value = undefined
    toast.add({ title: 'Cover letter saved', color: 'success', icon: 'i-lucide-check' })
    return true
  }

  // The API writes from the saved draft (brief included), so unsaved edits are saved first; the
  // letter it returns is then loaded unsaved. Returns an error to show, or null once loaded.
  const generating = ref(false)
  const generate = async (): Promise<string | null> => {
    if (!letter.value) return null
    generating.value = true
    try {
      if ((dirty.value || !draft.value) && !(await save())) return 'Save the letter first.'
      const input = { listingId }
      const { result, errors } = await attempt(
        input,
        async (requestId) =>
          (await gql(GENERATE_LETTER, { input: { ...input, requestId } })).generateCoverLetter
      )
      if (isUnknownModel(errors)) await llm.refresh()
      if (errors?.length) return errors[0]!.message
      if (result?.status !== 'SUCCEEDED' || !result.content) {
        const message = result?.error ?? ERROR_MESSAGES.generic
        return result?.errorCode ? `${message} (${result.errorCode})` : message
      }
      load(result.content)
      return null
    } catch (e) {
      return `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
    } finally {
      generating.value = false
    }
  }

  // Loaded before the copy button is usable: browsers can refuse a clipboard write after an await.
  const apiInstructions = ref('')
  // The prompt query takes no notes, so the owner's current notes (even unsaved) are appended here.
  const instructions = computed(() => {
    const notes = letter.value?.brief.trim()
    if (!apiInstructions.value || !notes || apiInstructions.value.includes(notes)) {
      return apiInstructions.value
    }
    return `${apiInstructions.value}\n\nNotes from the applicant (follow these):\n${notes}`
  })
  const promptError = ref('')
  const promptLoading = ref(false)
  const copied = ref(false)
  const loadPrompt = async () => {
    promptLoading.value = true
    promptError.value = ''
    try {
      apiInstructions.value = (
        await gql(PROMPT, { listingId })
      ).coverLetterExternalPrompt.instructions
    } catch {
      promptError.value = 'Could not load the prompt.'
    } finally {
      promptLoading.value = false
    }
  }
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(instructions.value)
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    } catch {
      promptError.value = 'Could not copy the prompt. Copy it from the text below.'
    }
  }

  // An external chat's JSON reply or the owner's own letter, checked and split by the API.
  // Returns the API's error to show next to the pasted text, or null once loaded.
  const previewing = ref(false)
  const preview = async (kind: 'json' | 'text', value: string): Promise<string | null> => {
    previewing.value = true
    try {
      const payload =
        kind === 'json'
          ? (await gql(PREVIEW_JSON, { input: { listingId, json: value.trim() } }))
              .previewCoverLetterDraft
          : (await gql(PREVIEW_TEXT, { input: { listingId, text: value.trim() } }))
              .previewCoverLetterText
      if (!payload.candidate) return payload.errors?.[0]?.message ?? ERROR_MESSAGES.generic
      load(payload.candidate)
      return null
    } catch (e) {
      return `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
    } finally {
      previewing.value = false
    }
  }

  // Every call adds another PDF, so a failure is never retried automatically. The API prints the
  // saved draft, so unsaved edits are saved first; a failed save stops it.
  const generatingPdf = ref(false)
  const generated = ref<{
    id: number
    fileName: string
    createdAt: string
    sentAt: string | null
  }>()
  const generatePdf = async () => {
    if (generatingPdf.value || !letter.value) return false
    generatingPdf.value = true
    generated.value = undefined
    try {
      if ((dirty.value || !draft.value) && !(await save())) return false
      const { generateCoverLetterDocument } = await gql(GENERATE_DOCUMENT, { listingId })
      const error = generateCoverLetterDocument.errors?.[0]
      if (error) {
        toast.add({ title: error.message, color: 'error' })
        // The draft is gone: count the letter as unsaved, so the next try saves it again.
        if (error.__typename === 'CoverLetterDraftNotFoundError') {
          draft.value = null
          saved.value = null
          // Not an untouched prefill either: the leave guard must still protect it.
          seed.value = ''
        }
        return false
      }
      generated.value = generateCoverLetterDocument.document ?? undefined
      return !!generated.value
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
      return false
    } finally {
      generatingPdf.value = false
    }
  }

  return {
    query,
    draft,
    letter,
    dirty,
    pristine,
    init,
    initError,
    resetHeader,
    resettingHeader,
    candidateLoaded: computed(() => !!beforeCandidate.value),
    discard,
    saving,
    save,
    generating,
    generate,
    safetyCode,
    safetyMessage,
    needsConfirm,
    confirmRetry,
    instructions,
    promptError,
    promptLoading,
    copied,
    loadPrompt,
    copyPrompt,
    previewing,
    preview,
    generatingPdf,
    generated,
    generatePdf
  }
}
