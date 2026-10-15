import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Row from '~/components/listings/Row.vue'
import type { ListingListItem } from '~/composables/useListingsList'

const listing = (overrides: Partial<ListingListItem> = {}): ListingListItem => ({
  id: 7,
  title: 'Frontend Developer',
  company: { name: 'Acme', avoidedAt: null },
  locations: [
    { location: { city: 'Oslo', countryCode: 'NO' } },
    { location: { city: 'Bergen', countryCode: 'NO' } }
  ],
  postedOn: '2026-10-01',
  deadlineType: 'DATE',
  deadlineOn: '2026-12-01',
  dueOn: '2026-12-01',
  url: 'https://example.com/ad',
  favoritedAt: null,
  analyzedAt: '2026-10-02T10:00:00Z',
  status: 'SAVED',
  jobRole: { name: 'Developer' },
  seniority: 'SENIOR',
  ...overrides
})

describe('ListingsRow', () => {
  it('links the title to the listing and the ad externally', async () => {
    const wrapper = await mountSuspended(Row, { props: { listing: listing() } })
    expect(wrapper.get('h3 a').attributes('href')).toBe('/listings/7')
    const ad = wrapper.get('[data-testid="listing-view-ad"]')
    expect(ad.attributes('href')).toBe('https://example.com/ad')
    expect(ad.attributes('target')).toBe('_blank')
    expect(ad.attributes('aria-label')).toBe('View ad for Frontend Developer')
  })

  it('shows the first location with a count of the rest, and the seniority', async () => {
    const wrapper = await mountSuspended(Row, { props: { listing: listing() } })
    expect(wrapper.get('[data-testid="listing-location"]').text()).toMatch(/^Oslo, .+\s+\+1$/)
    expect(wrapper.text()).toContain('Senior')
  })

  it('flags an unanalyzed listing and leaves out a missing seniority', async () => {
    const wrapper = await mountSuspended(Row, {
      props: { listing: listing({ analyzedAt: null, seniority: null, locations: [] }) }
    })
    expect(wrapper.get('[data-testid="listing-analyzed"]').text()).toBe('To analyze')
    expect(wrapper.text()).not.toContain('Senior')
    expect(wrapper.get('[data-testid="listing-location"]').text()).toBe('Location not specified')
  })
})
