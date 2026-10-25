import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { AiOutcome } from '~/utils/aiOutcome'
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
// Pasted replies use the wording reply's JSON shape; the server validates on apply.
export const parseTranslationReply = (reply: string): ProfileTranslationDraft | null =>
  parseWordingReply(reply)

// English → Norwegian only; the API rejects translating into the profile's own language.
export const useProfileTranslationAi = () => {
  const { run, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT)).profileTranslationPrompt.instructions
  )

  const suggest = () =>
    run(
      busy,
      {},
      async (requestId) => (await gql(SUGGEST, { requestId })).suggestProfileTranslation,
      ({ result }): AiOutcome<ProfileTranslationDraft> =>
        result?.status === 'SUCCEEDED' && result.translation
          ? {
              value: {
                bullets: result.translation.bullets.map(({ id, text }) => ({ id, text })),
                headline: result.translation.headline ?? null,
                summary: result.translation.summary ?? null
              }
            }
          : { error: result?.error ?? ERROR_MESSAGES.generic }
    )

  const apply = async (draft: ProfileTranslationDraft): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { applyProfileTranslation: payload } = await gql(APPLY, draft)
      return payload.errors?.length ? { error: payload.errors[0]!.message } : {}
    } catch (e) {
      return { error: genericError(e) }
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
