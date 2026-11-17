import { describe, expect, it } from 'vitest'
import { parse, print } from '@0no-co/graphql.web'
import {
  LISTINGS_SORTS,
  buildListingsQuery,
  emptyFacets,
  type ListingsFacets,
  type ListingsFilter
} from '~/composables/useListingsList'
import { argumentProblems, inputValueProblems } from './helpers/apiInputContract'

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

  it('orders by posted date, newest first, for the posted sort', () => {
    const { variables } = buildListingsQuery(null, emptyFacets(), 'posted')
    expect(variables.order).toEqual([{ postedOn: 'DESC' }])
  })

  it('orders by a table column in the chosen direction', () => {
    expect(buildListingsQuery(null, emptyFacets(), 'title-desc').variables.order).toEqual([
      { title: 'DESC' }
    ])
    expect(buildListingsQuery(null, emptyFacets(), 'posted-asc').variables.order).toEqual([
      { postedOn: 'ASC' }
    ])
  })

  it('drops the expiry clause when statuses are picked', () => {
    const { text, variables } = build({ statuses: ['APPLIED'] })
    expect(text).toContain('status: {in: $statuses}')
    expect(text).not.toContain('$today')
    expect(variables).not.toHaveProperty('today')
    expect(variables.statuses).toEqual(['APPLIED'])
  })

  it('narrows to one company by id, keeping the expiry clause', () => {
    const { text, variables } = build({ companyId: 12 })
    expect(text).toContain('{companyId: {eq: $companyId}}')
    expect(text).toContain('$companyId: Int!')
    expect(text).toContain('$today')
    expect(variables.companyId).toBe(12)
  })

  it('joins two facets under and', () => {
    const { text } = build({ favorites: true, skills: ['Vue'] })
    expect(text).toContain(
      'where: {and: [{or: [{deadlineType: {neq: DATE}}, {deadlineOn: {gte: $today}}]}, {favoritedAt: {neq: null}}, {status: {neq: REJECTED}}, {skills: {some: {skill: {name: {in: $skills}}}}}]}'
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
    // The list, its five preset counts and the five quick-toggle counts.
    expect(text.match(/isTarget/g)).toHaveLength(12)
    expect(text).not.toContain(`${clause}}, {${clause}`)
  })
})

describe('rejected applications', () => {
  const clause = '{status: {neq: REJECTED}}'

  it('are left out of the list and every count by default', () => {
    const { text } = build({})
    // The list, its five preset counts and the five quick-toggle counts.
    expect(text.split(clause)).toHaveLength(13)
  })

  it('come back with the show rejected switch', () => {
    expect(build({ showRejected: true }).text).not.toContain(clause)
  })

  it('come back when statuses are picked, so ?status=REJECTED shows them', () => {
    const { text } = build({ statuses: ['REJECTED'] })
    expect(text).not.toContain(clause)
    expect(text).toContain('status: {in: $statuses}')
  })
})

