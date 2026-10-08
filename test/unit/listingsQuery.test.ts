import { describe, expect, it } from 'vitest'
import {
  emptyFacets,
  parseListingsQuery,
  toListingsQuery,
  type ListingsView
} from '~/composables/useListingsList'

const view = (overrides: Partial<ListingsView> = {}): ListingsView => ({
  search: '',
  sort: 'due',
  filter: null,
  facets: emptyFacets(),
  page: 1,
  ...overrides
})

describe('listings URL query', () => {
  it('round-trips a full view', () => {
    const full = view({
      search: 'frontend',
      sort: 'newest',
      filter: 'closingSoon',
      facets: {
        favorites: true,
        statuses: ['APPLIED', 'OFFER'],
        skills: ['Vue', 'TypeScript'],
        locationIds: [3, 7],
        postingLanguages: ['NORWEGIAN'],
        languages: ['ENGLISH'],
        postedFrom: '2026-10-01',
        postedTo: '2026-10-07',
        dueWithinDays: 14
      },
      page: 2
    })
    expect(parseListingsQuery(toListingsQuery(full))).toEqual(full)
  })

  it('leaves the default view out of the URL', () => {
    expect(toListingsQuery(view())).toEqual({})
  })

  it('still reads the dashboard links', () => {
    expect(parseListingsQuery({ filter: 'toAnalyze' }).filter).toBe('toAnalyze')
    expect(parseListingsQuery({ status: 'OFFER' }).facets.statuses).toEqual(['OFFER'])
    expect(parseListingsQuery({ favorites: '1' }).facets.favorites).toBe(true)
  })

  it('ignores unknown values', () => {
    expect(
      parseListingsQuery({
        filter: 'nope',
        sort: 'oldest',
        status: 'NOPE,SAVED',
        language: 'KLINGON',
        location: 'x,4',
        favorites: 'yes',
        postedFrom: 'yesterday',
        due: '5',
        page: '-2'
      })
    ).toEqual(view({ facets: { ...emptyFacets(), statuses: ['SAVED'], locationIds: [4] } }))
  })
})
