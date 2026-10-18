import { ERROR_MESSAGES } from '~/constants/errorMessages'

const PROMPT = graphql(`
  query ProfileSkillWordingPrompt {
    profileSkillWordingPrompt {
      instructions
    }
  }
`)
const SUGGEST = graphql(`
  mutation SuggestProfileSkillWording($requestId: UUID) {
    suggestProfileSkillWording(input: { requestId: $requestId }) {
      result {
        status
        error
        wording {
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
  mutation ApplyProfileSkillWording(
    $bullets: [ProfileBulletTextInput!]!
    $headline: String
    $summary: String
  ) {
    applyProfileSkillWording(input: { bullets: $bullets, headline: $headline, summary: $summary }) {
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

// null headline/summary means "unchanged".
export type SkillWording = {
  bullets: { id: number; text: string }[]
  headline: string | null
  summary: string | null
}
type Outcome<T> = { value: T; error?: never; code?: never } | { error: string; code?: string }

const failure = (e: unknown) => `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
const optionalText = (value: unknown) => (typeof value === 'string' ? value : null)

// Pasted replies: {"bullets":[{"id","text"}],"headline","summary"}. The server validates on apply.
export const parseWordingReply = (reply: string): SkillWording | null => {
  const draft = parseDraft(reply)
  const bullets = draft?.bullets
  if (
    !Array.isArray(bullets) ||
    !bullets.every((b) => typeof b?.id === 'number' && typeof b.text === 'string')
  )
    return null
  return {
    bullets: bullets.map(({ id, text }) => ({ id, text })),
    headline: optionalText(draft!.headline),
    summary: optionalText(draft!.summary)
  }
}

export const useSkillWording = () => {
  const { attempt, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const llm = useLlmModels()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT)).profileSkillWordingPrompt.instructions
  )

  const suggest = async (): Promise<Outcome<SkillWording>> => {
    busy.value = true
    try {
      const payload = await attempt(
        {},
        async (requestId) => (await gql(SUGGEST, { requestId })).suggestProfileSkillWording
      )
      if (isUnknownModel(payload.errors)) await llm.refresh()
      if (payload.errors?.length)
        return { error: payload.errors[0]!.message, code: aiSafetyCode(payload.errors) }
      const { status, error, wording } = payload.result ?? {}
      if (status === 'SUCCEEDED' && wording)
        return {
          value: {
            bullets: wording.bullets.map(({ id, text }) => ({ id, text })),
            headline: wording.headline ?? null,
            summary: wording.summary ?? null
          }
        }
      return { error: error ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: failure(e) }
    } finally {
      busy.value = false
    }
  }

  const apply = async (wording: SkillWording): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { applyProfileSkillWording: payload } = await gql(APPLY, wording)
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
