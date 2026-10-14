import type { Ref } from 'vue'
import type { ResultOf, VariablesOf } from 'gql.tada'
import type { ProfileData } from '~/composables/useProfile'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { Language } from '~/constants/listing'
import type { TailoredCv, TailoredCvSectionKey } from '~/utils/tailoredCv'

const CONTENT_FIELDS = graphql(`
  fragment TailoredCvContentFields on TailoredCvContent {
    fullName
    headline
    email
    phone
    address
    language
    dateOfBirth
    referencesOnRequest
    sectionOrder
    links {
      label
      url
    }
    summary
    experiences {
      employer
      title
      location
      startMonth
      endMonth
      sourceEntryId
      contentStyle
      paragraph
      bullets {
        text
        sourceBulletId
      }
    }
    educations {
      school
      degree
      field
      location
      startMonth
      endMonth
      sourceEntryId
      contentStyle
      paragraph
      bullets {
        text
        sourceBulletId
      }
    }
    certifications {
      name
      issuer
      issuedMonth
      expiresMonth
      url
      sourceEntryId
      contentStyle
      paragraph
      bullets {
        text
        sourceBulletId
      }
    }
    projects {
      name
      url
      location
      startMonth
      endMonth
      sourceEntryId
      contentStyle
      paragraph
      bullets {
        text
        sourceBulletId
      }
    }
    skills {
      name
      level
      sourceSkillId
    }
    languages {
      name
      spoken
      written
    }
  }
`)

const DRAFT = graphql(
  `
    query TailoredCvDraft($listingId: Int!) {
      tailoredCvDraft(listingId: $listingId) {
        id
        updatedAt
        content {
          ...TailoredCvContentFields
        }
      }
    }
  `,
  [CONTENT_FIELDS]
)

const PROMPT = graphql(`
  query TailoredCvExternalPrompt($listingId: Int!) {
    tailoredCvExternalPrompt(listingId: $listingId) {
      instructions
    }
  }
`)

const ANALYZE = graphql(`
  mutation AnalyzeTailoredCvSection($input: AnalyzeTailoredCvSectionInput!) {
    analyzeTailoredCvSection(input: $input) {
      result {
        status
        section
        sourceEntryId
        selectedBulletIds
        selectedSkillIds
        summary
        paragraph
        error
        errorCode
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
`)

