import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UButton } from '#components'
import FilterChips from '~/components/app/FilterChips.vue'

describe('FilterChips', () => {
  it('makes Clear all a prominent action and keeps individual removal available', async () => {
    const clear = vi.fn()
    const wrapper = await mountSuspended(FilterChips, {
      props: { chips: [{ key: 'status', label: 'Applied', clear }], testidPrefix: 'listings' }
    })
    const button = wrapper.findAllComponents(UButton).find((item) => item.text() === 'Clear all')!
    expect(button.props()).toMatchObject({
      color: 'primary',
      variant: 'solid',
      size: 'md',
      block: true,
      icon: 'i-lucide-filter-x'
    })
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.classes()).toContain('rounded-md')
    expect(button.classes()).toContain('w-full')
    await button.trigger('click')
    expect(wrapper.emitted('clearAll')).toHaveLength(1)
    expect(clear).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="listings-chip-status"]').trigger('click')
    expect(clear).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
