import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { AiOutcome } from '~/utils/aiOutcome'

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
        categories {
          skillName
          categoryName
        }
        removals {
          skillId
          reason
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
    $categories: [SkillCleanupCategoryInput!]
    $removeSkillIds: [Int!]
  ) {
    cleanUpSkills(
      input: {
        operations: $operations
        translations: $translations
        categories: $categories
        removeSkillIds: $removeSkillIds
      }
    ) {
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

export type CleanupOperation = { skillIds: number[]; names: string[] }
export type CleanupTranslation = { skillName: string; language: Language; name: string }
export type CleanupCategory = { skillName: string; categoryName: string }
export type CleanupRemoval = { skillId: number; reason: string }
export type CleanupPlan = {
  operations: CleanupOperation[]
  translations: CleanupTranslation[]
  categories: CleanupCategory[]
  removals: CleanupRemoval[]
}

const isOperation = (value: unknown): value is CleanupOperation => {
  const op = value as CleanupOperation | null
  return (
    Array.isArray(op?.skillIds) &&
    op.skillIds.every((id) => typeof id === 'number') &&
    Array.isArray(op.names) &&
    op.names.every((name) => typeof name === 'string')
  )
}

const isCategory = (value: unknown): value is CleanupCategory => {
  const c = value as CleanupCategory | null
  return typeof c?.skillName === 'string' && typeof c.categoryName === 'string'
}

const isRemoval = (value: unknown): value is CleanupRemoval => {
  const r = value as CleanupRemoval | null
  return typeof r?.skillId === 'number' && typeof r.reason === 'string'
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
// Translations, categories and removals are optional in a reply.
export const parseCleanupReply = (reply: string): CleanupPlan | null => {
  const draft = parseDraft(reply)
  const operations = draft?.operations
  const translations = draft?.translations ?? []
  const categories = draft?.categories ?? []
  const removals = draft?.removals ?? []
  return Array.isArray(operations) &&
    operations.every(isOperation) &&
    Array.isArray(translations) &&
    translations.every(isTranslation) &&
    Array.isArray(categories) &&
    categories.every(isCategory) &&
    Array.isArray(removals) &&
    removals.every(isRemoval)
    ? {
        operations: operations.map(({ skillIds, names }) => ({ skillIds, names })),
        translations: translations.map(({ skillName, language, name }) => ({
          skillName,
          language,
          name
        })),
        categories: categories.map(({ skillName, categoryName }) => ({ skillName, categoryName })),
        removals: removals.map(({ skillId, reason }) => ({ skillId, reason }))
      }
    : null
}

export const useSkillCleanup = () => {
  const { run, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT)).skillCleanupPrompt.instructions
  )

  // Every skill id → name, so a plan can show what it would change. Paged until the end.
  const loadSkillNames = async (): Promise<AiOutcome<Map<number, string>>> => {
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
      return { error: `Could not load your skills. (${errorDetail(e)})` }
    }
  }

  const suggest = () =>
    run(
      busy,
      {},
      async (requestId) => (await gql(SUGGEST, { requestId })).suggestSkillCleanup,
      ({ result }): AiOutcome<CleanupPlan> =>
        result?.status === 'SUCCEEDED'
          ? {
              value: {
                operations: (result.operations ?? []).map(({ skillIds, names }) => ({
                  skillIds: [...skillIds],
                  names: [...names]
                })),
                translations: (result.translations ?? []).map((t) => ({ ...t })),
                categories: (result.categories ?? []).map((c) => ({ ...c })),
                removals: (result.removals ?? []).map((x) => ({ ...x }))
              }
            }
          : { error: result?.error ?? ERROR_MESSAGES.generic }
    )

  // All-or-nothing on the server: any error means nothing changed. `removals` are the ticked ones.
  const apply = async ({ removals, ...plan }: CleanupPlan): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { cleanUpSkills: payload } = await gql(CLEAN_UP_SKILLS, {
        ...plan,
        removeSkillIds: removals.length ? removals.map((x) => x.skillId) : undefined
      })
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
    loadSkillNames,
    suggest,
    apply
  }
}
