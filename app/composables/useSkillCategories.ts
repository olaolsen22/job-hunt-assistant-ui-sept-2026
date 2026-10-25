import type { ResultOf } from 'gql.tada'

export const SKILL_CATEGORY_FIELDS = graphql(`
  fragment SkillCategoryFields on SkillCategory {
    id
    name
    description
    sortOrder
    skillCount
    translations {
      language
      name
    }
  }
`)

// Default order is the owner's sort order, which is also the order the Developer CV prints them in.
// More than 50 categories would be far beyond one CV's skill lines, so there is no paging.
const CATEGORIES = graphql(
  `
    query SkillCategories {
      skillCategories(first: 50) {
        nodes {
          ...SkillCategoryFields
        }
      }
    }
  `,
  [SKILL_CATEGORY_FIELDS]
)

export type SkillCategory = ResultOf<typeof SKILL_CATEGORY_FIELDS>

// One skill at a time: the inline select on a skill row, and the skills page's bulk change.
export const SET_SKILL_CATEGORY = graphql(`
  mutation SetSkillCategory($input: SetSkillCategoryInput!) {
    setSkillCategory(input: $input) {
      skill {
        categoryId
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

// A select can't hold null, so "uncategorized" is a sentinel that is sent as null.
export const NO_CATEGORY = 'NONE'
export type CategoryChoice = number | typeof NO_CATEGORY
export const toCategoryChoice = (id: number | null | undefined): CategoryChoice => id ?? NO_CATEGORY
export const fromCategoryChoice = (choice: CategoryChoice) =>
  choice === NO_CATEGORY ? null : choice

// Shared key like useLlmModels: every select and the skills page make one request, and only an
// explicit refresh() (after a change on the skills page) asks again.
export const useSkillCategories = () => {
  const { data, status, error, refresh } = useAsyncData('skill-categories', () => gql(CATEGORIES), {
    server: false,
    dedupe: 'defer',
    getCachedData: (key, nuxtApp, { cause }) =>
      cause === 'refresh:manual' ? undefined : nuxtApp.payload.data[key]
  })
  const categories = computed<SkillCategory[]>(() => data.value?.skillCategories?.nodes ?? [])
  // A move returns the whole renumbered list, so it replaces the cache without a refetch.
  const replace = (nodes: SkillCategory[]) => {
    data.value = { skillCategories: { nodes } }
  }
  const items = computed(() => [
    { label: 'Uncategorized', value: NO_CATEGORY as CategoryChoice },
    ...categories.value.map((c) => ({ label: c.name, value: c.id as CategoryChoice }))
  ])
  // A draft can still hold a category deleted since it was written; show and save it as none.
  const known = (id: number | null | undefined): CategoryChoice =>
    id != null && categories.value.some((c) => c.id === id) ? id : NO_CATEGORY

  return { categories, status, error, refresh, replace, items, known }
}
