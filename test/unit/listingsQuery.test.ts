import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  emptyFacets,
  parseListingsQuery,
  toListingsQuery,
  useListingsView,
  type ListingsView
} from '~/composables/useListingsList'

const view = (overrides: Partial<ListingsView> = {}): ListingsView => ({
  search: '',
  sort: 'posted',
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
        quickPreset: 'genericLocal',
        favorites: true,
        shortlist: true,
        preferredLocations: true,
        norwayOnly: true,
        showRejected: true,
        itRoles: true,
        nonItRoles: true,
        englishPosting: true,
        englishMentioned: true,
        statuses: ['APPLIED', 'OFFER'],
        skills: ['Vue', 'TypeScript'],
        locationIds: [3, 7],
        postingLanguages: ['NORWEGIAN'],
        languages: ['ENGLISH'],
        postedFrom: '2026-10-01',
        postedTo: '2026-10-07',
        dueWithinDays: 14,
        companyId: 9
      },
      page: 2
    })
    expect(parseListingsQuery(toListingsQuery(full))).toEqual(full)
  })

  it('restores Shortlist independently of Favorites', () => {
    const { facets } = parseListingsQuery({ shortlist: '1' })
    expect(facets.shortlist).toBe(true)
    expect(facets.favorites).toBe(false)
    expect(parseListingsQuery({ shortlist: 'yes' }).facets.shortlist).toBe(false)
  })

  it('leaves the default view out of the URL', () => {
    expect(toListingsQuery(view())).toEqual({})
  })

  it('still reads the dashboard links', () => {
    expect(parseListingsQuery({ filter: 'toAnalyze' }).filter).toBe('toAnalyze')
    expect(parseListingsQuery({ status: 'OFFER' }).facets.statuses).toEqual(['OFFER'])
    expect(parseListingsQuery({ favorites: '1' }).facets.favorites).toBe(true)
    expect(parseListingsQuery({ preferred: '1' }).facets.preferredLocations).toBe(true)
    expect(parseListingsQuery({ it: '1' }).facets.itRoles).toBe(true)
    expect(parseListingsQuery({ nonIt: '1' }).facets.nonItRoles).toBe(true)
    expect(parseListingsQuery({ company: '12' }).facets.companyId).toBe(12)
  })

  it('restores a table column sort from the URL', () => {
    expect(parseListingsQuery({ sort: 'status-desc' }).sort).toBe('status-desc')
    expect(toListingsQuery({ ...view(), sort: 'status-desc' })).toEqual({ sort: 'status-desc' })
  })

  it('remembers the last list view across a reload', async () => {
    useListingsView().value = '/listings?sort=title-asc&norway=1'
    await nextTick()
    // A reload starts with fresh in-memory state; only the tab's session storage is left.
    expect(sessionStorage.getItem('listingsView')).toBe('/listings?sort=title-asc&norway=1')
    expect(useListingsView().value).toBe('/listings?sort=title-asc&norway=1')
    sessionStorage.clear()
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
        company: 'bekk',
        page: '-2'
      })
    ).toEqual(view({ facets: { ...emptyFacets(), statuses: ['SAVED'], locationIds: [4] } }))
  })
})
