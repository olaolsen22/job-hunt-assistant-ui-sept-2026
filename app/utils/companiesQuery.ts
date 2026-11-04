import type { ResultOf, TadaDocumentNode } from 'gql.tada'
import { parse, print } from '@0no-co/graphql.web'
import {
  COMPANY_SIZE_OPTIONS,
  COMPANY_SORTS,
  COMPANY_TABS,
  EMPLOYER_KINDS,
  type CompaniesSort,
  type CompaniesTab,
  type CompanySize
} from '~/constants/company'
import {
  LANGUAGE_OPTIONS,
  WORK_MODE_OPTIONS,
  type Language,
  type WorkMode
} from '~/constants/listing'
import { graphql } from './graphql'
import { intParam, knownParams, listParam } from './urlQuery'

const COMPANY_ITEM = graphql(`
  fragment CompanyListItem on Company {
    id
    name
    kind
    listingCount
    applicationCount
    favoritedAt
    avoidedAt
    sizeBand
    industry {
      name
    }
    locations {
      location {
        city
        countryCode
      }
    }
    contacts {
      id
    }
  }
`)

export type CompanyListItem = ResultOf<typeof COMPANY_ITEM>

export interface CompaniesFacets {
  favorites: boolean
  hideAvoided: boolean
  hasContacts: boolean
  researched: 'any' | 'yes' | 'no'
  locationIds: number[]
  industries: string[]
  skills: string[]
  sizeBands: CompanySize[]
  workModes: WorkMode[]
  languages: Language[]
}

export interface CompaniesView {
  search: string
  tab: CompaniesTab
  sort: CompaniesSort
  facets: CompaniesFacets
  page: number
}

export const emptyCompaniesFacets = (): CompaniesFacets => ({
  favorites: false,
  hideAvoided: false,
  hasContacts: false,
  researched: 'any',
  locationIds: [],
  industries: [],
  skills: [],
  sizeBands: [],
  workModes: [],
  languages: []
})

// How many facets narrow the list (Favorites included), for Clear all and the Filters badge.
export const countActiveCompaniesFacets = (f: CompaniesFacets) =>
  [
    f.favorites,
    f.hideAvoided,
    f.hasContacts,
    f.researched !== 'any',
    ...[f.locationIds, f.industries, f.skills, f.sizeBands, f.workModes, f.languages].map(
      (values) => values.length > 0
    )
  ].filter(Boolean).length

const values = <T extends string>(options: readonly { value: T }[]) => options.map((o) => o.value)

// The whole view lives in the URL. `search`, `hideAvoided` and `page` keep the names older links
// use; unknown values are dropped.
export const parseCompaniesQuery = (query: Record<string, unknown>): CompaniesView => ({
  search: String(query.search ?? '').trim(),
  tab: knownParams(values(COMPANY_TABS), query.tab)[0] ?? 'all',
  sort: knownParams(values(COMPANY_SORTS), query.sort)[0] ?? 'name',
  facets: {
    favorites: query.favorites === '1',
    hideAvoided: query.hideAvoided === '1',
    hasContacts: query.contacts === '1',
    researched: knownParams(['yes', 'no'] as const, query.researched)[0] ?? 'any',
    locationIds: listParam(query.location).flatMap((v) => intParam(v) ?? []),
    industries: listParam(query.industry),
    skills: listParam(query.skill),
    sizeBands: knownParams(values(COMPANY_SIZE_OPTIONS), query.size),
    workModes: knownParams(values(WORK_MODE_OPTIONS), query.workMode),
    languages: knownParams(values(LANGUAGE_OPTIONS), query.language)
  },
  page: intParam(query.page) ?? 1
})

