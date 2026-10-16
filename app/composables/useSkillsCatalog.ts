import type { ResultOf } from 'gql.tada'

const SKILLS = graphql(`
  query SkillsCatalog($after: String) {
    skills(first: 50, after: $after, order: { name: ASC }) {
      nodes {
        id
        name
        categoryId
        listingCount
        profileLevel
        translations {
          language
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export type CatalogSkill = NonNullable<
  NonNullable<ResultOf<typeof SKILLS>['skills']>['nodes']
>[number]

// Which skills the page shows: every one, the uncategorized ones, or one category's (by id).
export type SkillFilter = 'all' | 'none' | number

// The skills page loads every skill, a page at a time, rather than one page per view: filtering by
// category and search stays instant, a merge can pick any skill, and a rename can warn when the new
// name already exists. A personal skill list is a few hundred rows at most.
export const useSkillsCatalog = () =>
  useAsyncData(
    'skills-catalog',
    async () => {
      const skills: CatalogSkill[] = []
      let after: string | null | undefined
      do {
        const page: ResultOf<typeof SKILLS> = await gql(SKILLS, { after })
        skills.push(...(page.skills?.nodes ?? []))
        after = page.skills?.pageInfo.hasNextPage ? page.skills.pageInfo.endCursor : null
      } while (after)
      return skills
    },
    { server: false, default: () => [] as CatalogSkill[] }
  )
