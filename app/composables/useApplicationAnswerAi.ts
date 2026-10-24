import { ERROR_MESSAGES } from '~/constants/errorMessages'

const GENERATE = graphql(`
  mutation GenerateApplicationAnswer($input: GenerateApplicationAnswerInput!) {
    generateApplicationAnswer(input: $input) {
      result {
        status
        error
        errorCode
        candidate {
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
  query ApplicationAnswerExternalPrompt($questionId: Int!) {
    applicationAnswerExternalPrompt(questionId: $questionId) {
      instructions
    }
  }
`)

const PREVIEW = graphql(`
  mutation PreviewApplicationAnswer($input: PreviewApplicationAnswerInput!) {
    previewApplicationAnswer(input: $input) {
      candidate {
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

export interface AnswerCandidate {
  answer: string
  length: number
  overLimit: boolean
}

type Outcome =
  { candidate: AnswerCandidate; error?: undefined } | { candidate?: undefined; error: string }

// Built-in and your-own-AI ways to get a candidate answer for one saved question. Neither saves
// anything: the caller shows the candidate, the owner edits it, and the edit form saves it.
export const useApplicationAnswerAi = (questionId: () => number) => {
  const llm = useLlmModels()
  const { attempt, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const generating = ref(false)
  const previewing = ref(false)

  const generate = async (): Promise<Outcome> => {
    generating.value = true
    try {
      const input = { questionId: questionId() }
      const { result, errors } = await attempt(
        input,
        async (requestId) =>
          (await gql(GENERATE, { input: { ...input, requestId } })).generateApplicationAnswer
      )
      if (isUnknownModel(errors)) await llm.refresh()
      if (errors?.length) return { error: errors[0]!.message }
      if (result?.candidate) return { candidate: result.candidate }
      const message = result?.error ?? ERROR_MESSAGES.generic
      return { error: result?.errorCode ? `${message} (${result.errorCode})` : message }
    } catch (e) {
      return { error: `${ERROR_MESSAGES.generic} (${errorDetail(e)})` }
    } finally {
      generating.value = false
    }
  }

  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () =>
      (await gql(PROMPT, { questionId: questionId() })).applicationAnswerExternalPrompt.instructions
  )

  const preview = async (json: string): Promise<Outcome> => {
    previewing.value = true
    try {
      const { previewApplicationAnswer } = await gql(PREVIEW, {
        input: { questionId: questionId(), json: json.trim() }
      })
      const { candidate, errors } = previewApplicationAnswer
      if (candidate) return { candidate }
      return { error: errors?.[0]?.message ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: `${ERROR_MESSAGES.generic} (${errorDetail(e)})` }
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
