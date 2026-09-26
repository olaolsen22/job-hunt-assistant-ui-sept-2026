import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ApiHealth from '~/components/dashboard/ApiHealth.vue'

describe('ApiHealth', () => {
  it('shows Healthy when the API answers 200', async () => {
    registerEndpoint('/api/health', () => 'Healthy')

    const wrapper = await mountSuspended(ApiHealth)
    await flushPromises()

    expect(wrapper.get('[data-testid="api-health"]').text()).toBe('Healthy')
  })
})
