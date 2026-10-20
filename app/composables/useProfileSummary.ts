import { ERROR_MESSAGES } from '~/constants/errorMessages'

const PROMPT = graphql(`
  query ProfileSummaryPrompt {
    profileSummaryPrompt {
      instructions
    }
  }
`)
const SUGGEST = graphql(`
  mutation SuggestProfileSummary($requestId: UUID) {
    suggestProfileSummary(input: { requestId: $requestId }) {
      result {
        status
        summary
        error
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

// value null: the profile has too little content for a summary.
type Outcome<T> = { value: T; error?: never; code?: never } | { error: string; code?: string }

// Pasted replies: {"summary": "..."}. Returns undefined when the reply isn't that shape.
export const parseSummaryReply = (reply: string): string | null | undefined => {
  const summary = parseDraft(reply)?.summary
  if (summary === null) return null
  return typeof summary === 'string' ? summary.trim() || null : undefined
}

// Only suggests: the caller puts the text in the summary field, and the owner saves it.
export const useProfileSummary = () => {
  const { attempt, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const llm = useLlmModels()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT)).profileSummaryPrompt.instructions
  )

  const suggest = async (): Promise<Outcome<string | null>> => {
    busy.value = true
    try {
      const payload = await attempt(
        {},
        async (requestId) => (await gql(SUGGEST, { requestId })).suggestProfileSummary
      )
      if (isUnknownModel(payload.errors)) await llm.refresh()
      if (payload.errors?.length)
        return { error: payload.errors[0]!.message, code: aiSafetyCode(payload.errors) }
      const { status, summary, error } = payload.result ?? {}
      if (status === 'SUCCEEDED') return { value: summary?.trim() || null }
      return { error: error ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: `${ERROR_MESSAGES.generic} (${errorDetail(e)})` }
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
    suggest
  }
}
