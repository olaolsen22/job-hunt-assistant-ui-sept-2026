import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import FilterFields from '~/components/listings/FilterFields.vue'
import { emptyFacets } from '~/composables/useListingsList'

describe('ListingsFilterFields', () => {
  it('edits the shared facets and keeps the date range constraints', async () => {
    const facets = reactive({ ...emptyFacets(), postedFrom: '2026-11-01', postedTo: '2026-11-30' })
    const wrapper = await mountSuspended(FilterFields, { props: { facets } })
    expect(wrapper.text()).not.toContain('Picking statuses above always shows exactly those.')
    expect(wrapper.get('[data-testid="listings-language-fields"]').classes()).toContain(
      '2xl:grid-cols-2'
    )
    await wrapper.get('[data-testid="listings-facet-rejected"]').trigger('click')
    expect(facets.showRejected).toBe(true)
    wrapper.findComponent(USelect).vm.$emit('update:modelValue', 7)
    expect(facets.dueWithinDays).toBe(7)
    wrapper.findComponent(USelect).vm.$emit('update:modelValue', 0)
    expect(facets.dueWithinDays).toBeNull()
    expect(wrapper.get('input[data-testid="listings-facet-postedFrom"]').attributes('max')).toBe(
      '2026-11-30'
    )
    expect(wrapper.get('input[data-testid="listings-facet-postedTo"]').attributes('min')).toBe(
      '2026-11-01'
    )
    wrapper.unmount()
  })
})
