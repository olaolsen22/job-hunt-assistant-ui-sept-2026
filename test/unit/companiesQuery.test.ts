import { describe, expect, it } from 'vitest'
import { print } from '@0no-co/graphql.web'
import {
  buildCompaniesQuery,
  emptyCompaniesFacets,
  parseCompaniesQuery,
  toCompaniesQuery,
  type CompaniesView
} from '~/utils/companiesQuery'

const view = (overrides: Partial<CompaniesView> = {}): CompaniesView => ({
  search: '',
  tab: 'all',
  sort: 'name',
  facets: emptyCompaniesFacets(),
  page: 1,
  ...overrides
})

// The printed `companies(...)` arguments, one per line.
const args = (built: ReturnType<typeof buildCompaniesQuery>) =>
  print(built.document).match(/companies\(([\s\S]*?)\) \{/)![1]!

describe('companies query', () => {
  it('has no where clause and a literal page size when nothing narrows it', () => {
    const built = buildCompaniesQuery(view(), 7)
    expect(args(built)).not.toContain('where')
    expect(args(built)).toContain('first: 7')
    expect(args(built)).toMatch(/order: \[\{\s*name: ASC\s*\}\]/)
    expect(built.variables).toEqual({})
  })

  it('narrows by tab: consultancies, or the hiring types for employers', () => {
    expect(args(buildCompaniesQuery(view({ tab: 'consultancies' }), 5))).toMatch(
      /kind: \{\s*eq: CONSULTANCY/
    )
    const employers = args(buildCompaniesQuery(view({ tab: 'employers' }), 5))
    expect(employers).toMatch(
      /kind: \{\s*in: \[PRODUCT, IN_HOUSE, PUBLIC_SECTOR, AGENCY, STARTUP\]/
    )
    expect(employers).not.toMatch(/CONSULTANCY|RECRUITMENT|BROKER/)
  })

  it('sends value facets as typed variables and fixed facets as clauses', () => {
    const facets = {
      ...emptyCompaniesFacets(),
      favorites: true,
      hideAvoided: true,
      hasContacts: true,
      researched: 'yes' as const,
      locationIds: [3],
      industries: ['Consulting'],
      skills: ['Vue'],
      sizeBands: ['SMALL' as const],
      workModes: ['REMOTE' as const],
      languages: ['ENGLISH' as const]
    }
    const built = buildCompaniesQuery(view({ facets }), 5)
    const text = print(built.document)

    expect(built.variables).toEqual({
      locationIds: [3],
      industries: ['Consulting'],
      skills: ['Vue'],
      sizeBands: ['SMALL'],
      workModes: ['REMOTE'],
      languages: ['ENGLISH']
    })
    expect(text).toContain('$skills: [String!]!')
    expect(text).toContain('$sizeBands: [CompanySize!]!')
    // User values never become query text.
    expect(text).not.toContain('Vue')
    expect(text).not.toContain('Consulting')
    for (const clause of [
      /favoritedAt: \{\s*neq: null/,
      /avoidedAt: \{\s*eq: null/,
      /contacts: \{\s*any: true/,
      /or: \[\{\s*researchedAt: \{\s*neq: null/
    ])
      expect(text).toMatch(clause)
  })

  it('counts a company as not researched only without a date, type or description', () => {
    const facets = { ...emptyCompaniesFacets(), researched: 'no' as const }
    expect(args(buildCompaniesQuery(view({ facets }), 5))).toMatch(
      /researchedAt: \{\s*eq: null\s*\},\s*kind: \{\s*eq: null\s*\},\s*description: \{\s*eq: null/
    )
  })

  it('sorts descending with the name as tie-break', () => {
    expect(args(buildCompaniesQuery(view({ sort: 'size' }), 5))).toMatch(
      /order: \[\{\s*sizeBand: DESC\s*\}, \{\s*name: ASC\s*\}\]/
    )
  })
})

describe('companies view in the URL', () => {
  it('round-trips a full view and leaves defaults out', () => {
    const full = view({
      search: 'bekk',
      tab: 'consultancies',
      sort: 'researched',
      page: 3,
      facets: {
        favorites: true,
        hideAvoided: true,
        hasContacts: true,
        researched: 'no',
        locationIds: [1, 2],
        industries: ['Consulting'],
        skills: ['Vue', 'C#'],
        sizeBands: ['LARGE'],
        workModes: ['HYBRID'],
        languages: ['NORWEGIAN']
      }
    })
    expect(parseCompaniesQuery(toCompaniesQuery(full))).toEqual(full)
    expect(toCompaniesQuery(view())).toEqual({})
  })

  it('reads older links and drops unknown values', () => {
    expect(
      parseCompaniesQuery({
        search: ' acme ',
        hideAvoided: '1',
        page: '2',
        tab: 'banks',
        size: 'HUGE,SMALL',
        location: 'x,4'
      })
    ).toEqual(
      view({
        search: 'acme',
        page: 2,
        facets: {
          ...emptyCompaniesFacets(),
          hideAvoided: true,
          sizeBands: ['SMALL'],
          locationIds: [4]
        }
      })
    )
  })
})