// Defaults are left out, so a plain /companies stays plain.
export const toCompaniesQuery = ({ search, tab, sort, facets: f, page }: CompaniesView) => {
  const query: Record<string, string> = {
    search,
    tab: tab === 'all' ? '' : tab,
    sort: sort === 'name' ? '' : sort,
    favorites: f.favorites ? '1' : '',
    hideAvoided: f.hideAvoided ? '1' : '',
    contacts: f.hasContacts ? '1' : '',
    researched: f.researched === 'any' ? '' : f.researched,
    location: f.locationIds.join(','),
    industry: f.industries.join(','),
    skill: f.skills.join(','),
    size: f.sizeBands.join(','),
    workMode: f.workModes.join(','),
    language: f.languages.join(','),
    page: page > 1 ? String(page) : ''
  }
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value))
}

const TAB_CLAUSES: Record<CompaniesTab, string | null> = {
  all: null,
  consultancies: 'kind: { eq: CONSULTANCY }',
  employers: `kind: { in: [${EMPLOYER_KINDS.join(', ')}] }`
}

// researchedAt is set only by createCompanies (an edit-form save leaves it), so a type or a
// description also counts as researched.
const RESEARCHED = {
  yes: 'or: [{ researchedAt: { neq: null } }, { kind: { neq: null } }, { description: { neq: null } }]',
  no: 'researchedAt: { eq: null }, kind: { eq: null }, description: { eq: null }'
} as const

// Facets that carry user values go in as typed variables, never as query text.
const FACETS = {
  locationIds: {
    clause: 'locations: { some: { locationId: { in: $locationIds } } }',
    type: '[Int!]!'
  },
  industries: { clause: 'industry: { name: { in: $industries } }', type: '[String!]!' },
  skills: { clause: 'skills: { some: { skill: { name: { in: $skills } } } }', type: '[String!]!' },
  sizeBands: { clause: 'sizeBand: { in: $sizeBands }', type: '[CompanySize!]!' },
  workModes: { clause: 'workMode: { in: $workModes }', type: '[WorkMode!]!' },
  languages: { clause: 'workingLanguage: { in: $languages }', type: '[Language!]!' }
} as const

type CompaniesResult = {
  companies: {
    nodes: CompanyListItem[] | null
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    totalCount: number
  } | null
}

// Built at runtime like the listings query: a CompanyFilterInput or `first` variable fails the
// API's cost check (HC0047), so `where` and `first` are literal text. `pageSize` is the measured
// number of rows that fit.
export const buildCompaniesQuery = (
  { tab, sort, facets }: Pick<CompaniesView, 'tab' | 'sort' | 'facets'>,
  pageSize: number
) => {
  const declarations = ['$search: String', '$after: String']
  const variables: Record<string, unknown> = {}
  const clauses = [TAB_CLAUSES[tab]]
  if (facets.favorites) clauses.push('favoritedAt: { neq: null }')
  if (facets.hideAvoided) clauses.push('avoidedAt: { eq: null }')
  if (facets.hasContacts) clauses.push('contacts: { any: true }')
  if (facets.researched !== 'any') clauses.push(RESEARCHED[facets.researched])
  for (const key of Object.keys(FACETS) as (keyof typeof FACETS)[]) {
    if (!facets[key].length) continue
    clauses.push(FACETS[key].clause)
    declarations.push(`$${key}: ${FACETS[key].type}`)
    variables[key] = facets[key]
  }
  const active = clauses.filter(Boolean)
  const args = [
    'search: $search',
    `first: ${pageSize}`,
    'after: $after',
    `order: ${COMPANY_SORTS.find((s) => s.value === sort)!.order}`,
    active.length ? `where: { and: [{ ${active.join(' }, { ')} }] }` : ''
  ]
  const text = `
    query Companies(${declarations.join(', ')}) {
      companies(${args.filter(Boolean).join(', ')}) {
        nodes { ...CompanyListItem }
        pageInfo { hasNextPage endCursor }
        totalCount
      }
    }
    ${print(COMPANY_ITEM)}
  `
  return {
    document: parse(text) as TadaDocumentNode<CompaniesResult, Record<string, unknown>>,
    variables
  }
}
