import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import AddPage from '~/pages/listings/add.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', { method: 'POST', handler: () => ({ data: {} }) })

describe('Filled-from-ad notice', () => {
  it('shows after a parse result is applied and can be dismissed', async () => {
    const wrapper = await mountSuspended(AddPage, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-testid="filled-from-ad"]').exists()).toBe(false)

    wrapper.vm.onDraft({ title: 'Frontend Developer' })
    await flushPromises()

    expect(wrapper.get('[data-testid="filled-from-ad"]').text()).toContain('Nothing is saved yet')

    wrapper.vm.filledFromAd = false
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="filled-from-ad"]').exists()).toBe(false)
    )
    wrapper.unmount()
  })
})
