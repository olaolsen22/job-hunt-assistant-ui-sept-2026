import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { SkillWording } from '~/composables/useSkillWording'

const PROMPT = graphql(`
  query ProfileTranslationPrompt {
    profileTranslationPrompt(language: NORWEGIAN) {
      instructions
    }
  }
`)
const SUGGEST = graphql(`
  mutation SuggestProfileTranslation($requestId: UUID) {
    suggestProfileTranslation(input: { language: NORWEGIAN, requestId: $requestId }) {
      result {
        status
        error
        translation {
          bullets {
            id
            text
          }
          headline
          summary
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
`)
const APPLY = graphql(`
  mutation ApplyProfileTranslation(
    $bullets: [ProfileBulletTextInput!]!
    $headline: String
    $summary: String
  ) {
    applyProfileTranslation(
      input: { language: NORWEGIAN, bullets: $bullets, headline: $headline, summary: $summary }
    ) {
      profile {
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

// Same shape as a skill wording draft: only missing or out-of-date items, null = nothing to change.
export type ProfileTranslationDraft = SkillWording
type Outcome<T> = { value: T; error?: never; code?: never } | { error: string; code?: string }

const failure = (e: unknown) => `${ERROR_MESSAGES.generic} (${errorDetail(e)})`

// Pasted replies use the wording reply's JSON shape; the server validates on apply.
export const parseTranslationReply = (reply: string): ProfileTranslationDraft | null =>
  parseWordingReply(reply)

// English → Norwegian only; the API rejects translating into the profile's own language.
export const useProfileTranslationAi = () => {
  const { attempt, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const llm = useLlmModels()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT)).profileTranslationPrompt.instructions
  )

  const suggest = async (): Promise<Outcome<ProfileTranslationDraft>> => {
    busy.value = true
    try {
      const payload = await attempt(
        {},
        async (requestId) => (await gql(SUGGEST, { requestId })).suggestProfileTranslation
      )
      if (isUnknownModel(payload.errors)) await llm.refresh()
      if (payload.errors?.length)
        return { error: payload.errors[0]!.message, code: aiSafetyCode(payload.errors) }
      const { status, error, translation } = payload.result ?? {}
      if (status === 'SUCCEEDED' && translation)
        return {
          value: {
            bullets: translation.bullets.map(({ id, text }) => ({ id, text })),
            headline: translation.headline ?? null,
            summary: translation.summary ?? null
          }
        }
      return { error: error ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: failure(e) }
    } finally {
      busy.value = false
    }
  }

  const apply = async (draft: ProfileTranslationDraft): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { applyProfileTranslation: payload } = await gql(APPLY, draft)
      return payload.errors?.length ? { error: payload.errors[0]!.message } : {}
    } catch (e) {
      return { error: failure(e) }
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
    needsConfirm,
    safetyMessage,
    confirmRetry,
    loadPrompt,
    copyPrompt,
    suggest,
    apply
  }
}
