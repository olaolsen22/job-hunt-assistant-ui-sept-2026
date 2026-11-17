import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { CoverLetter } from '~/utils/coverLetter'

// Where a new letter waiting for review came from.
export type CoverLetterSource = 'builtin' | 'own' | 'text'

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
      relocationLeadWeeks
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
    { server: false, dedupe: 'defer' }
  )

const snapshot = (letter: CoverLetter) => JSON.stringify(letter)

// The editor's state. Every way of getting a new letter (AI, an external chat, a pasted letter)
// returns a whole letter that waits as `candidate` beside the owner's own, which stays as it is
// until they use it. Nothing reaches the API's draft until save().
export const useCoverLetterDraft = (listingId: number) => {
  const query = useCoverLetterDraftQuery(listingId)
  const llm = useLlmModels()
  const { attempt, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const notify = useAppToast()
  const draft = query.data
  // A saved CV is the letter's evidence. The API still writes without one, just more generically.
  const { data: savedCv, status: savedCvStatus } = useTailoredCvDraftQuery(listingId)
  const noSavedCv = computed(() => savedCvStatus.value === 'success' && !savedCv.value)
  const letter = ref<CoverLetter>()
  // The last saved state; null until the first save, so the profile prefill counts as unsaved.
  const saved = ref<string | null>(null)
  // The letter as first built, to tell an untouched prefill from the owner's edits.
  const seed = ref('')
  const initError = ref('')

  const dirty = computed(() => !!letter.value && snapshot(letter.value) !== saved.value)
  const pristine = computed(
    () => !draft.value && !!letter.value && snapshot(letter.value) === seed.value
  )

  const fromDraft = (d: CoverLetterDraft) =>
    coverLetterFromContent(d.content, d.brief, d.relocationLeadWeeks)

  const fetchFromProfile = async () => {
    const { coverLetterDraftFromProfile } = await gql(FROM_PROFILE, { listingId })
    return coverLetterDraftFromProfile
  }

  // The saved draft, or a header prefilled from the profile (nothing saved) when there is none.
  const init = async () => {
    if (letter.value || query.status.value !== 'success') return
    initError.value = ''
    if (draft.value) {
      letter.value = fromDraft(draft.value)
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
      initError.value = genericError(e)
    }
  }

  // Refills the sender, recipient and date from the profile; the text, language and notes stay.
  const resettingHeader = ref(false)
  const resetHeader = async () => {
    if (!letter.value) return
    resettingHeader.value = true
    try {
      const prefill = await fetchFromProfile()
      if (!prefill) return notify.error('This listing no longer exists')
      const fresh = coverLetterFromContent(prefill)
      for (const key of COVER_LETTER_HEADER_KEYS) letter.value[key] = fresh[key]
    } catch {
      notify.error(ERROR_MESSAGES.generic)
    } finally {
      resettingHeader.value = false
    }
  }

  // A new letter waits for review. Another one replaces it: only the latest run is reviewed.
  const candidate = ref<{ letter: CoverLetter; source: CoverLetterSource }>()
  const reviewing = computed(() => !!candidate.value)
  // Counts new letters, so an Undo after a later one never brings back the older one.
  let loads = 0
  const load = (content: CoverLetterContent, source: CoverLetterSource) => {
    loads++
    candidate.value = { letter: coverLetterFromContent(content), source }
  }
  // Only its text replaces the editor's; the details, language and notes stay.
  const acceptCandidate = () => {
    if (!letter.value || !candidate.value) return
    letter.value = withCoverLetterBody(letter.value, candidate.value.letter)
    candidate.value = undefined
  }
  // Returns a way to bring the discarded letter back (the page's Undo), or nothing to discard.
  // It does nothing once another letter has come in since, used or not.
  const discardCandidate = () => {
    const discarded = candidate.value
    if (!discarded) return
    const at = loads
    candidate.value = undefined
    return () => {
      if (at === loads && !candidate.value) candidate.value = discarded
    }
  }

  const { run, loading: saving } = useMutation()
  // The save itself, also used before generating, which may run while a new letter waits.
  const persist = async () => {
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
    letter.value = fromDraft(savedDraft)
    saved.value = seed.value = snapshot(letter.value)
    return true
  }
  // Saving waits while a new letter is under review, like the tailored CV's AI changes.
  const save = async () => {
    if (reviewing.value || !(await persist())) return false
    notify.success('Cover letter saved')
    return true
  }

  // The API reads the notes, the weeks and the language from the saved draft, so unsaved edits are
  // saved first. It never reads the saved paragraphs: the letter it writes is new, and waits for
  // review. Returns an error to show, or null once it waits.
  const generating = ref(false)
  const generate = async (): Promise<string | null> => {
    if (!letter.value) return null
    generating.value = true
    try {
      // The save already showed its own error; this one says what didn't happen.
      if ((dirty.value || !draft.value) && !(await persist()))
        return 'The letter couldn’t be saved, so no new letter was written.'
      const input = { listingId }
      // A retry repeats the same request only while what the API reads from the draft is the same.
      const { brief, relocationLeadWeeks, language } = letter.value
      const { result, errors } = await attempt(
        { listingId, brief, relocationLeadWeeks, language },
        async (requestId) =>
          (await gql(GENERATE_LETTER, { input: { ...input, requestId } })).generateCoverLetter
      )
      if (isUnknownModel(errors)) await llm.refresh()
      if (errors?.length) return errors[0]!.message
      if (result?.status !== 'SUCCEEDED' || !result.content) {
        const message = result?.error ?? ERROR_MESSAGES.generic
        return result?.errorCode ? `${message} (${result.errorCode})` : message
      }
      load(result.content, 'builtin')
      return null
    } catch (e) {
      return genericError(e)
    } finally {
      generating.value = false
    }
  }

  // The current notes and weeks (even unsaved) are appended unless the prompt already holds them.
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT, { listingId })).coverLetterExternalPrompt.instructions,
    (prompt) => {
      const notes = letter.value?.brief.trim()
      const weeks = letter.value?.relocationLeadWeeks
      const extra = [
        notes && !prompt.includes(notes)
          ? `Notes from the applicant (follow these):\n${notes}`
          : '',
        weeks != null && !prompt.includes(`${weeks} week`)
          ? `The applicant needs ${weeks} ${weeks === 1 ? 'week' : 'weeks'} to relocate before starting.`
          : ''
      ].filter(Boolean)
      return extra.length ? `${prompt}\n\n${extra.join('\n\n')}` : prompt
    }
  )

  // An external chat's JSON reply or the owner's own letter, checked and split by the API.
  // A pasted letter goes straight into an empty letter (it's the owner's own text, nothing to
  // compare); everything else waits for review. Returns the API's error to show, or null.
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
      if (kind === 'text' && letter.value && !hasCoverLetterBody(letter.value)) {
        // Nothing to compare, but a subject, greeting or closing already there stays unless the
        // pasted letter has its own.
        const pasted = coverLetterFromContent(payload.candidate)
        for (const key of ['subject', 'greeting', 'closing'] as const)
          pasted[key] = pasted[key].trim() ? pasted[key] : letter.value[key]
        letter.value = withCoverLetterBody(letter.value, pasted)
        const n = letter.value.paragraphs.length
        notify.info(`Split into ${n} ${n === 1 ? 'paragraph' : 'paragraphs'}`, {
          description: 'Check the breaks, then save.'
        })
      } else load(payload.candidate, kind === 'json' ? 'own' : 'text')
      return null
    } catch (e) {
      return genericError(e)
    } finally {
      previewing.value = false
    }
  }

  // Every call adds another PDF, so a failure is never retried automatically. The API prints the
  // saved draft, so unsaved edits are saved first; a failed save stops it. The error shows above
  // the bar until the next try.
  const generatingPdf = ref(false)
  const pdfError = ref('')
  const generated = ref<{
    id: number
    fileName: string
    createdAt: string
    sentAt: string | null
  }>()
  const generatePdf = async () => {
    if (generatingPdf.value || reviewing.value || !letter.value) return false
    generatingPdf.value = true
    pdfError.value = ''
    generated.value = undefined
    try {
      if ((dirty.value || !draft.value) && !(await persist())) return false
      const { generateCoverLetterDocument } = await gql(GENERATE_DOCUMENT, { listingId })
      const error = generateCoverLetterDocument.errors?.[0]
      if (error) {
        // The draft is gone: count the letter as unsaved, so the next try saves it again.
        if (error.__typename === 'CoverLetterDraftNotFoundError') {
          draft.value = null
          saved.value = null
          // Not an untouched prefill either: the leave guard must still protect it.
          seed.value = ''
          pdfError.value = 'The saved letter was missing. Creating the PDF saves it again.'
        } else pdfError.value = error.message
        return false
      }
      generated.value = generateCoverLetterDocument.document ?? undefined
      return !!generated.value
    } catch {
      pdfError.value = ERROR_MESSAGES.generic
      return false
    } finally {
      generatingPdf.value = false
    }
  }

  return {
    query,
    draft,
    noSavedCv,
    letter,
    dirty,
    pristine,
    init,
    initError,
    resetHeader,
    resettingHeader,
    candidate,
    reviewing,
    acceptCandidate,
    discardCandidate,
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
    pdfError,
    generated,
    generatePdf
  }
}
