import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Table from '~/components/listings/Table.vue'
import type { ListingListItem, ListingsSort } from '~/composables/useListingsList'

const { tableWidth } = vi.hoisted(() => ({ tableWidth: { value: 1200 } }))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useElementSize: () => ({ width: tableWidth })
}))

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
  shortlistedAt: null,
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
  beforeEach(() => {
    tableWidth.value = 1200
  })

  it('renders the listing with a link to it and its row actions', async () => {
    const wrapper = await mount('due')
    expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
      'false'
    )
    expect(wrapper.get('[data-testid="listing-title"]').attributes('href')).toBe('/listings/7')
    expect(wrapper.get('table').classes()).toContain('max-w-[83rem]')
    expect(wrapper.get('table').classes()).toContain('min-w-[48rem]')
    expect(wrapper.text()).toContain('Acme · Developer')
    expect(wrapper.text()).toContain('Senior')
    expect(wrapper.get('[data-testid="listing-analyzed"]').text()).toBe('To analyze')
    expect(wrapper.get('[data-testid="listing-view-ad"]').attributes('href')).toBe(
      'https://example.com/ad'
    )
  })

  it('gives locations more width and shows multiple names across up to two lines', async () => {
    const wrapper = await mount('due')
    await wrapper.setProps({
      listings: [
        {
          ...listing,
          locations: [
            { location: { city: 'Oslo', countryCode: 'NO' } },
            { location: { city: 'Bergen', countryCode: 'NO' } }
          ]
        }
      ]
    })
    const location = wrapper.get('[data-testid="listing-location"]')
    expect(location.text()).toContain('Oslo')
    expect(location.text()).toContain('Bergen')
    expect(location.text()).not.toContain('+1')
    expect(location.classes()).toContain('line-clamp-2')
    expect(location.classes()).toContain('whitespace-normal')
    expect(location.element.closest('td')?.classList.contains('w-40')).toBe(true)
    expect(location.attributes('title')).toBe(location.text())
    await wrapper.setProps({ listings: [{ ...listing, locations: [] }] })
    expect(location.text()).toBe('Location not specified')
    wrapper.unmount()
  })

  it('keeps seniority with the company until the table itself has room for its column', async () => {
    tableWidth.value = 1024
    const compact = await mount('due')
    expect(compact.find('[data-testid="listings-sort-seniority"]').exists()).toBe(false)
    expect(
      compact.get('[data-testid="listing-title"]').element.closest('td')?.textContent
    ).toContain('Senior')
    compact.unmount()

    tableWidth.value = 1216
    const wide = await mount('due')
    expect(wide.find('[data-testid="listings-sort-seniority"]').exists()).toBe(true)
    expect(
      wide.get('[data-testid="listing-title"]').element.closest('td')?.textContent
    ).not.toContain('Senior')
    expect(wide.text()).toContain('Senior')
    wide.unmount()
  })

  it('keeps a separate sortable Posted column in the compact table', async () => {
    tableWidth.value = 872
    const wrapper = await mount('due')
    const titleCell = wrapper.get('[data-testid="listing-title"]').element.closest('td')!
    const location = wrapper.get('[data-testid="listing-location"]')
    expect(titleCell.contains(location.element)).toBe(true)
    expect(location.text()).toContain('Oslo')
    expect(wrapper.find('[data-testid="listings-sort-posted"]').exists()).toBe(true)
    const dueCell = wrapper.get('[data-testid="listing-due"]').element.closest('td')!
    const posted = wrapper.get('[data-testid="listing-posted"]')
    expect(dueCell.contains(posted.element)).toBe(false)
    expect(posted.element.closest('td')).not.toBe(titleCell)
    expect(wrapper.findAll('[data-testid="listing-posted"]')).toHaveLength(1)
    expect(wrapper.findAll('tbody td')).toHaveLength(6)
    await wrapper.get('[data-testid="listings-sort-posted"]').trigger('click')
    expect(wrapper.emitted('update:sort')?.[0]).toEqual(['posted'])
    expect(wrapper.get('[data-testid="listing-title"]').text()).toBe(listing.title)
    expect(wrapper.find('[data-testid="listing-view-ad"]').exists()).toBe(true)
    wrapper.unmount()
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
