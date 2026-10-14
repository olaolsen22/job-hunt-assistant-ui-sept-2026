import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const PROMPT = graphql(`
  query SkillCleanupPrompt {
    skillCleanupPrompt {
      instructions
    }
  }
`)
const ALL_SKILLS = graphql(`
  query AllSkillNames($after: String) {
    skills(first: 50, after: $after, order: { name: ASC }) {
      nodes {
        id
        name
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)
const SUGGEST = graphql(`
  mutation SuggestSkillCleanup($requestId: UUID) {
    suggestSkillCleanup(input: { requestId: $requestId }) {
      result {
        status
        error
        operations {
          skillIds
          names
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
  mutation CleanUpSkills($operations: [SkillCleanupOperationInput!]!) {
    cleanUpSkills(input: { operations: $operations }) {
      skills {
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

// The generic text alone hides why a request failed, so append what the API or network said.
const failure = (message: string, e: unknown) => {
  const err = e as { data?: { errors?: { message: string }[] }; message?: string }
  const detail = err.data?.errors?.[0]?.message ?? err.message
  return detail ? `${message} (${detail})` : message
}

export type CleanupOperation = { skillIds: number[]; names: string[] }
type Outcome<T> = { value: T; error?: never; code?: never } | { error: string; code?: string }

const isOperation = (value: unknown): value is CleanupOperation => {
  const op = value as CleanupOperation | null
  return (
    Array.isArray(op?.skillIds) &&
    op.skillIds.every((id) => typeof id === 'number') &&
    Array.isArray(op.names) &&
    op.names.every((name) => typeof name === 'string')
  )
}

// Pasted replies are not pre-filtered: the server validates the plan when it is applied.
export const parseCleanupReply = (reply: string): CleanupOperation[] | null => {
  const operations = parseDraft(reply)?.operations
  return Array.isArray(operations) && operations.every(isOperation)
    ? operations.map(({ skillIds, names }) => ({ skillIds, names }))
    : null
}

export const useSkillCleanup = () => {
  const { attempt, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const llm = useLlmModels()
  const busy = ref(false)
  const instructions = ref('')
  const promptLoading = ref(false)
  const promptError = ref('')
  const copied = ref(false)

  const loadPrompt = async () => {
    promptLoading.value = true
    promptError.value = ''
    try {
      instructions.value = (await gql(PROMPT)).skillCleanupPrompt.instructions
    } catch (e) {
      promptError.value = failure(ERROR_MESSAGES.generic, e)
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

  // Every skill id → name, so a plan can show what it would change. Paged until the end.
  const loadSkillNames = async (): Promise<Outcome<Map<number, string>>> => {
    try {
      const names = new Map<number, string>()
      let after: string | null | undefined
      do {
        const page: ResultOf<typeof ALL_SKILLS> = await gql(ALL_SKILLS, { after })
        for (const node of page.skills?.nodes ?? []) names.set(node.id, node.name)
        after = page.skills?.pageInfo.hasNextPage ? page.skills.pageInfo.endCursor : null
      } while (after)
      return { value: names }
    } catch (e) {
      return { error: failure('Could not load your skills.', e) }
    }
  }

  const suggest = async (): Promise<Outcome<CleanupOperation[]>> => {
    busy.value = true
    try {
      const payload = await attempt(
        {},
        async (requestId) => (await gql(SUGGEST, { requestId })).suggestSkillCleanup
      )
      // The saved default model is gone: show the message and fetch the list again.
      if (isUnknownModel(payload.errors)) await llm.refresh()
      if (payload.errors?.length)
        return { error: payload.errors[0]!.message, code: aiSafetyCode(payload.errors) }
      if (payload.result?.status === 'SUCCEEDED')
        return {
          value: (payload.result.operations ?? []).map(({ skillIds, names }) => ({
            skillIds: [...skillIds],
            names: [...names]
          }))
        }
      return { error: payload.result?.error ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: failure(ERROR_MESSAGES.generic, e) }
    } finally {
      busy.value = false
    }
  }

  // All-or-nothing on the server: any error means nothing changed.
  const apply = async (operations: CleanupOperation[]): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { cleanUpSkills: payload } = await gql(APPLY, { operations })
      return payload.errors?.length ? { error: payload.errors[0]!.message } : {}
    } catch (e) {
      return { error: failure(ERROR_MESSAGES.generic, e) }
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
    loadSkillNames,
    suggest,
    apply
  }
}
