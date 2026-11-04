import type { ResultOf } from 'gql.tada'
import { CV_CONTENT_FIELDS } from '~/composables/useTailoredCvDraft'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { Language } from '~/constants/listing'
import type { TailoredCv } from '~/utils/tailoredCv'

// CV templates are the API's base CVs: a reusable CV in one language whose saves are numbered,
// immutable versions. "Template" in the content (DETAILED/CONCISE) is the CV style, not this.

export const BASE_CV_LIST = graphql(`
  query BaseCvs($archived: Boolean!) {
    baseCvs(archived: $archived) {
      id
      name
      description
      language
      archivedAt
      updatedAt
      latestVersion {
        id
        number
      }
      versions {
        id
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
      language
      archivedAt
      latestVersion {
        id
        number
        content {
          ...TailoredCvContentFields
        }
      }
      versions {
        id
        number
        note
        createdAt
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

export const baseCvPdfUrl = (versionId: number) => `/api/base-cv-versions/${versionId}/pdf`

// The profile as CV content in a template's language, built by the API (translations, layout).
export const baseCvFromProfile = async (language: Language) =>
  tailoredCvFromContent((await gql(FROM_PROFILE, { language })).baseCvFromProfile)

const snapshot = (cv: TailoredCv) => JSON.stringify(cv)

// The editor page's state: the template, its editable content, and saving it as the next version.
export const useBaseCvEditor = (id: number) => {
  const query = useAsyncData(`base-cv-${id}`, () => gql(BASE_CV_PAGE), { server: false })
  const baseCv = computed(
    () =>
      [...(query.data.value?.active ?? []), ...(query.data.value?.archived ?? [])].find(
        (b) => b.id === id
      ) ?? null
  )
  const cv = ref<TailoredCv>()
  const saved = ref('')
  const dirty = computed(() => !!cv.value && snapshot(cv.value) !== saved.value)
  const load = (next: TailoredCv) => {
    cv.value = next
    saved.value = snapshot(next)
  }
  // Built once from the latest version; later refetches (versions list, details) keep the edits.
  watch(
    baseCv,
    (value) => {
      if (value && !cv.value) load(tailoredCvFromContent(value.latestVersion.content))
    },
    { immediate: true }
  )

  // A deleted profile bullet or entry the content still points at; reloading from the profile
  // clears it, so the page offers that instead of a toast.
  const invalidContent = ref<string>()
  const saving = ref(false)
  const toast = useToast()
  // Returns the version number and whether it's new: unchanged content returns the latest version.
  const save = async (note: string) => {
    if (!cv.value || !baseCv.value) return null
    const before = baseCv.value.latestVersion.number
    saving.value = true
    invalidContent.value = undefined
    try {
      const { saveBaseCvVersion } = await gql(SAVE_VERSION, {
        input: { baseCvId: id, content: toTailoredCvInput(cv.value), note: note.trim() || null }
      })
      const error = saveBaseCvVersion.errors?.[0]
      if (error) {
        if (error.__typename === 'InvalidTailoredCvDraftError') invalidContent.value = error.message
        else toast.add({ title: error.message, color: 'error' })
        return null
      }
      const version = saveBaseCvVersion.baseCvVersion!
      // Back from the API in its normalized form (blank fields and empty bullets dropped).
      load(tailoredCvFromContent(version.content))
      await query.refresh()
      return { number: version.number, isNew: version.number > before }
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
      return null
    } finally {
      saving.value = false
    }
  }

  // Unsaved, like the tailored CV's reset: the latest version stays until the owner saves. The
  // three layout choices stay the owner's; the API returns defaults for them.
  const reloading = ref(false)
  const reloadFromProfile = async () => {
    if (!cv.value || !baseCv.value) return false
    reloading.value = true
    try {
      const fresh = await baseCvFromProfile(baseCv.value.language)
      const { contentStyle, sectionOrder, template, referencesOnRequest } = cv.value
      cv.value = { ...fresh, contentStyle, sectionOrder, template, referencesOnRequest }
      invalidContent.value = undefined
      return true
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
      return false
    } finally {
      reloading.value = false
    }
  }

  return {
    query,
    baseCv,
    cv,
    dirty,
    save,
    saving,
    invalidContent,
    reloadFromProfile,
    reloading
  }
}

// Archive and delete, shared by the list and the editor. Delete reports 'in-use' when a version was
// already sent, since the API then only allows archiving.
export const useBaseCvActions = () => {
  const { run, loading } = useMutation()
  const toast = useToast()
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
      toast.add({ title: error.message, color: 'error' })
      return 'failed'
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
      return 'failed'
    } finally {
      deleting.value = false
    }
  }
  return { setArchived, archiving: loading, remove, deleting }
}
