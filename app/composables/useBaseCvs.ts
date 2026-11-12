import type { ResultOf } from 'gql.tada'
import { CV_CONTENT_FIELDS } from '~/composables/cvContentFields'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { Language } from '~/constants/listing'
import type { TailoredCv, TailoredCvSectionKey } from '~/utils/tailoredCv'

// CV templates are the API's base CVs: a reusable CV in one or more languages, each with its own
// numbered, immutable versions. "Template" in the content (DETAILED/CONCISE) is the CV style.

export const BASE_CV_LIST = graphql(`
  query BaseCvs($archived: Boolean!) {
    baseCvs(archived: $archived) {
      id
      name
      description
      languages
      archivedAt
      updatedAt
      versions {
        id
        language
        number
        note
        createdAt
      }
    }
  }
`)

const BASE_CV_FIELDS = graphql(
  `
    fragment BaseCvFields on BaseCv {
      id
      name
      description
      languages
      archivedAt
      versions {
        id
        language
        number
        note
        createdAt
      }
      # Both languages' latest content in one request, so switching tabs needs no fetch.
      english: latestVersion(language: ENGLISH) {
        id
        content {
          ...TailoredCvContentFields
        }
      }
      norwegian: latestVersion(language: NORWEGIAN) {
        id
        content {
          ...TailoredCvContentFields
        }
      }
    }
  `,
  [CV_CONTENT_FIELDS]
)

// The API has no single-template query, so the editor reads both lists in one request and picks
// its template; there are only a handful, but each brings its latest content.
const BASE_CV_PAGE = graphql(
  `
    query BaseCvPage {
      active: baseCvs(archived: false) {
        ...BaseCvFields
      }
      archived: baseCvs(archived: true) {
        ...BaseCvFields
      }
    }
  `,
  [BASE_CV_FIELDS]
)

const FROM_PROFILE = graphql(
  `
    query BaseCvFromProfile($language: Language!) {
      baseCvFromProfile(language: $language) {
        ...TailoredCvContentFields
      }
    }
  `,
  [CV_CONTENT_FIELDS]
)

// Unsaved: a template's latest version in another language, with profile-sourced text translated.
// `untranslatedFields` are content paths still in the source language (`experiences[0].bullets[2]`).
const TRANSLATION = graphql(
  `
    query BaseCvTranslation($baseCvId: Int!, $language: Language!) {
      baseCvTranslation(baseCvId: $baseCvId, language: $language) {
        fromLanguage
        untranslatedFields
        content {
          ...TailoredCvContentFields
        }
      }
    }
  `,
  [CV_CONTENT_FIELDS]
)

// The own-AI draft: a prompt written for a target role, and the AI's reply as unsaved content.
// Only the prompt takes the role and notes; a bad one is a top-level GraphQL error, not `errors`.
export const BASE_CV_EXTERNAL_PROMPT = graphql(`
  query BaseCvExternalPrompt(
    $language: Language!
    $targetRole: String!
    $notes: String
    $template: TailoredCvTemplate
    $rewrite: Boolean!
  ) {
    baseCvExternalPrompt(
      language: $language
      targetRole: $targetRole
      notes: $notes
      template: $template
      rewrite: $rewrite
    ) {
      instructions
    }
  }
`)

