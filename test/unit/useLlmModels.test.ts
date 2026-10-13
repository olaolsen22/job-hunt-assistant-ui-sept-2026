import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useLlmModels } from '~/composables/useLlmModels'

type Body = { query: string; variables: Record<string, unknown> }

const llmModels = (defaultModel: string) => ({
  models: [
    { id: 'fast', label: 'Fast' },
    { id: 'strong', label: 'Strong' }
  ],
  defaultModel
})

let calls: Body[] = []
let saveReply: (model: unknown) => unknown

registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels('fast') } }
    if (body.query.includes('mutation SetDefaultLlmModel'))
      return { data: { setDefaultLlmModel: saveReply(body.variables.model) } }
    return {
      data: {
        llmUsageToday: {
          model: 'fast',
          requests: 1,
          inputTokens: 1,
          outputTokens: 1,
          requestsLimit: null,
          remainingRequests: null,
          resetsAt: '2026-10-13T00:00:00Z'
        }
      }
    }
  }
})

const count = (name: string) => calls.filter((c) => c.query.includes(name)).length

const setup = async () => {
  let state!: ReturnType<typeof useLlmModels>
  await mountSuspended(
    defineComponent({
      setup() {
        state = useLlmModels()
        // Mounted like the dashboard widget, so a saved default must refresh it.
        useLlmUsage()
        return () => h('div')
      }
    })
  )
  await vi.waitFor(() => expect(state.defaultModel.value).toBe('fast'))
  await vi.waitFor(() => expect(count('DashboardLlmUsage')).toBe(1))
  return state
}

beforeEach(() => {
  clearNuxtData()
  calls = []
})

describe('useLlmModels', () => {
  it('saves a default, uses the returned list and refreshes usage', async () => {
    saveReply = (model) => ({ llmModels: llmModels(model as string), errors: null })
    const state = await setup()

    expect(await state.setDefault('strong')).toBe(true)

    expect(calls.at(-2)?.variables).toEqual({ model: 'strong' })
    expect(state.defaultModel.value).toBe('strong')
    expect(state.label('strong')).toBe('Strong')
    expect(count('DashboardLlmUsage')).toBe(2)
    // The mutation's own list is used, not a second models request.
    expect(count('query LlmModels')).toBe(1)
  })

  it('sends null to reset to the app default', async () => {
    saveReply = () => ({ llmModels: llmModels('fast'), errors: null })
    const state = await setup()

    await state.setDefault(null)

    expect(calls.find((c) => c.query.includes('SetDefaultLlmModel'))?.variables).toEqual({
      model: null
    })
  })

  it('refetches the models after an unknown model', async () => {
    saveReply = () => ({
      llmModels: null,
      errors: [{ __typename: 'UnknownLlmModelError', message: 'That model isn’t available.' }]
    })
    const state = await setup()

    expect(await state.setDefault('gone')).toBe(false)

    expect(count('query LlmModels')).toBe(2)
    expect(count('DashboardLlmUsage')).toBe(1)
  })

  it('falls back to the id for unknown labels', async () => {
    const state = await setup()

    expect(state.label('other')).toBe('other')
  })
})
