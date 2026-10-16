import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
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
        translations {
          skillName
          language
          name
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
// Also the skills page's merge and rename: one operation with the kept name.
export const CLEAN_UP_SKILLS = graphql(`
  mutation CleanUpSkills(
    $operations: [SkillCleanupOperationInput!]!
    $translations: [SkillCleanupTranslationInput!]
  ) {
    cleanUpSkills(input: { operations: $operations, translations: $translations }) {
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
export type CleanupTranslation = { skillName: string; language: Language; name: string }
export type CleanupPlan = { operations: CleanupOperation[]; translations: CleanupTranslation[] }
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

const isTranslation = (value: unknown): value is CleanupTranslation => {
  const t = value as CleanupTranslation | null
  return (
    typeof t?.skillName === 'string' &&
    typeof t.name === 'string' &&
    LANGUAGE_OPTIONS.some((o) => o.value === t.language)
  )
}

// Pasted replies are not pre-filtered: the server validates the plan when it is applied.
// Translations are optional in a reply.
export const parseCleanupReply = (reply: string): CleanupPlan | null => {
  const draft = parseDraft(reply)
  const operations = draft?.operations
  const translations = draft?.translations ?? []
  return Array.isArray(operations) &&
    operations.every(isOperation) &&
    Array.isArray(translations) &&
    translations.every(isTranslation)
    ? {
        operations: operations.map(({ skillIds, names }) => ({ skillIds, names })),
        translations: translations.map(({ skillName, language, name }) => ({
          skillName,
          language,
          name
        }))
      }
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

  const suggest = async (): Promise<Outcome<CleanupPlan>> => {
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
          value: {
            operations: (payload.result.operations ?? []).map(({ skillIds, names }) => ({
              skillIds: [...skillIds],
              names: [...names]
            })),
            translations: (payload.result.translations ?? []).map((t) => ({ ...t }))
          }
        }
      return { error: payload.result?.error ?? ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: failure(ERROR_MESSAGES.generic, e) }
    } finally {
      busy.value = false
    }
  }

  // All-or-nothing on the server: any error means nothing changed.
  const apply = async ({ operations, translations }: CleanupPlan): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { cleanUpSkills: payload } = await gql(CLEAN_UP_SKILLS, { operations, translations })
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
