import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { UProgress } from '#components'
import LlmUsage from '~/components/dashboard/LlmUsage.vue'
import { llmModels, ownKeyModel } from '../fixtures/llmModels'
import { callLimit, usageToday } from '../fixtures/providerKeys'

let limits: ReturnType<typeof callLimit>[] = []
let limitRequests = 0

beforeEach(() => {
  clearNuxtData()
  limits = []
  limitRequests = 0
  useAuthStore().user = { id: '1', email: 'owner@example.com', role: 'Owner' }
})

// No limit on the shared pool unless a test sets one.
const usage = (extra: object = {}) =>
  usageToday({
    requests: 120,
    inputTokens: 4000,
    outputTokens: 1500,
    requestsLimit: null,
    remainingRequests: null,
    ...extra
  })
// The default model running on the owner's OpenAI key: usage today reports no limit for it.
const ownUsage = (extra: object = {}) =>
  usage({ model: ownKeyModel.id, provider: 'openai', keySource: 'USER', ...extra })

const mountWith = async (llmUsageToday: object) => {
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query } = await readBody(event)
      if (query.includes('query LlmCallLimits')) {
        limitRequests++
        return { data: { llmCallLimits: limits } }
      }
      if (query.includes('query LlmModels'))
        return {
          data: { llmModels: { ...llmModels(), models: [...llmModels().models, ownKeyModel] } }
        }
      return { data: { llmUsageToday } }
    }
  })
  const wrapper = await mountSuspended(LlmUsage)
  await vi.waitFor(() =>
    expect(wrapper.find('[data-testid="dashboard-llm-usage"]').exists()).toBe(true)
  )
  return wrapper
}
const bar = (wrapper: Awaited<ReturnType<typeof mountWith>>) =>
  wrapper.find('[data-testid="dashboard-llm-usage-bar"]')

describe('LlmUsage widget', () => {
  it('shows the shared pool’s cap as counting all users, without asking for limits', async () => {
    const wrapper = await mountWith(usage({ requestsLimit: 500, remainingRequests: 380 }))

    expect(wrapper.text()).toContain('of 500')
    expect(wrapper.text()).toContain('380 remaining for all users')
    expect(bar(wrapper).exists()).toBe(true)
    expect(limitRequests).toBe(0)
  })

  it('warns on the bar from 80 % and turns it red at the cap', async () => {
    const near = await mountWith(
      usage({ requests: 420, requestsLimit: 500, remainingRequests: 80 })
    )
    expect(near.getComponent(UProgress).props('color')).toBe('warning')
    near.unmount()
    clearNuxtData()

    const full = await mountWith(usage({ requests: 500, requestsLimit: 500, remainingRequests: 0 }))
    expect(full.getComponent(UProgress).props('color')).toBe('error')
  })

  it('shows only the count and tokens without a limit', async () => {
    const wrapper = await mountWith(usage())

    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('4K')
    expect(wrapper.text()).toContain('No daily limit')
    expect(wrapper.text()).not.toContain('remaining')
    expect(bar(wrapper).exists()).toBe(false)
  })

  it('on an own key, uses the owner’s limit for that provider', async () => {
    limits = [callLimit('mistral', 10, 9), callLimit('openai', 50, 45)]
    const wrapper = await mountWith(ownUsage())

    await vi.waitFor(() => expect(wrapper.text()).toContain('45 of 50'))
    expect(limitRequests).toBe(1)
    expect(wrapper.text()).toContain('5 remaining')
    expect(wrapper.text()).not.toContain('all users')
    expect(wrapper.getComponent(UProgress).props('color')).toBe('warning')
    expect(wrapper.get('[data-testid="dashboard-llm-usage-model"]').text()).toBe('GPT-4.1 mini')
  })

  it('on an own key without a limit, shows no cap even if usage reports one', async () => {
    limits = [callLimit('openai', null, 7)]
    const wrapper = await mountWith(ownUsage({ requests: 7, requestsLimit: 500 }))

    await vi.waitFor(() => expect(limitRequests).toBe(1))
    await vi.waitFor(() => expect(wrapper.text()).toContain('No daily limit'))
    expect(wrapper.text()).not.toContain('of 500')
    expect(bar(wrapper).exists()).toBe(false)
  })

  it('says a paused own key is paused in Settings', async () => {
    limits = [callLimit('openai', 0, 0)]
    const wrapper = await mountWith(ownUsage({ requests: 0 }))

    await vi.waitFor(() => expect(wrapper.text()).toContain('Paused in Settings'))
    expect(wrapper.text()).not.toContain('remaining')
    expect(bar(wrapper).exists()).toBe(false)
  })

  it('links the owner to usage in Settings, but not a guest', async () => {
    const owner = await mountWith(usage())
    expect(owner.find('a[href="/settings#usage"]').exists()).toBe(true)
    owner.unmount()
    clearNuxtData()

    useAuthStore().user = { id: '2', email: '', role: 'Guest' }
    const guest = await mountWith(usage())
    expect(guest.find('a[href="/settings#usage"]').exists()).toBe(false)
  })

  it('names the model the numbers are for', async () => {
    const wrapper = await mountWith(usage())
    const model = () => wrapper.get('[data-testid="dashboard-llm-usage-model"]').text()

    await vi.waitFor(() => expect(model()).toBe('Fast'))
    expect(wrapper.text()).not.toContain('all users')
  })

  it('falls back to the model id when it has no label', async () => {
    const wrapper = await mountWith(usage({ model: 'retired' }))

    expect(wrapper.get('[data-testid="dashboard-llm-usage-model"]').text()).toBe('retired')
  })
})
