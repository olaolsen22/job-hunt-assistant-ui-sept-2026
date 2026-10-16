import { describe, expect, it } from 'vitest'
import { print } from '@0no-co/graphql.web'
import { buildListingsQuery, emptyFacets, type ListingsFacets } from '~/composables/useListingsList'

const build = (facets: Partial<ListingsFacets>) => {
  const { document, variables } = buildListingsQuery(null, { ...emptyFacets(), ...facets }, 'due')
  return { text: print(document), variables }
}

describe('buildListingsQuery', () => {
  it('leaves out facets with nothing selected', () => {
    const { text, variables } = build({})
    expect(text).not.toMatch(/\$(statuses|skills|locationIds|postingLanguages|languages)\b/)
    expect(text).not.toContain('favoritedAt: {neq')
    expect(Object.keys(variables).sort()).toEqual(['order', 'today'])
    expect(variables.order).toBeUndefined()
  })

  it('drops the expiry clause when statuses are picked', () => {
    const { text, variables } = build({ statuses: ['APPLIED'] })
    expect(text).toContain('status: {in: $statuses}')
    expect(text).not.toContain('$today')
    expect(variables).not.toHaveProperty('today')
    expect(variables.statuses).toEqual(['APPLIED'])
  })

  it('joins two facets under and', () => {
    const { text } = build({ favorites: true, skills: ['Vue'] })
    expect(text).toContain(
      'where: {and: [{or: [{deadlineType: {neq: DATE}}, {deadlineOn: {gte: $today}}]}, {favoritedAt: {neq: null}}, {skills: {some: {skill: {name: {in: $skills}}}}}]}'
    )
  })
})

describe('preferred locations', () => {
  const clause = 'locations: {some: {location: {isTarget: {eq: true}}}}'

  it('always counts listings in target locations under the active preset', () => {
    const text = print(buildListingsQuery('toAnalyze', emptyFacets(), 'due').document)
    expect(text.match(/isTarget/g)).toHaveLength(1)
    expect(text).toMatch(/preferred: listings\([^)]*analyzedAt: \{eq: null\}[^)]*isTarget/)
  })

  it('narrows the list and every count when on, without repeating the clause', () => {
    const { text } = build({ preferredLocations: true })
    // The list, its four preset counts and the three quick-toggle counts.
    expect(text.match(/isTarget/g)).toHaveLength(8)
    expect(text).not.toContain(`${clause}}, {${clause}`)
  })
})

describe('IT and English toggles', () => {
  const itClause = 'jobRole: {category: {name: {eq: "IT"}}}'

  it('counts IT roles and the English postings under the active preset', () => {
    const text = print(buildListingsQuery('toAnalyze', emptyFacets(), 'due').document)
    expect(text).toMatch(
      /it: listings\([^)]*analyzedAt: \{eq: null\}[^)]*category: \{name: \{eq: "IT"\}/
    )
    expect(text).toMatch(/englishPosting: listings\([^)]*postingLanguage: \{eq: ENGLISH\}/)
    expect(text).toMatch(
      /englishMentioned: listings\([^)]*languages: \{some: \{language: \{eq: ENGLISH\}\}\}/
    )
    expect(text.match(/category:/g)).toHaveLength(1)
  })

  it('narrows the list and every count to IT roles when on', () => {
    const { text } = build({ itRoles: true })
    expect(text.match(/category:/g)).toHaveLength(8)
    expect(text).not.toContain(`${itClause}}, {${itClause}`)
  })
})

describe('all count', () => {
  it('counts every active listing under the facets, whichever preset is on', () => {
    const facets = { ...emptyFacets(), favorites: true }
    const text = print(buildListingsQuery('archived', facets, 'due').document)
    // The arguments contain no parentheses, so the first ")" closes the field's argument list.
    const args = text.split('all: listings(')[1]!.split(')')[0]
    expect(args).toContain('deadlineOn: {gte: $today}')
    expect(args).toContain('favoritedAt: {neq: null}')
    expect(args).not.toContain('archived: true')
  })
})

describe('date facets', () => {
  it('filters on the posted range and keeps the expiry clause', () => {
    const { text, variables } = build({ postedFrom: '2026-10-01', postedTo: '2026-10-07' })
    expect(text).toContain('postedOn: {gte: $postedFrom, lte: $postedTo}')
    expect(text).toContain('$today')
    expect(variables).toMatchObject({ postedFrom: '2026-10-01', postedTo: '2026-10-07' })
  })

  it('sends only the posted end that is set', () => {
    const { text, variables } = build({ postedFrom: '2026-10-01' })
    expect(text).toContain('postedOn: {gte: $postedFrom}')
    expect(variables).not.toHaveProperty('postedTo')
  })

  it('adds dueWithinDays to the list and the counts, narrowing closing soon', () => {
    const { text } = build({ dueWithinDays: 3 })
    expect(text).toContain('closingSoon: listings(take: 1, search: $search, dueWithinDays: 3')
    expect(text.match(/dueWithinDays: 3/g)).toHaveLength(8)
    expect(build({ dueWithinDays: 14 }).text).toContain(
      'closingSoon: listings(take: 1, search: $search, dueWithinDays: 7'
    )
  })

  it('leaves both out when unset', () => {
    const { text } = build({})
    expect(text).not.toContain('postedOn: {')
    expect(text.match(/dueWithinDays/g)).toHaveLength(1)
  })
})
