import type { Ref } from 'vue'
import type { ResultOf, VariablesOf } from 'gql.tada'
import type { ProfileData } from '~/composables/useProfile'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { Language } from '~/constants/listing'
import type { TailoredCv, TailoredCvSectionKey } from '~/utils/tailoredCv'

// Shared with the CV template (base CV) queries, whose versions hold the same content.
export const CV_CONTENT_FIELDS = graphql(`
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
    contentStyle
    template
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
      paragraph
      technologies
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
      paragraph
      kind
      technologies
      bullets {
        text
        sourceBulletId
      }
    }
    skills {
      name
      level
      sourceSkillId
      categoryId
      group
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
  [CV_CONTENT_FIELDS]
)

const FROM_PROFILE = graphql(
  `
    query TailoredCvDraftFromProfile($listingId: Int!, $language: Language) {
      tailoredCvDraftFromProfile(listingId: $listingId, language: $language) {
        ...TailoredCvContentFields
      }
    }
  `,
  [CV_CONTENT_FIELDS]
)

const PROMPT = graphql(`
  query TailoredCvExternalPrompt(
    $listingId: Int!
    $template: TailoredCvTemplate
    $language: Language
  ) {
    tailoredCvExternalPrompt(listingId: $listingId, template: $template, language: $language) {
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
        headline
        paragraph
        technologies
        bullets {
          text
          sourceBulletId
        }
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
  [CV_CONTENT_FIELDS]
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
  [CV_CONTENT_FIELDS]
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

// One shared key, so the listing card, the Apply modal and the editor read the same fetch; `defer`
// makes the ones that mount together (card, its reset, the Apply modal) share one request.
// Null means no draft yet (the API also says null for someone else's listing).
export const useTailoredCvDraftQuery = (listingId: number) =>
  useAsyncData(
    `tailored-cv-draft-${listingId}`,
    () => gql(DRAFT, { listingId }).then((r) => r.tailoredCvDraft),
    { server: false, dedupe: 'defer' }
  )

// Fallback for a saved draft that won't load: the API has no delete, so the draft is overwritten
// with a fresh one built from the profile. The old content is lost, hence callers confirm first.
export const useResetTailoredCvDraft = (listingId: number) => {
  const query = useTailoredCvDraftQuery(listingId)
  const toast = useToast()
  const resetting = ref(false)
  // Shown in the error card next to the Reset button, where the owner is looking.
  const error = ref('')
  const reset = async () => {
    resetting.value = true
    error.value = ''
    let step = 'building the CV from your profile'
    try {
      const { tailoredCvDraftFromProfile } = await gql(FROM_PROFILE, { listingId })
      if (!tailoredCvDraftFromProfile) {
        error.value = 'This listing no longer exists.'
        return false
      }
      step = 'saving it'
      const content = toTailoredCvInput(tailoredCvFromContent(tailoredCvDraftFromProfile))
      const { saveTailoredCvDraft } = await gql(SAVE, { input: { listingId, content } })
      const apiError = saveTailoredCvDraft.errors?.[0]
      if (apiError) {
        error.value = apiError.message
        return false
      }
      // refresh() doesn't throw; a draft that was saved but still can't be read stays in query.error.
      await query.refresh()
      if (query.error.value) {
        error.value = `Saved, but reloading the draft failed (${errorDetail(query.error.value)})`
        return false
      }
      toast.add({ title: 'CV reset to your profile', icon: 'i-lucide-rotate-ccw' })
      return true
    } catch (e) {
      // This is the last-resort path, so the technical detail is shown to make the failure diagnosable.
      error.value = `${ERROR_MESSAGES.generic} while ${step} (${errorDetail(e)})`
      return false
    } finally {
      resetting.value = false
    }
  }
  return { reset, resetting, error }
}

export const useCopyTailoredCv = () => {
  const { copy } = useCopyAsText('CV')
  const toastSuccess = useSuccessToast()
  return async (cv: TailoredCv) => {
    if (await copy(tailoredCvToText(cv))) toastSuccess('CV copied as text')
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
  // The template the entries were last written for (loaded draft, then each whole-CV AI run), so
  // the page can ask for a new run after the owner switches.
  const writtenTemplate = ref<TailoredCv['template']>()

  const dirty = computed(() => !!cv.value && snapshot(cv.value) !== saved.value)
  // First creation (nothing saved, nothing edited): AI output fills the candidate directly.
  // Otherwise it waits as a suggestion, so the owner's work is never replaced silently.
  const fillsDirectly = () => !draft.value && !!cv.value && snapshot(cv.value) === seed.value

  // The profile as a candidate in the chosen language; a new CV starts in the posting's language.
  const fromProfile = (
    source: ProfileData,
    language: Language = cv.value?.language ?? postingLanguage.value ?? 'ENGLISH'
  ) => tailoredCvFromProfile(source, language)
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
    seed.value = snapshot(cv.value)
    saved.value = savedSnapshot
    writtenTemplate.value = cv.value.template
    return !draft.value
  }

  // Starts over from the profile, built by the API (translations, language, standard layout), in
  // the current language or the one the owner switches to. Nothing is saved: the old draft stays
  // until the owner saves, so leaving or reloading brings it back.
  // Returns an error message, or null once the editor holds the new candidate.
  const resetting = ref(false)
  const reset = async (language = cv.value?.language): Promise<string | null> => {
    resetting.value = true
    try {
      const { tailoredCvDraftFromProfile } = await gql(FROM_PROFILE, { listingId, language })
      if (!tailoredCvDraftFromProfile) return 'This listing no longer exists.'
      // The API returns defaults for the three toggles, so the owner's choices stay.
      const { contentStyle, sectionOrder, template, referencesOnRequest } = cv.value ?? {}
      const fresh = tailoredCvFromContent(tailoredCvDraftFromProfile)
      cv.value = {
        ...fresh,
        contentStyle: contentStyle ?? fresh.contentStyle,
        sectionOrder: sectionOrder ?? fresh.sectionOrder,
        template: template ?? fresh.template,
        referencesOnRequest: referencesOnRequest ?? fresh.referencesOnRequest
      }
      seed.value = snapshot(cv.value)
      suggestions.value = []
      sectionErrors.value = {}
      sectionDetails.value = {}
      return null
    } catch (e) {
      return genericError(e)
    } finally {
      resetting.value = false
    }
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

  // The API's own order: work experience first, then education and projects, then skills to match
  // them, and the summary last. Entries removed from this CV are skipped, so they don't come back.
  const steps = (): AnalysisStep[] => {
    const kept = <T extends { id: number }>(
      entries: readonly T[] | undefined,
      list: readonly { sourceEntryId?: number | null }[] | undefined
    ) => (entries ?? []).filter((e) => list?.some((c) => c.sourceEntryId === e.id))
    const experiences = kept(profile.value?.experiences, cv.value?.experiences)
    const educations = kept(profile.value?.educations, cv.value?.educations)
    const projects = kept(profile.value?.projects, cv.value?.projects)
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
      ...projects.map((p, i) => ({
        key: `project:${p.id}` as const,
        label: `Analyzing project ${i + 1} of ${projects.length}`,
        section: 'PROJECT' as const,
        sourceEntryId: p.id
      })),
      { key: 'skills', label: 'Analyzing skills', section: 'SKILLS', sourceEntryId: null },
      { key: 'summary', label: 'Writing the summary', section: 'SUMMARY', sourceEntryId: null }
    ]
  }

  // A failed or skipped section keeps its content and shows why; the caller moves on to the next
  // one. 'stop' means every later section would fail the same way, so the caller stops: the
  // saved model is gone (the list is already refetched) or the API's AI safeguards refused.
  const runStep = async (
    step: AnalysisStep,
    direct: boolean
  ): Promise<'ok' | 'failed' | 'stop'> => {
    sectionErrors.value = { ...sectionErrors.value, [step.key]: undefined }
    sectionDetails.value = { ...sectionDetails.value, [step.key]: undefined }
    try {
      const input = {
        listingId,
        section: step.section,
        sourceEntryId: step.sourceEntryId,
        template: cv.value?.template,
        language: cv.value?.language
      }
      const { result, errors } = await attempt(
        input,
        async (requestId) =>
          (await gql(ANALYZE, { input: { ...input, requestId } })).analyzeTailoredCvSection
      )
      if (isUnknownModel(errors)) {
        sectionErrors.value[step.key] = errors![0]!.message
        await llm.refresh()
        return 'stop'
      }
      if (aiSafetyCode(errors)) {
        sectionErrors.value[step.key] = errors![0]!.message
        return 'stop'
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
        return 'failed'
      }
      offer(value.key, value.value, direct)
      // The summary step may suggest a headline too; null keeps the current one.
      if (result?.headline) offer('headline', result.headline, direct)
      return 'ok'
    } catch (e) {
      sectionErrors.value[step.key] = ERROR_MESSAGES.generic
      sectionDetails.value[step.key] = errorDetail(e)
      return 'failed'
    }
  }

  // The same sequence analyzeAllTailoredCv runs, but one request per section, so progress is real
  // and each result lands as soon as it's back.
  const analyzeAll = async () => {
    const direct = fillsDirectly()
    const all = steps()
    const template = cv.value?.template
    let wrote = false
    analyzing.value = true
    try {
      for (const [i, step] of all.entries()) {
        progress.value = { label: step.label, step: i + 1, total: all.length }
        const outcome = await runStep(step, direct)
        wrote ||= outcome === 'ok'
        if (outcome === 'stop') break
      }
      // A run that wrote nothing leaves the entries in the old style, so the nudge stays.
      if (wrote) writtenTemplate.value = template
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

  // The template and language the shown prompt was written for; the pasted reply is previewed with
  // the same ones.
  const promptTemplate = ref<TailoredCv['template']>()
  const promptLanguage = ref<Language>()
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => {
      // A switch while the request is out fetches again, so the prompt never trails the choice.
      let template
      let language
      let text
      do {
        template = cv.value?.template
        language = cv.value?.language
        text = (await gql(PROMPT, { listingId, template, language })).tailoredCvExternalPrompt
          .instructions
      } while (template !== cv.value?.template || language !== cv.value?.language)
      promptTemplate.value = template
      promptLanguage.value = language
      return text
    }
  )
  // A prompt already on screen is fetched again, so the copied text matches the new template or
  // language. One loaded before the draft went out without a template, which the API reads as
  // Detailed, and without a language, which it reads as the saved draft's.
  watch(
    () => [cv.value?.template, cv.value?.language] as const,
    ([template, language]) => {
      const changed =
        template !== (promptTemplate.value ?? 'DETAILED') ||
        (!!promptLanguage.value && language !== promptLanguage.value)
      if (instructions.value && !promptLoading.value && changed) void loadPrompt()
    }
  )
  // Returns the API's error to show next to the pasted JSON, or null when the reply was taken in.
  const previewing = ref(false)
  // `scope` takes one section from the reply: the API has a single whole-CV prompt.
  const preview = async (json: string, scope?: TailoredCvSectionKey): Promise<string | null> => {
    if (!cv.value) return null
    previewing.value = true
    try {
      const language = promptLanguage.value ?? cv.value.language
      const { previewTailoredCvDraft } = await gql(PREVIEW, {
        input: {
          listingId,
          json: json.trim(),
          template: promptTemplate.value ?? cv.value.template,
          language
        }
      })
      const { candidate, errors } = previewTailoredCvDraft
      if (!candidate) return errors?.[0]?.message ?? ERROR_MESSAGES.generic
      const next = mergeExternalCandidate(cv.value, tailoredCvFromContent(candidate.content))
      next.language = language
      if (scope) {
        const value = getCvSection(next, scope)
        if (value === undefined) return 'The reply has nothing for this section.'
        offer(scope, value, fillsDirectly())
      } else {
        writtenTemplate.value = promptTemplate.value ?? cv.value.template
        if (fillsDirectly()) {
          cv.value = next
          suggestions.value = []
        } else {
          for (const { key, value } of changedCvSections(cv.value, next)) offer(key, value, false)
        }
      }
      return null
    } catch (e) {
      return genericError(e)
    } finally {
      previewing.value = false
    }
  }

  const toastSuccess = useSuccessToast()
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
    toastSuccess('Draft saved')
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
    resetting,
    suggestions,
    sectionErrors,
    sectionDetails,
    accept,
    dismiss,
    analyzing,
    analyzingKey,
    progress,
    writtenTemplate,
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
