import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LlmUsage from '~/components/dashboard/LlmUsage.vue'

beforeEach(() => clearNuxtData())

const usage = (extra: object) => ({
  requests: 120,
  inputTokens: 4000,
  outputTokens: 1500,
  requestsLimit: null,
  remainingRequests: null,
  resetsAt: '2026-10-07T07:00:00Z',
  ...extra
})

const mountWith = async (llmUsageToday: object) => {
  registerEndpoint('/graphql', { method: 'POST', handler: () => ({ data: { llmUsageToday } }) })
  const wrapper = await mountSuspended(LlmUsage)
  await vi.waitFor(() =>
    expect(wrapper.find('[data-testid="dashboard-llm-usage"]').exists()).toBe(true)
  )
  return wrapper
}

describe('LlmUsage widget', () => {
  it('shows the limit, remaining requests and a bar when a limit is set', async () => {
    const wrapper = await mountWith(usage({ requestsLimit: 500, remainingRequests: 380 }))

    expect(wrapper.text()).toContain('of 500')
    expect(wrapper.text()).toContain('380 remaining')
    expect(wrapper.find('[data-testid="dashboard-llm-usage-bar"]').exists()).toBe(true)
  })

  it('shows only the count and tokens without a limit', async () => {
    const wrapper = await mountWith(usage({}))

    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('4,000')
    expect(wrapper.text()).not.toContain('remaining')
    expect(wrapper.find('[data-testid="dashboard-llm-usage-bar"]').exists()).toBe(false)
  })
})
