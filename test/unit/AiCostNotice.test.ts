import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AiCostNotice from '~/components/app/AiCostNotice.vue'
import { llmModels, ownKeyModel } from '../fixtures/llmModels'

let models = llmModels()
let limitRequests = 0
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const { query } = await readBody(event)
    if (query.includes('query LlmCallLimits')) {
      limitRequests++
      return {
        data: {
          llmCallLimits: [
            {
              provider: 'openai',
              dailyRequestLimit: 20,
              requestsConsumed: 8,
              remainingRequests: 12,
              resetsAt: '2026-10-14T00:00:00Z'
            }
          ]
        }
      }
    }
    return { data: { llmModels: models } }
  }
})

beforeEach(() => {
  clearNuxtData()
  limitRequests = 0
})

const billing = async () => {
  const wrapper = await mountSuspended(AiCostNotice)
  await vi.waitFor(() =>
    expect(wrapper.find('[data-testid="ai-notice-model"]').exists()).toBe(true)
  )
  return wrapper
}

describe('AiCostNotice', () => {
  it('says the app’s key pays for a shared model, without asking for limits', async () => {
    models = llmModels()
    const wrapper = await billing()

    expect(wrapper.text()).toContain('Uses the app’s paid AI key')
    expect(wrapper.get('[data-testid="ai-notice-billing"]').text()).toContain(
      'billed to the app’s AI account and uses Fast'
    )
    expect(limitRequests).toBe(0)
  })

  it('links “Change model” straight to the model section in Settings', async () => {
    models = llmModels()
    const wrapper = await billing()

    const link = wrapper.findAll('a').find((a) => a.text() === 'Change model')!
    expect(link.attributes('href')).toBe('/settings#model')
  })

  it('names the owner’s own key and what is left of its daily limit', async () => {
    models = { models: [...llmModels().models, ownKeyModel], defaultModel: ownKeyModel.id }
    const wrapper = await billing()

    expect(wrapper.text()).toContain('Billed to your API key')
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="ai-notice-billing"]').text()).toContain(
        '12 requests left today.'
      )
    )
    expect(wrapper.get('[data-testid="ai-notice-billing"]').text()).toContain(
      'billed to your own OpenAI key and uses GPT-4.1 mini'
    )
  })
})
