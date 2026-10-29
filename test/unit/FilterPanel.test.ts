import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FilterPanel from '~/components/listings/FilterPanel.vue'
import { emptyFacets, type ListingsFacets } from '~/composables/useListingsList'

const mount = (facets: Partial<ListingsFacets>) =>
  mountSuspended(FilterPanel, {
    props: {
      facets: reactive({ ...emptyFacets(), ...facets }),
      search: '',
      quickCounts
    },
    attachTo: document.body
  })

const quickCounts = { preferred: 3, it: 5, englishPosting: 2, englishMentioned: 4 }

// The facet sheet is a slideover, teleported out of the wrapper.
const inSheet = (testid: string) => document.body.querySelector(`[data-testid="${testid}"]`)

describe('FilterPanel', () => {
  it('counts only the sheet facets on Filters and opens the sheet', async () => {
    const wrapper = await mount({ statuses: ['APPLIED'], favorites: true })
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('1')
    expect(inSheet('listings-facet-status')).toBeNull()

    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() => expect(inSheet('listings-facet-status')).not.toBeNull())
    wrapper.unmount()
  })

  it('shows a removable chip per active facet and clears all of them', async () => {
    const facets = reactive<ListingsFacets>({
      ...emptyFacets(),
      statuses: ['APPLIED'],
      dueWithinDays: 7,
      favorites: true
    })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    expect(wrapper.get('[data-testid="listings-chip-status"]').text()).toBe('Status: Applied')

    await wrapper.get('[data-testid="listings-chip-due"]').trigger('click')
    expect(facets.dueWithinDays).toBeNull()
    expect(facets.statuses).toEqual(['APPLIED'])

    await wrapper.get('[data-testid="listings-filters-clear"]').trigger('click')
    expect(facets).toEqual(emptyFacets())
    expect(wrapper.find('[data-testid="listings-active"]').exists()).toBe(false)
  })

  it('shows the company from a dashboard link as a chip, outside the sheet count', async () => {
    const facets = reactive<ListingsFacets>({ ...emptyFacets(), companyId: 12 })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts, companyName: 'Bekk' }
    })
    expect(wrapper.get('[data-testid="listings-chip-company"]').text()).toBe('Company: Bekk')
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).not.toContain('1')

    await wrapper.get('[data-testid="listings-chip-company"]').trigger('click')
    expect(facets.companyId).toBeNull()
  })

  it('toggles favorites from the toolbar', async () => {
    const facets = reactive(emptyFacets())
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    const button = wrapper.get('[data-testid="listings-facet-favorites"]')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(facets.favorites).toBe(true)
  })

  it('counts the posted range once and shows it as one chip', async () => {
    const wrapper = await mount({ postedFrom: '2026-10-01', postedTo: '2026-10-07' })
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('1')
    expect(wrapper.findAll('[data-testid^="listings-chip-"]')).toHaveLength(1)

    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() => expect(inSheet('listings-facet-postedFrom')).not.toBeNull())
    const from = inSheet('listings-facet-postedFrom')!
    const input = from.matches('input') ? from : from.querySelector('input')!
    expect((input as HTMLInputElement).value).toBe('2026-10-01')
    wrapper.unmount()
  })

  it('counts a quick toggle on Filters and shows it as a removable chip', async () => {
    const facets = reactive<ListingsFacets>({ ...emptyFacets(), itRoles: true })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="listings-chip-it"]').text()).toBe('IT roles')

    await wrapper.get('[data-testid="listings-chip-it"]').trigger('click')
    expect(facets.itRoles).toBe(false)
  })
})
