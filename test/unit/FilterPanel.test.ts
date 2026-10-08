import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FilterPanel from '~/components/listings/FilterPanel.vue'
import { emptyFacets } from '~/composables/useListingsList'

describe('FilterPanel', () => {
  it('starts closed, opens with the toggle and shows the active count', async () => {
    const wrapper = await mountSuspended(FilterPanel, {
      props: {
        facets: { ...emptyFacets(), statuses: ['APPLIED'], favorites: true },
        sort: 'due',
        search: ''
      }
    })
    expect(wrapper.find('[data-testid="listings-facet-status"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="listings-filters-clear"]').exists()).toBe(true)

    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="listings-facet-status"]').exists()).toBe(true)
  })

  it('counts the posted range once and shows the date inputs', async () => {
    const wrapper = await mountSuspended(FilterPanel, {
      props: {
        facets: { ...emptyFacets(), postedFrom: '2026-10-01', postedTo: '2026-10-07' },
        sort: 'due',
        search: ''
      }
    })
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('1')
    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    const from = wrapper.get('[data-testid="listings-facet-postedFrom"]')
    expect((from.element as HTMLInputElement).value).toBe('2026-10-01')
    expect(wrapper.find('[data-testid="listings-facet-due"]').exists()).toBe(true)
  })
})
