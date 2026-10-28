import type { VariablesOf } from 'gql.tada'
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
          experiences {
            id
            title
          }
          educations {
            id
            degree
            field
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
    $experiences: [ProfileExperienceTitleTextInput!]
    $educations: [ProfileEducationTextInput!]
  ) {
    applyProfileTranslation(
      input: {
        language: NORWEGIAN
        bullets: $bullets
        headline: $headline
        summary: $summary
        experiences: $experiences
        educations: $educations
      }
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

// A skill wording draft plus job titles and education: only missing or out-of-date items,
// null = nothing to change.
export type ProfileTranslationDraft = SkillWording & {
  experiences: { id: number; title: string }[]
  educations: { id: number; degree: string | null; field: string | null }[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const optionalText = (value: unknown) => (typeof value === 'string' ? value : null)

// Pasted replies use the wording reply's JSON shape plus optional `experiences`/`educations`;
// entries that aren't shaped right are dropped, and the server validates the rest on apply.
export const parseTranslationReply = (reply: string): ProfileTranslationDraft | null => {
  const wording = parseWordingReply(reply)
  if (!wording) return null
  const draft = parseDraft(reply)!
  const list = (value: unknown) =>
    (Array.isArray(value) ? value : []).filter(
      (item): item is Record<string, unknown> => isObject(item) && typeof item.id === 'number'
    )
  return {
    ...wording,
    experiences: list(draft.experiences)
      .filter((e) => typeof e.title === 'string')
      .map((e) => ({ id: e.id as number, title: e.title as string })),
    educations: list(draft.educations).map((e) => ({
      id: e.id as number,
      degree: optionalText(e.degree),
      field: optionalText(e.field)
    }))
  }
}

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
                experiences: result.translation.experiences.map(({ id, title }) => ({ id, title })),
                educations: result.translation.educations.map(({ id, degree, field }) => ({
                  id,
                  degree: degree ?? null,
                  field: field ?? null
                })),
                headline: result.translation.headline ?? null,
                summary: result.translation.summary ?? null
              }
            }
          : { error: result?.error ?? ERROR_MESSAGES.generic }
    )

  const apply = async (draft: VariablesOf<typeof APPLY>): Promise<{ error?: string }> => {
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
