import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Table from '~/components/listings/Table.vue'
import type { ListingListItem, ListingsSort } from '~/composables/useListingsList'

const listing: ListingListItem = {
  id: 7,
  title: 'Frontend Developer',
  company: { name: 'Acme', avoidedAt: null },
  locations: [{ location: { city: 'Oslo', countryCode: 'NO' } }],
  postedOn: '2026-10-01',
  deadlineType: 'DATE',
  deadlineOn: '2026-12-01',
  dueOn: '2026-12-01',
  url: 'https://example.com/ad',
  favoritedAt: null,
  archivedAt: null,
  analyzedAt: null,
  status: 'APPLIED',
  jobRole: { name: 'Developer' },
  seniority: 'SENIOR'
}

const mount = (sort: ListingsSort) =>
  mountSuspended(Table, { props: { listings: [listing], loading: false, skeletonRows: 3, sort } })

// The header emits the next sort; the parent owns the value (v-model), so each step remounts.
const clickHeader = async (sort: ListingsSort, column: string) => {
  const wrapper = await mount(sort)
  await wrapper.get(`[data-testid="listings-sort-${column}"]`).trigger('click')
  return wrapper.emitted('update:sort')?.[0]?.[0]
}

describe('ListingsTable', () => {
  it('renders the listing with a link to it and its row actions', async () => {
    const wrapper = await mount('due')
    expect(wrapper.get('[data-testid="listing-title"]').attributes('href')).toBe('/listings/7')
    expect(wrapper.text()).toContain('Acme · Developer')
    expect(wrapper.text()).toContain('Senior')
    expect(wrapper.get('[data-testid="listing-analyzed"]').text()).toBe('To analyze')
    expect(wrapper.get('[data-testid="listing-view-ad"]').attributes('href')).toBe(
      'https://example.com/ad'
    )
  })

  it('cycles a column header through its two directions and back to the due order', async () => {
    expect(await clickHeader('due', 'title')).toBe('title-asc')
    expect(await clickHeader('title-asc', 'title')).toBe('title-desc')
    expect(await clickHeader('title-desc', 'title')).toBe('due')
  })

  it('starts the posted column newest first, the same order as the Newest posted option', async () => {
    expect(await clickHeader('due', 'posted')).toBe('posted')
    expect(await clickHeader('posted', 'posted')).toBe('posted-asc')
  })

  it('has no reverse for due, which only returns to the default order', async () => {
    expect(await clickHeader('status-asc', 'due')).toBe('due')
    // Already the default: nothing to change, so v-model emits nothing.
    expect(await clickHeader('due', 'due')).toBeUndefined()
  })

  it('shows the right star when the Favorites filter swaps the listings in place', async () => {
    const wrapper = await mount('due')
    const star = () => wrapper.get('[data-testid="listing-favorite"]')
    expect(star().attributes('aria-pressed')).toBe('false')

    await wrapper.setProps({
      listings: [{ ...listing, id: 8, favoritedAt: '2026-10-05T10:00:00Z' }]
    })
    await vi.waitFor(() => expect(star().attributes('aria-pressed')).toBe('true'))
  })
})
