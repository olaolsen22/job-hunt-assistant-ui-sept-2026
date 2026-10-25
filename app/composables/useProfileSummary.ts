import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { AiOutcome } from '~/utils/aiOutcome'

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

// Pasted replies: {"summary": "..."}. Returns undefined when the reply isn't that shape.
export const parseSummaryReply = (reply: string): string | null | undefined => {
  const summary = parseDraft(reply)?.summary
  if (summary === null) return null
  return typeof summary === 'string' ? summary.trim() || null : undefined
}

// Only suggests: the caller puts the text in the summary field, and the owner saves it.
export const useProfileSummary = () => {
  const { run, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT)).profileSummaryPrompt.instructions
  )

  // value null: the profile has too little content for a summary.
  const suggest = () =>
    run(
      busy,
      {},
      async (requestId) => (await gql(SUGGEST, { requestId })).suggestProfileSummary,
      ({ result }): AiOutcome<string | null> =>
        result?.status === 'SUCCEEDED'
          ? { value: result.summary?.trim() || null }
          : { error: result?.error ?? ERROR_MESSAGES.generic }
    )

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