const PREVIEW = graphql(
  `
    mutation PreviewTailoredCvDraft($input: PreviewTailoredCvDraftInput!) {
      previewTailoredCvDraft(input: $input) {
        candidate {
          content {
            ...TailoredCvContentFields
          }
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

const SAVE = graphql(
  `
    mutation SaveTailoredCvDraft($input: SaveTailoredCvDraftInput!) {
      saveTailoredCvDraft(input: $input) {
        tailoredCvDraft {
          id
          updatedAt
          content {
            ...TailoredCvContentFields
          }
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

export type TailoredCvDraft = NonNullable<ResultOf<typeof DRAFT>['tailoredCvDraft']>
export type TailoredCvContent = TailoredCvDraft['content']
export type TailoredCvContentInput = VariablesOf<typeof SAVE>['input']['content']
export type TailoredCvAnalysis = NonNullable<
  ResultOf<typeof ANALYZE>['analyzeTailoredCvSection']['result']
>

// One shared key, so the listing card, the Apply modal and the editor read the same fetch.
// Null means no draft yet (the API also says null for someone else's listing).
export const useTailoredCvDraftQuery = (listingId: number) =>
  useAsyncData(
    `tailored-cv-draft-${listingId}`,
    () => gql(DRAFT, { listingId }).then((r) => r.tailoredCvDraft),
    { server: false }
  )

export const useCopyTailoredCv = () => {
  const toast = useToast()
  return async (cv: TailoredCv) => {
    try {
      await navigator.clipboard.writeText(tailoredCvToText(cv))
      toast.add({ title: 'CV copied as text', color: 'success', icon: 'i-lucide-check' })
    } catch {
      toast.add({ title: 'Could not copy the CV. Try again.', color: 'error' })
    }
  }
}

interface AnalysisStep {
  key: TailoredCvSectionKey
  label: string
  section: TailoredCvAnalysis['section']
  sourceEntryId: number | null
}

export interface TailoredCvSuggestion {
  key: TailoredCvSectionKey
  value: unknown
}

const snapshot = (cv: TailoredCv) => JSON.stringify(cv)

// The editor's state: the editable candidate, AI suggestions waiting for Accept/Dismiss, per-section
// errors, analysis progress and save. Nothing reaches the API's draft until save().
export const useTailoredCvDraft = (
  listingId: number,
  profile: Ref<ProfileData | null | undefined>,
  postingLanguage: Ref<Language | null | undefined> = ref(undefined)
) => {
  const query = useTailoredCvDraftQuery(listingId)
  const llm = useLlmModels()
  const { attempt, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const draft = query.data
  const cv = ref<TailoredCv>()
  // The last saved state; null until the first save, so a new candidate counts as unsaved.
  const saved = ref<string | null>(null)
  // The candidate as first built, to tell whether the owner has edited it.
  const seed = ref('')
  const suggestions = ref<TailoredCvSuggestion[]>([])
  const sectionErrors = ref<Partial<Record<TailoredCvSectionKey, string>>>({})
  // Technical detail for an unexpected failure, shown small under the generic message.
  const sectionDetails = ref<Partial<Record<TailoredCvSectionKey, string>>>({})
  const analyzing = ref(false)
  const analyzingKey = ref<TailoredCvSectionKey>()
  const progress = ref<{ label: string; step: number; total: number }>()

  const dirty = computed(() => !!cv.value && snapshot(cv.value) !== saved.value)
  // First creation (nothing saved, nothing edited): AI output fills the candidate directly.
  // Otherwise it waits as a suggestion, so the owner's work is never replaced silently.
  const fillsDirectly = () => !draft.value && !!cv.value && snapshot(cv.value) === seed.value

  // The profile as a candidate, in the posting's language when the listing has one.
  const fromProfile = (source: ProfileData) => {
    const fresh = tailoredCvFromProfile(source)
    if (postingLanguage.value) fresh.language = postingLanguage.value
    return fresh
  }
  // No draft and no edits yet: the candidate is just the profile, so "unsaved" would blame the owner.
  const pristine = computed(() => !draft.value && !!cv.value && snapshot(cv.value) === seed.value)
  const matchesProfile = computed(
    () =>
      !!cv.value && !!profile.value && snapshot(cv.value) === snapshot(fromProfile(profile.value))
  )

  // Builds the candidate once both the draft and the profile are in. Returns true for a new candidate.
  const init = () => {
    if (!profile.value || query.status.value !== 'success') return false
    const savedCv = draft.value ? tailoredCvFromContent(draft.value.content) : undefined
    const savedSnapshot = savedCv ? snapshot(savedCv) : null
    cv.value = savedCv ?? fromProfile(profile.value)
    // A saved draft follows the posting's language too, so the owner's old choice doesn't linger.
    if (postingLanguage.value) cv.value.language = postingLanguage.value
    seed.value = snapshot(cv.value)
    saved.value = savedSnapshot
    return !draft.value
  }

  // Starts over from the profile. Nothing is saved: the old draft stays until the owner saves, so
  // leaving or reloading brings it back.
  const reset = () => {
    if (!profile.value) return
    cv.value = fromProfile(profile.value)
    seed.value = snapshot(cv.value)
    suggestions.value = []
    sectionErrors.value = {}
    sectionDetails.value = {}
  }

  const offer = (key: TailoredCvSectionKey, value: unknown, direct: boolean) => {
    if (!cv.value) return
    suggestions.value = suggestions.value.filter((s) => s.key !== key)
    if (direct) setCvSection(cv.value, key, value)
    else if (JSON.stringify(getCvSection(cv.value, key)) !== JSON.stringify(value))
      suggestions.value.push({ key, value })
  }

  const accept = (key: TailoredCvSectionKey) => {
    const suggestion = suggestions.value.find((s) => s.key === key)
    if (suggestion && cv.value) setCvSection(cv.value, key, suggestion.value)
    dismiss(key)
  }

  const dismiss = (key: TailoredCvSectionKey) => {
    suggestions.value = suggestions.value.filter((s) => s.key !== key)
  }

  // The API's own order: work experience first, then education, then skills to match them, and
  // the summary last.
  const steps = (): AnalysisStep[] => {
    const experiences = profile.value?.experiences ?? []
    const educations = profile.value?.educations ?? []
    return [
      ...experiences.map((e, i) => ({
        key: `experience:${e.id}` as const,
        label: `Analyzing experience ${i + 1} of ${experiences.length}`,
        section: 'EXPERIENCE' as const,
        sourceEntryId: e.id
      })),
      ...educations.map((e, i) => ({
        key: `education:${e.id}` as const,
        label: `Analyzing education ${i + 1} of ${educations.length}`,
        section: 'EDUCATION' as const,
        sourceEntryId: e.id
      })),
      { key: 'skills', label: 'Analyzing skills', section: 'SKILLS', sourceEntryId: null },
      { key: 'summary', label: 'Writing the summary', section: 'SUMMARY', sourceEntryId: null }
    ]
  }

  // A failed or skipped section keeps its content and shows why; the caller moves on to the next
  // one. Returns true when every later section would fail the same way, so the caller stops: the
  // saved model is gone (the list is already refetched) or the API's AI safeguards refused.
  const runStep = async (step: AnalysisStep, direct: boolean) => {
    sectionErrors.value = { ...sectionErrors.value, [step.key]: undefined }
    sectionDetails.value = { ...sectionDetails.value, [step.key]: undefined }
    try {
      const input = { listingId, section: step.section, sourceEntryId: step.sourceEntryId }
      const { result, errors } = await attempt(
        input,
        async (requestId) =>
          (await gql(ANALYZE, { input: { ...input, requestId } })).analyzeTailoredCvSection
      )
      if (isUnknownModel(errors)) {
        sectionErrors.value[step.key] = errors![0]!.message
        await llm.refresh()
        return true
      }
      if (aiSafetyCode(errors)) {
        sectionErrors.value[step.key] = errors![0]!.message
        return true
      }
      const value =
        result && profile.value && cv.value
          ? cvSectionFromAnalysis(cv.value, profile.value, result)
          : null
      if (!value) {
        const message = errors?.[0]?.message ?? result?.error ?? ERROR_MESSAGES.generic
        sectionErrors.value[step.key] = result?.errorCode
          ? `${message} (${result.errorCode})`
          : message
        return
      }
      offer(value.key, value.value, direct)
    } catch (e) {
      sectionErrors.value[step.key] = ERROR_MESSAGES.generic
      sectionDetails.value[step.key] = errorDetail(e)
    }
  }

  // The same sequence analyzeAllTailoredCv runs, but one request per section, so progress is real
  // and each result lands as soon as it's back.
  const analyzeAll = async () => {
    const direct = fillsDirectly()
    const all = steps()
    analyzing.value = true
    try {
      for (const [i, step] of all.entries()) {
        progress.value = { label: step.label, step: i + 1, total: all.length }
        if (await runStep(step, direct)) break
      }
    } finally {
      analyzing.value = false
      progress.value = undefined
    }
  }

  // What built-in analysis will cost, shown before the owner starts it.
  const requestCount = (scope?: TailoredCvSectionKey) => (scope ? 1 : steps().length)

  const analyzeSection = async (key: TailoredCvSectionKey) => {
    const step = steps().find((s) => s.key === key)
    if (!step) return
    analyzingKey.value = key
    try {
      await runStep(step, fillsDirectly())
    } finally {
      analyzingKey.value = undefined
    }
  }

  // Loaded before the copy button is usable: browsers can refuse a clipboard write after an await.
  const instructions = ref('')
  const promptError = ref('')
  const promptLoading = ref(false)
  const copied = ref(false)
  const loadPrompt = async () => {
    promptLoading.value = true
    promptError.value = ''
    try {
      instructions.value = (await gql(PROMPT, { listingId })).tailoredCvExternalPrompt.instructions
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

  // Returns the API's error to show next to the pasted JSON, or null when the reply was taken in.
  const previewing = ref(false)
  // `scope` takes one section from the reply: the API has a single whole-CV prompt.
  const preview = async (json: string, scope?: TailoredCvSectionKey): Promise<string | null> => {
    if (!cv.value) return null
    previewing.value = true
    try {
      const { previewTailoredCvDraft } = await gql(PREVIEW, {
        input: { listingId, json: json.trim() }
      })
      const { candidate, errors } = previewTailoredCvDraft
      if (!candidate) return errors?.[0]?.message ?? ERROR_MESSAGES.generic
      const next = mergeExternalCandidate(cv.value, tailoredCvFromContent(candidate.content))
      next.language = postingLanguage.value ?? cv.value.language
      if (scope) {
        const value = getCvSection(next, scope)
        if (value === undefined) return 'The reply has nothing for this section.'
        offer(scope, value, fillsDirectly())
      } else if (fillsDirectly()) {
        cv.value = next
        suggestions.value = []
      } else {
        for (const { key, value } of changedCvSections(cv.value, next)) offer(key, value, false)
      }
      return null
    } catch (e) {
      return `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
    } finally {
      previewing.value = false
    }
  }

  const toast = useToast()
  const { run, loading: saving } = useMutation()
  const save = async () => {
    if (!cv.value) return false
    const content = toTailoredCvInput(cv.value)
    let result: TailoredCvDraft | null = null
    const ok = await run(async () => {
      const { saveTailoredCvDraft } = await gql(SAVE, { input: { listingId, content } })
      result = saveTailoredCvDraft.tailoredCvDraft
      return saveTailoredCvDraft.errors
    })
    if (!ok || !result) return false
    draft.value = result
    // Back from the API in its normalized form (blank fields and empty bullets dropped).
    cv.value = tailoredCvFromContent((result as TailoredCvDraft).content)
    saved.value = seed.value = snapshot(cv.value)
    toast.add({ title: 'Draft saved', color: 'success', icon: 'i-lucide-check' })
    return true
  }

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
    if (generatePhase.value || !cv.value) return false
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

  return {
    query,
    draft,
    cv,
    dirty,
    pristine,
    matchesProfile,
    init,
    reset,
    suggestions,
    sectionErrors,
    sectionDetails,
    accept,
    dismiss,
    analyzing,
    analyzingKey,
    progress,
    analyzeAll,
    analyzeSection,
    requestCount,
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
    saving,
    save,
    generatePhase,
    generating,
    generated,
    generateError,
    generate
  }
}
