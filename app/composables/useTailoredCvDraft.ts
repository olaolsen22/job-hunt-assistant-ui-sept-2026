import type { ResultOf, VariablesOf } from 'gql.tada'
import { useTailoredCvOwnAi } from '~/composables/useTailoredCvOwnAi'
import { useTailoredCvPdf } from '~/composables/useTailoredCvPdf'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { TailoredCv, TailoredCvSectionKey } from '~/utils/tailoredCv'

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
  const notify = useAppToast()
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
      notify.success('CV reset to your profile', { icon: 'i-lucide-rotate-ccw' })
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

// The button shows `copied`, so a working copy needs no toast.
export const useCopyTailoredCv = () => {
  const { copied, copy } = useCopyAsText('CV')
  return { copied, copy: (cv: TailoredCv) => copy(tailoredCvToText(cv)) }
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
  // An own-AI reply's entry the CV doesn't have, or its new entry order (see changedCvSections).
  kind?: 'add' | 'order'
}

const snapshot = (cv: TailoredCv) => JSON.stringify(cv)

// The editor's state: the editable candidate, AI suggestions waiting for Accept/Dismiss, per-section
// errors, analysis progress and save. Nothing reaches the API's draft until save().
export const useTailoredCvDraft = (listingId: number) => {
  const query = useTailoredCvDraftQuery(listingId)
  const llm = useLlmModels()
  const { attempt, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const draft = query.data
  // The profile as this CV's content, built by the API (translations, order, language: the saved
  // draft's, else the posting's, else English). What a new CV starts from, what Reset returns to and
  // what the Add menus offer back. Started with the draft, so a saved CV doesn't wait for it.
  const sourceQuery = useAsyncData(
    `tailored-cv-source-${listingId}`,
    () => gql(FROM_PROFILE, { listingId }).then((r) => r.tailoredCvDraftFromProfile),
    { server: false }
  )
  const source = computed(() =>
    sourceQuery.data.value ? tailoredCvFromContent(sourceQuery.data.value) : undefined
  )
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
  // No draft and no edits yet: the candidate is just the profile, so "unsaved" would blame the owner.
  const pristine = computed(() => !draft.value && !!cv.value && snapshot(cv.value) === seed.value)
  // Reset keeps the owner's layout choices, so they don't count as a difference.
  const matchesProfile = computed(
    () =>
      !!cv.value &&
      !!source.value &&
      snapshot(cv.value) === snapshot(withLayoutFrom(source.value, cv.value))
  )

  // Builds the candidate once the draft is in, and with no draft the source too. Returns true for a
  // new candidate.
  const init = () => {
    if (query.status.value !== 'success') return false
    const savedCv = draft.value ? tailoredCvFromContent(draft.value.content) : undefined
    const start = savedCv ?? source.value
    if (!start) return false
    cv.value = cloneCv(start)
    seed.value = snapshot(cv.value)
    saved.value = savedCv ? seed.value : null
    writtenTemplate.value = cv.value.template
    return !draft.value
  }

  // Starts over from the profile, in the current language or the one the owner switches to. Nothing
  // is saved: the old draft stays until the owner saves, so leaving or reloading brings it back.
  // Returns an error message, or null once the editor holds the new candidate.
  const resetting = ref(false)
  const reset = async (language = cv.value?.language): Promise<string | null> => {
    resetting.value = true
    try {
      const { tailoredCvDraftFromProfile } = await gql(FROM_PROFILE, { listingId, language })
      if (!tailoredCvDraftFromProfile) return 'This listing no longer exists.'
      sourceQuery.data.value = tailoredCvDraftFromProfile
      const fresh = cloneCv(tailoredCvFromContent(tailoredCvDraftFromProfile))
      cv.value = cv.value ? withLayoutFrom(fresh, cv.value) : fresh
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

  // AI output always waits as a suggestion, even on a new CV, so nothing changes unseen.
  // A change only in what the CV doesn't show (an entry's paragraph while it prints bullets) isn't
  // offered: there would be nothing to review.
  const shown = (key: TailoredCvSectionKey, value: unknown) =>
    JSON.stringify(
      key.includes(':') && value
        ? cv.value?.contentStyle === 'PARAGRAPH'
          ? { ...(value as object), bullets: null }
          : { ...(value as object), paragraph: null }
        : value
    )
  const offer = (
    key: TailoredCvSectionKey,
    value: unknown,
    kind?: TailoredCvSuggestion['kind']
  ) => {
    if (!cv.value) return
    suggestions.value = suggestions.value.filter((s) => s.key !== key)
    if (kind === 'order' || shown(key, getCvSection(cv.value, key)) !== shown(key, value))
      suggestions.value.push({ key, value, ...(kind && { kind }) })
  }
  // Saving waits until every suggestion is accepted or kept, so a draft never holds half a review.
  const reviewing = computed(() => suggestions.value.length > 0)
  // An entry removed from the CV (its menu, or Undo of an add) takes its pending suggestion with it,
  // or the review could never finish and Accept would bring the entry back.
  watch(
    () =>
      cv.value &&
      [cv.value.experiences, cv.value.educations, cv.value.projects]
        .map((list) => list.map((e) => e.sourceEntryId).join())
        .join('|'),
    () => {
      const current = cv.value
      if (!current) return
      // An added entry isn't in the CV until it's accepted.
      const kept = suggestions.value.filter(
        (s) =>
          s.kind === 'add' || !s.key.includes(':') || getCvSection(current, s.key) !== undefined
      )
      if (kept.length !== suggestions.value.length) suggestions.value = kept
    }
  )

  const accept = (key: TailoredCvSectionKey) => {
    const suggestion = suggestions.value.find((s) => s.key === key)
    if (suggestion && cv.value) {
      if (suggestion.kind === 'order')
        orderCvEntries(cv.value, key as CvAnalyzedList, suggestion.value as number[])
      else setCvSection(cv.value, key, suggestion.value)
    }
    dismiss(key)
  }

  const dismiss = (key: TailoredCvSectionKey) => {
    suggestions.value = suggestions.value.filter((s) => s.key !== key)
  }

  // The API's own order: work experience first, then education and projects, then skills to match
  // them, and the summary last. Entries removed from this CV are skipped, so they don't come back.
  const steps = (): AnalysisStep[] => {
    const kept = (list: 'experiences' | 'educations' | 'projects') =>
      (source.value?.[list] ?? [])
        .map((e) => e.sourceEntryId)
        .filter((id): id is number => !!cv.value?.[list].some((c) => c.sourceEntryId === id))
    const experiences = kept('experiences')
    const educations = kept('educations')
    const projects = kept('projects')
    return [
      ...experiences.map((id, i) => ({
        key: `experience:${id}` as const,
        label: `Analyzing experience ${i + 1} of ${experiences.length}`,
        section: 'EXPERIENCE' as const,
        sourceEntryId: id
      })),
      ...educations.map((id, i) => ({
        key: `education:${id}` as const,
        label: `Analyzing education ${i + 1} of ${educations.length}`,
        section: 'EDUCATION' as const,
        sourceEntryId: id
      })),
      ...projects.map((id, i) => ({
        key: `project:${id}` as const,
        label: `Analyzing project ${i + 1} of ${projects.length}`,
        section: 'PROJECT' as const,
        sourceEntryId: id
      })),
      { key: 'skills', label: 'Analyzing skills', section: 'SKILLS', sourceEntryId: null },
      { key: 'summary', label: 'Writing the summary', section: 'SUMMARY', sourceEntryId: null }
    ]
  }

  // A failed or skipped section keeps its content and shows why; the caller moves on to the next
  // one. 'stop' means every later section would fail the same way, so the caller stops: the
  // saved model is gone (the list is already refetched) or the API's AI safeguards refused.
  const runStep = async (step: AnalysisStep): Promise<'ok' | 'failed' | 'stop'> => {
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
        result && source.value && cv.value
          ? cvSectionFromAnalysis(cv.value, source.value, result)
          : null
      if (!value) {
        const message = errors?.[0]?.message ?? result?.error ?? ERROR_MESSAGES.generic
        sectionErrors.value[step.key] = result?.errorCode
          ? `${message} (${result.errorCode})`
          : message
        return 'failed'
      }
      offer(value.key, value.value)
      // The summary step may suggest a headline too; null keeps the current one.
      if (result?.headline) offer('headline', result.headline)
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
    const all = steps()
    const template = cv.value?.template
    let wrote = false
    analyzing.value = true
    try {
      for (const [i, step] of all.entries()) {
        progress.value = { label: step.label, step: i + 1, total: all.length }
        const outcome = await runStep(step)
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
      await runStep(step)
    } finally {
      analyzingKey.value = undefined
    }
  }

  const { success: toastSuccess } = useAppToast()
  const { run, loading: saving } = useMutation()
  const save = async () => {
    if (!cv.value || reviewing.value) return false
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

  const ownAi = useTailoredCvOwnAi({
    listingId,
    cv,
    writtenTemplate,
    offer
  })
  const pdf = useTailoredCvPdf({ listingId, cv, draft, saved, dirty, reviewing, save })

  return {
    query,
    draft,
    sourceQuery,
    source,
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
    reviewing,
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
    saving,
    save,
    ...ownAi,
    ...pdf
  }
}
