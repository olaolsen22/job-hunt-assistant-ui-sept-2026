import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { AiOutcome } from '~/utils/aiOutcome'

const GENERATE = graphql(`
  mutation GenerateApplicationAnswers($input: GenerateApplicationAnswersInput!) {
    generateApplicationAnswers(input: $input) {
      result {
        status
        error
        errorCode
        candidates {
          questionId
          answer
          length
          overLimit
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

const PROMPT = graphql(`
  query ApplicationAnswerExternalPrompt($listingId: Int!) {
    applicationAnswerExternalPrompt(listingId: $listingId) {
      instructions
    }
  }
`)

const PREVIEW = graphql(`
  mutation PreviewApplicationAnswers($input: PreviewApplicationAnswersInput!) {
    previewApplicationAnswers(input: $input) {
      candidates {
        questionId
        answer
        length
        overLimit
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

export type AnswerCandidate = NonNullable<
  ResultOf<typeof PREVIEW>['previewApplicationAnswers']['candidates']
>[number]

// Built-in and your-own-AI ways to draft every answer on a listing in one go. Neither saves
// anything: the review shows each candidate under its question and saves the ticked ones.
export const useApplicationAnswersAi = (listingId: () => number) => {
  const { run, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const generating = ref(false)
  const previewing = ref(false)

  const generate = () => {
    const input = { listingId: listingId() }
    return run(
      generating,
      input,
      async (requestId) =>
        (await gql(GENERATE, { input: { ...input, requestId } })).generateApplicationAnswers,
      ({ result }): AiOutcome<AnswerCandidate[]> => {
        if (result?.candidates) return { value: result.candidates }
        const message = result?.error ?? ERROR_MESSAGES.generic
        return { error: result?.errorCode ? `${message} (${result.errorCode})` : message }
      }
    )
  }

  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () =>
      (await gql(PROMPT, { listingId: listingId() })).applicationAnswerExternalPrompt.instructions
  )

  const preview = async (json: string): Promise<AiOutcome<AnswerCandidate[]>> => {
    previewing.value = true
    try {
      const { previewApplicationAnswers } = await gql(PREVIEW, {
        input: { listingId: listingId(), json: json.trim() }
      })
      const { candidates, errors } = previewApplicationAnswers
      if (candidates) return { value: candidates }
      return { error: errors?.[0]?.message ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: genericError(e) }
    } finally {
      previewing.value = false
    }
  }

  return {
    generate,
    preview,
    generating,
    previewing,
    safetyCode,
    safetyMessage,
    needsConfirm,
    confirmRetry,
    instructions,
    promptLoading,
    promptError,
    copied,
    loadPrompt,
    copyPrompt
  }
}
