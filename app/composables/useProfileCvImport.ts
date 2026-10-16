import type { ResultOf, VariablesOf } from 'gql.tada'
import { PROFILE_FIELDS } from '~/composables/useProfile'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

export const CV_CANDIDATE = graphql(`
  fragment CvCandidate on ProfileCvCandidate {
    schemaVersion
    contentLanguage
    basics {
      fullName
      headline
      summary
      email
      phone
      location {
        city
        countryCode
      }
    }
    links {
      kind
      label
      url
    }
    hobbies
    experiences {
      employer
      title
      startMonth
      endMonth
      location {
        city
        countryCode
      }
      skillNames
      bullets
    }
    educations {
      school
      degree
      field
      startMonth
      endMonth
      location {
        city
        countryCode
      }
      bullets
    }
    certifications {
      name
      issuer
      issuedMonth
      expiresMonth
      url
      bullets
    }
    projects {
      name
      url
      startMonth
      endMonth
      location {
        city
        countryCode
      }
      skillNames
      bullets
    }
    skills {
      name
      level
      categoryName
    }
    languages {
      name
      spoken
      written
    }
    warnings {
      path
      message
    }
  }
`)

const PROMPT = graphql(`
  query ProfileCvPrompt {
    profileCvParsePrompt {
      version
      instructions
    }
  }
`)
const PARSE = graphql(
  `
    mutation ParseProfileCv($text: String!, $requestId: UUID) {
      parseProfileCv(input: { text: $text, requestId: $requestId }) {
        result {
          status
          error
          candidate {
            ...CvCandidate
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
  [CV_CANDIDATE]
)
const PREVIEW = graphql(
  `
    mutation PreviewProfileCvImport($json: String!) {
      previewProfileCvImport(input: { json: $json }) {
        candidate {
          ...CvCandidate
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
  [CV_CANDIDATE]
)
export const IMPORT_CV = graphql(
  `
    mutation ImportProfileCv($selection: ProfileCvImportSelectionInput!) {
      importProfileCv(input: { selection: $selection }) {
        profile {
          ...ProfileFields
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
  [PROFILE_FIELDS]
)

export type CvCandidate = ResultOf<typeof CV_CANDIDATE>
export type CvSelection = VariablesOf<typeof IMPORT_CV>['selection']
export type CvSaveError = NonNullable<
  ResultOf<typeof IMPORT_CV>['importProfileCv']['errors']
>[number]
type Outcome<T> =
  | { value: T; error?: never; stale?: never; apiErrors?: never }
  | {
      error: string
      stale?: boolean
      value?: never
      apiErrors?: CvSaveError[]
      // The API's AiSafetyError code, for a built-in parse.
      code?: string
    }

export const useProfileCvImport = () => {
  const llm = useLlmModels()
  const { attempt, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const busy = ref(false)
  const instructions = ref('')
  const promptLoading = ref(false)
  const promptError = ref('')
  const copied = ref(false)
  const loadPrompt = async () => {
    promptLoading.value = true
    promptError.value = ''
    try {
      instructions.value = (await gql(PROMPT)).profileCvParsePrompt.instructions
    } catch {
      promptError.value = ERROR_MESSAGES.generic
    } finally {
      promptLoading.value = false
    }
  }
  const copyPrompt = async () => {
    promptError.value = ''
    try {
      await navigator.clipboard.writeText(instructions.value)
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    } catch {
      promptError.value = 'Could not copy the prompt. Try again or copy the instructions below.'
    }
  }
  const parse = async (text: string): Promise<Outcome<CvCandidate>> => {
    busy.value = true
    try {
      const input = { text: text.trim() }
      const payload = await attempt(
        input,
        async (requestId) => (await gql(PARSE, { ...input, requestId })).parseProfileCv
      )
      // The saved default model is gone: show the message and fetch the list again.
      if (isUnknownModel(payload.errors)) await llm.refresh()
      if (payload.errors?.length)
        return { error: payload.errors[0]!.message, code: aiSafetyCode(payload.errors) }
      if (payload.result?.status === 'SUCCEEDED' && payload.result.candidate)
        return { value: payload.result.candidate }
      return { error: payload.result?.error ?? ERROR_MESSAGES.generic }
    } catch {
      return { error: ERROR_MESSAGES.generic }
    } finally {
      busy.value = false
    }
  }
  const preview = async (json: string): Promise<Outcome<CvCandidate>> => {
    busy.value = true
    try {
      const { previewProfileCvImport: payload } = await gql(PREVIEW, { json })
      if (payload.errors?.length) return { error: payload.errors[0]!.message }
      return payload.candidate ? { value: payload.candidate } : { error: ERROR_MESSAGES.generic }
    } catch {
      return { error: ERROR_MESSAGES.generic }
    } finally {
      busy.value = false
    }
  }
  const save = async (
    selection: CvSelection
  ): Promise<Outcome<NonNullable<ResultOf<typeof IMPORT_CV>['importProfileCv']['profile']>>> => {
    busy.value = true
    try {
      const { importProfileCv: payload } = await gql(IMPORT_CV, { selection })
      if (payload.errors?.length)
        return {
          error: payload.errors.map((e) => e.message).join('\n'),
          apiErrors: payload.errors,
          stale: payload.errors.some((e) => e.__typename === 'ProfileEntryNotFoundError')
        }
      return payload.profile ? { value: payload.profile } : { error: ERROR_MESSAGES.generic }
    } catch {
      // A lost response can follow a successful save; do not automatically retry additions.
      return {
        error:
          'Could not confirm the import. Check your profile before retrying to avoid adding duplicates.'
      }
    } finally {
      busy.value = false
    }
  }
  return {
    busy,
    instructions,
    promptLoading,
    promptError,
    copied,
    loadPrompt,
    copyPrompt,
    parse,
    preview,
    save,
    needsConfirm,
    safetyMessage,
    confirmRetry
  }
}