describe('Norway only', () => {
  it('keeps listings whose every location is in Norway, and at least one', () => {
    const { text } = build({ norwayOnly: true })
    expect(text).toMatch(
      /listings\([^)]*locations: \{all: \{location: \{countryCode: \{eq: "NO"\}\}\}, any: true\}/
    )
    expect(text).toMatch(/norway: listings\(/)
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
    expect(text).toMatch(
      /nonIt: listings\([^)]*jobRoleId: \{gt: 0\}[^)]*category: \{name: \{neq: "IT"\}/
    )
    expect(text.match(/category: \{name: \{eq: "IT"/g)).toHaveLength(1)
  })

  it('narrows the list and every count to IT roles when on', () => {
    const { text } = build({ itRoles: true })
    expect(text.match(/category: \{name: \{eq: "IT"/g)).toHaveLength(12)
    expect(text).not.toContain(`${itClause}}, {${itClause}`)
  })

  it('narrows the list to roles with a non-IT category when on', () => {
    const { text } = build({ nonItRoles: true })
    const args = text.split('query Listings')[1]!.split('listings(')[1]!.split(') {')[0]
    expect(args).toContain('jobRoleId: {gt: 0}')
    expect(args).toContain('jobRole: {categoryId: {gt: 0}, category: {name: {neq: "IT"}}}')
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

describe('incl. expired preset', () => {
  it('lists non-archived listings without the expiry clause, still applying facets', () => {
    const facets = { ...emptyFacets(), favorites: true }
    const text = print(buildListingsQuery('withExpired', facets, 'due').document)
    const args = text.split('query Listings')[1]!.split('listings(')[1]!.split(')')[0]
    expect(args).not.toContain('deadlineOn')
    expect(args).not.toContain('archived')
    expect(args).toContain('favoritedAt: {neq: null}')
    expect(text).toContain('withExpired: listings(')
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
    // The printer puts long argument lists one per line, so match across either layout.
    expect(text).toMatch(
      /closingSoon: listings\(\s*take: 1,?\s+search: \$search,?\s+dueWithinDays: 3/
    )
    expect(text.match(/dueWithinDays: 3/g)).toHaveLength(12)
    expect(build({ dueWithinDays: 14 }).text).toMatch(
      /closingSoon: listings\(\s*take: 1,?\s+search: \$search,?\s+dueWithinDays: 7/
    )
  })

  it('leaves both out when unset', () => {
    const { text } = build({})
    expect(text).not.toContain('postedOn: {')
    expect(text.match(/dueWithinDays/g)).toHaveLength(1)
  })
})

// The query is built as text, so nothing else checks it against the API before it runs. Every
// alias is in every request: one rejected clause fails the whole page, even with its toggle off.
describe('API input contract', () => {
  const PRESETS: (ListingsFilter | null)[] = [
    null,
    'closingSoon',
    'toAnalyze',
    'withExpired',
    'archived'
  ]
  const toggles = (Object.keys(emptyFacets()) as (keyof ListingsFacets)[]).filter(
    (key) => emptyFacets()[key] === false
  )
  const everything: Partial<ListingsFacets> = {
    ...Object.fromEntries(toggles.map((key) => [key, true])),
    statuses: ['APPLIED'],
    skills: ['Vue'],
    locationIds: [1],
    postingLanguages: ['ENGLISH'],
    languages: ['ENGLISH'],
    postedFrom: '2026-10-01',
    postedTo: '2026-10-31',
    dueWithinDays: 3,
    companyId: 1
  }
  const facetSets: [string, Partial<ListingsFacets>][] = [
    ['nothing', {}],
    ...toggles.map((key): [string, Partial<ListingsFacets>] => [key, { [key]: true }]),
    ['everything', everything]
  ]
  const problems = (preset: ListingsFilter | null, facets: Partial<ListingsFacets>) =>
    argumentProblems(
      buildListingsQuery(preset, { ...emptyFacets(), ...facets }, 'due').document,
      'listings',
      { where: 'ListingFilterInput', order: 'ListingSortInput' }
    )

  for (const preset of PRESETS)
    it.each(facetSets)(
      `uses only filters the API accepts (${preset ?? 'no preset'}, %s)`,
      (_, facets) => {
        expect(problems(preset, facets)).toEqual([])
      }
    )

  it.each(LISTINGS_SORTS)('orders by fields the API can sort on (%s)', (sort) => {
    const { order } = buildListingsQuery(null, emptyFacets(), sort).variables
    expect(inputValueProblems(order, 'ListingSortInput', 'order')).toEqual([])
  })

  // Guards the check itself: this is the clause that broke the page.
  it('flags a null comparison on an id and a field the API lacks', () => {
    const document = parse(
      '{ listings(where: { jobRoleId: { neq: null }, favoritedAt: { neq: null }, jobRole: { colour: { eq: "x" } } }) { totalCount } }'
    )
    expect(argumentProblems(document, 'listings', { where: 'ListingFilterInput' })).toEqual([
      'listings(where).jobRoleId.neq: the API rejects null on IntOperationFilterInput (HC0026)',
      'listings(where).jobRole.colour: no such field on JobRoleFilterInput'
    ])
  })
})

describe('combined quick presets', () => {
  it.each([
    ['itIdeal', ['name: {eq: "IT"}', 'countryCode: {eq: "NO"}', 'isTarget: {eq: true}']],
    ['genericLocal', ['city: {eq: "Molde"}', 'name: {neq: "IT"}']],
    ['genericIdeal', ['isTarget: {eq: true}', 'name: {neq: "IT"}']],
    ['remote', ['all: {location: {countryCode: {neq: "NO"}}}', 'any: true']]
  ] as const)('applies %s to the listings query', (quickPreset, clauses) => {
    const { document } = buildListingsQuery(null, { ...emptyFacets(), quickPreset }, 'posted')
    const operation = document.definitions.find((d) => d.kind === 'OperationDefinition')!
    const listings = print({ kind: 'Document', definitions: [operation] }).split(
      'all: listings'
    )[0]!
    for (const clause of clauses) expect(listings).toContain(clause)
  })
})

describe('shortlist', () => {
  it('filters by bookmarked timestamp without requiring favorites', () => {
    const { text } = build({ shortlist: true })
    expect(text).toContain('shortlistedAt: {neq: null}')
    expect(text).not.toContain('favoritedAt: {neq: null}')
  })

  it('can intersect Shortlist and Favorites', () => {
    const { text } = build({ shortlist: true, favorites: true })
    expect(text).toContain('shortlistedAt: {neq: null}')
    expect(text).toContain('favoritedAt: {neq: null}')
    expect(build({}).text).not.toContain('shortlistedAt: {neq: null}')
  })
})