export const PREVIEW_BASE_CV = graphql(
  `
    mutation PreviewBaseCv($input: PreviewBaseCvInput!) {
      previewBaseCv(input: $input) {
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

export const CREATE_BASE_CV = graphql(`
  mutation CreateBaseCv($input: CreateBaseCvInput!) {
    createBaseCv(input: $input) {
      baseCv {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
        ... on DuplicateBaseCvError {
          existingBaseCvId
        }
      }
    }
  }
`)

export const UPDATE_BASE_CV = graphql(`
  mutation UpdateBaseCv($input: UpdateBaseCvInput!) {
    updateBaseCv(input: $input) {
      baseCv {
        id
        name
        description
      }
      errors {
        __typename
        ... on Error {
          message
        }
        ... on DuplicateBaseCvError {
          existingBaseCvId
        }
      }
    }
  }
`)

const SAVE_VERSION = graphql(
  `
    mutation SaveBaseCvVersion($input: SaveBaseCvVersionInput!) {
      saveBaseCvVersion(input: $input) {
        baseCvVersion {
          id
          number
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

const SET_ARCHIVED = graphql(`
  mutation SetBaseCvArchived($input: SetBaseCvArchivedInput!) {
    setBaseCvArchived(input: $input) {
      baseCv {
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

const DELETE_BASE_CV = graphql(`
  mutation DeleteBaseCv($input: DeleteBaseCvInput!) {
    deleteBaseCv(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

export const GENERATE_BASE_CV_DOCUMENT = graphql(`
  mutation GenerateBaseCvDocument($listingId: Int!, $baseCvVersionId: Int!) {
    generateBaseCvDocument(input: { listingId: $listingId, baseCvVersionId: $baseCvVersionId }) {
      document {
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

export type BaseCvListItem = ResultOf<typeof BASE_CV_LIST>['baseCvs'][number]
export type BaseCv = ResultOf<typeof BASE_CV_FIELDS>
type BaseCvVersion = BaseCvListItem['versions'][number]

// Short code for a language, as in "Frontend (NO) v3".
export const languageCode = (language: Language) => (language === 'NORWEGIAN' ? 'NO' : 'EN')

// Versions are numbered per language and come newest first, so a language's first is its latest.
export const versionsIn = (versions: BaseCvVersion[], language: Language) =>
  versions.filter((v) => v.language === language)
export const latestIn = (versions: BaseCvVersion[], language: Language) =>
  versions.find((v) => v.language === language)

const LANGUAGE_PARAMS: Record<string, Language> = { en: 'ENGLISH', no: 'NORWEGIAN' }
export const languageParam = (language: Language) => languageCode(language).toLowerCase()
export const languageFromParam = (param: unknown): Language | undefined =>
  LANGUAGE_PARAMS[String(param)]

export const baseCvPdfUrl = (versionId: number) => `/api/base-cv-versions/${versionId}/pdf`

// The profile as CV content in a template's language, built by the API (translations, layout).
export const baseCvFromProfile = async (language: Language) =>
  tailoredCvFromContent((await gql(FROM_PROFILE, { language })).baseCvFromProfile)

const snapshot = (cv: TailoredCv) => JSON.stringify(cv)

// The editor's state for one template, or for a new one (`'new'`) that exists only here until it's
// created. A saved template has the language being edited (`?lang=en|no`), its editable content, and
// saves it as that language's next version. A new language is an unsaved draft until its first save:
// a translation (`flagged` lists what's still in the source language) or the profile in that language
// for an AI draft. AI replies come in as suggestions against what the editor holds.
export const useBaseCvEditor = (id: number | 'new', initialLanguage: Language = 'ENGLISH') => {
  const isNew = id === 'new'
  const route = useRoute()
  const router = useRouter()
  const query = useAsyncData(`base-cv-${id}`, () => gql(BASE_CV_PAGE), {
    server: false,
    immediate: !isNew
  })
  const baseCv = computed(
    () =>
      [...(query.data.value?.active ?? []), ...(query.data.value?.archived ?? [])].find(
        (b) => b.id === id
      ) ?? null
  )
  // A new template's language is picked on its page; a saved one's is seeded from the URL once,
  // then set by the tabs, and the URL only follows, so a refresh or Back returns to it. A language
  // the template doesn't have falls back to its first one.
  const newLanguage = ref<Language>(initialLanguage)
  const selected = ref<Language | undefined>(languageFromParam(route.query.lang))
  const language = computed<Language | undefined>(() =>
    isNew
      ? newLanguage.value
      : draft.value
        ? draft.value.language
        : selected.value && baseCv.value?.languages.includes(selected.value)
          ? selected.value
          : baseCv.value?.languages[0]
  )
  const latestContent = (value: BaseCv, lang: Language) =>
    (lang === 'NORWEGIAN' ? value.norwegian : value.english)?.content
  const latest = computed(() =>
    baseCv.value && language.value ? latestIn(baseCv.value.versions, language.value) : undefined
  )

  // `fromLanguage` is set for a translation; an AI-drafted language starts from the profile.
  const draft = ref<{ language: Language; fromLanguage?: Language }>()
  const flagged = ref<string[]>([])
  // The profile in the language being edited: what the Add menus offer back. The editor works
  // without. Hidden while a language switch is loading, so nothing is added in the old language.
  const sourceQuery = useAsyncData(
    `base-cv-source-${id}`,
    () => (language.value ? baseCvFromProfile(language.value) : Promise.resolve(null)),
    { server: false, watch: [language] }
  )
  const source = computed(() =>
    sourceQuery.status.value === 'success' ? sourceQuery.data.value : undefined
  )
  const cv = ref<TailoredCv>()
  const saved = ref('')
  // A new template and a draft language are unsaved until their first version, even unedited.
  const dirty = computed(
    () => !!cv.value && (isNew || !!draft.value || snapshot(cv.value) !== saved.value)
  )
  const suggestions = ref<{ key: TailoredCvSectionKey; value: unknown }[]>([])
  const clearState = () => {
    flagged.value = []
    invalidContent.value = undefined
    aiDrafted.value = false
    suggestions.value = []
  }
  const load = (next: TailoredCv) => {
    cv.value = next
    saved.value = snapshot(next)
  }
  const loadLatest = (lang: Language) => {
    const content = baseCv.value && latestContent(baseCv.value, lang)
    if (content) load(tailoredCvFromContent(content))
  }
  // Built once from the latest version; later refetches (versions list, details) keep the edits.
  watch(
    baseCv,
    (value) => {
      if (value && !cv.value && language.value) loadLatest(language.value)
    },
    { immediate: true }
  )

  const setParam = (lang: Language) =>
    router.replace({ query: { ...route.query, lang: languageParam(lang) } })
  // The page confirms first when there are unsaved edits; switching drops them and any draft.
  const switchTo = (lang: Language) => {
    draft.value = undefined
    clearState()
    selected.value = lang
    setParam(lang)
    loadLatest(lang)
  }

  const notify = useAppToast()
  const translating = ref(false)
  // Returns false when the API has nothing to translate from (no version in another language).
  const addLanguage = async (lang: Language) => {
    if (isNew) return false
    translating.value = true
    try {
      const { baseCvTranslation } = await gql(TRANSLATION, { baseCvId: id, language: lang })
      if (!baseCvTranslation) {
        notify.warning('Save a version in another language first')
        return false
      }
      draft.value = { language: lang, fromLanguage: baseCvTranslation.fromLanguage }
      clearState()
      flagged.value = baseCvTranslation.untranslatedFields
      load(tailoredCvFromContent(baseCvTranslation.content))
      selected.value = lang
      setParam(lang)
      return true
    } catch {
      notify.error(ERROR_MESSAGES.generic)
      return false
    } finally {
      translating.value = false
    }
  }

  // The profile in the editing language as unsaved content, keeping the owner's layout choices
  // when there is content already (the API returns defaults for them). Also what an AI draft is
  // compared against on a new template or language.
  const loadingProfile = ref(false)
  const startFromProfile = async (lang = language.value) => {
    if (!lang) return false
    loadingProfile.value = true
    try {
      const fresh = await baseCvFromProfile(lang)
      cv.value = cv.value ? withLayoutFrom(fresh, cv.value) : fresh
      clearState()
      return true
    } catch {
      notify.error(ERROR_MESSAGES.generic)
      return false
    } finally {
      loadingProfile.value = false
    }
  }
  // A missing language to draft with AI: the profile in that language, unsaved until its first save.
  const startLanguage = async (lang: Language) => {
    if (!(await startFromProfile(lang))) return false
    draft.value = { language: lang }
    selected.value = lang
    setParam(lang)
    return true
  }

  // An AI draft loaded as is, for the owner to check before saving. `saved` stays as it was, so it
  // counts as unsaved. The preview already filled the contact fields; the layout stays the owner's.
  const aiDrafted = ref(false)
  const replaceContent = (next: TailoredCv) => {
    const { sectionOrder, referencesOnRequest } = cv.value!
    cv.value = { ...next, sectionOrder, referencesOnRequest }
    clearState()
    aiDrafted.value = true
  }
  // An AI reply as suggestions, an entry (company) at a time where it pairs up; loaded as is when
  // there's nothing to compare against. Returns the number of suggestions.
  const offerReply = (next: TailoredCv) => {
    const current = cv.value
    const empty =
      !current ||
      ![current.experiences, current.educations, current.projects, current.skills].some(
        (list) => list.length
      )
    if (empty) {
      replaceContent(next)
      return 0
    }
    // Contact details and layout stay as they are; the reply has none of its own.
    suggestions.value = changedCvSections(current, mergeExternalCandidate(current, next))
    invalidContent.value = undefined
    aiDrafted.value = false
    return suggestions.value.length
  }
  const accept = (key: TailoredCvSectionKey) => {
    const suggestion = suggestions.value.find((s) => s.key === key)
    if (suggestion && cv.value) setCvSection(cv.value, key, suggestion.value)
    dismiss(key)
  }
  const dismiss = (key: TailoredCvSectionKey) => {
    suggestions.value = suggestions.value.filter((s) => s.key !== key)
  }
  const acceptAll = () => {
    for (const { key } of [...suggestions.value]) accept(key)
  }
  const dismissAll = () => {
    suggestions.value = []
  }

  // A deleted profile bullet or entry the content still points at; reloading from the profile
  // clears it, so the page offers that instead of a toast.
  const invalidContent = ref<string>()
  const saving = ref(false)
  // Saves the language being edited as its next version and returns its number and whether it's
  // new: unchanged content returns the latest version. Pending suggestions stay to review.
  const save = async (note: string) => {
    if (!cv.value || !baseCv.value || !language.value) return null
    const lang = language.value
    const before = latest.value?.number ?? 0
    saving.value = true
    invalidContent.value = undefined
    try {
      const { saveBaseCvVersion } = await gql(SAVE_VERSION, {
        input: {
          baseCvId: baseCv.value.id,
          language: lang,
          content: toTailoredCvInput(cv.value),
          note: note.trim() || null
        }
      })
      const error = saveBaseCvVersion.errors?.[0]
      if (error) {
        if (error.__typename === 'InvalidTailoredCvDraftError') invalidContent.value = error.message
        else notify.error(error.message)
        return null
      }
      const version = saveBaseCvVersion.baseCvVersion!
      // Back from the API in its normalized form (blank fields and empty bullets dropped).
      load(tailoredCvFromContent(version.content))
      await query.refresh()
      draft.value = undefined
      flagged.value = []
      aiDrafted.value = false
      return {
        id: version.id,
        number: version.number,
        language: lang,
        isNew: version.number > before
      }
    } catch {
      notify.error(ERROR_MESSAGES.generic)
      return null
    } finally {
      saving.value = false
    }
  }

  // A new template: created with the content as v1 of its language. A duplicate name is reported
  // for the name field.
  const create = async (
    name: string,
    description: string | null
  ): Promise<{ id: number } | { error: string; duplicate: boolean; existingId?: number }> => {
    saving.value = true
    invalidContent.value = undefined
    try {
      const { createBaseCv } = await gql(CREATE_BASE_CV, {
        input: {
          name,
          description,
          language: language.value!,
          content: toTailoredCvInput(cv.value!)
        }
      })
      const error = createBaseCv.errors?.[0]
      if (!error) return { id: createBaseCv.baseCv!.id }
      if (error.__typename === 'InvalidTailoredCvDraftError') invalidContent.value = error.message
      return {
        error: error.message,
        duplicate: error.__typename === 'DuplicateBaseCvError',
        existingId: error.__typename === 'DuplicateBaseCvError' ? error.existingBaseCvId : undefined
      }
    } catch (e) {
      return { error: genericError(e), duplicate: false }
    } finally {
      saving.value = false
    }
  }

  return {
    isNew,
    query,
    baseCv,
    language,
    newLanguage,
    latest,
    source,
    draft,
    flagged,
    switchTo,
    addLanguage,
    startLanguage,
    translating,
    cv,
    dirty,
    save,
    create,
    saving,
    invalidContent,
    startFromProfile,
    loadingProfile,
    aiDrafted,
    replaceContent,
    suggestions,
    offerReply,
    accept,
    dismiss,
    acceptAll,
    dismissAll
  }
}
export type BaseCvEditor = ReturnType<typeof useBaseCvEditor>

// Archive and delete, shared by the list and the editor. Delete reports 'in-use' when a version was
// already sent, since the API then only allows archiving.
export const useBaseCvActions = () => {
  const { run, loading } = useMutation()
  const notify = useAppToast()
  const setArchived = (id: number, isArchived: boolean) =>
    run(async () => {
      const { setBaseCvArchived } = await gql(SET_ARCHIVED, { input: { id, isArchived } })
      return setBaseCvArchived.errors
    })
  const deleting = ref(false)
  const remove = async (id: number): Promise<'deleted' | 'in-use' | 'failed'> => {
    deleting.value = true
    try {
      const { deleteBaseCv } = await gql(DELETE_BASE_CV, { input: { id } })
      const error = deleteBaseCv.errors?.[0]
      if (!error) return 'deleted'
      if (error.__typename === 'BaseCvInUseError') return 'in-use'
      notify.error(error.message)
      return 'failed'
    } catch {
      notify.error(ERROR_MESSAGES.generic)
      return 'failed'
    } finally {
      deleting.value = false
    }
  }
  return { setArchived, archiving: loading, remove, deleting }
}
