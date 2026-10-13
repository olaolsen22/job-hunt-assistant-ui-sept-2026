import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useLlmCallLimits, useProviderKeys } from '~/composables/useProviderKeys'
import { llmModels } from '../fixtures/llmModels'

type Body = { query: string; variables: Record<string, unknown> }

const key = (provider: string, last4: string | null = null) => ({
  provider,
  configured: !!last4,
  last4,
  createdAt: last4 ? '2026-10-13T08:00:00Z' : null
})
const limit = (provider: string, dailyRequestLimit: number | null) => ({
  provider,
  dailyRequestLimit,
  requestsConsumed: 2,
  remainingRequests: dailyRequestLimit == null ? null : dailyRequestLimit - 2,
  resetsAt: '2026-10-14T00:00:00Z'
})

let calls: Body[] = []
let keyErrors: unknown[] | null = null

registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query, variables } = body
    if (query.includes('query ProviderKeys'))
      return { data: { providerKeys: [key('openai'), key('anthropic', 'a1b2')] } }
    if (query.includes('query LlmCallLimits'))
      return { data: { llmCallLimits: [limit('anthropic', null)] } }
    if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    if (query.includes('mutation SetProviderKey'))
      return {
        data: {
          setProviderKey: keyErrors
            ? { providerKey: null, errors: keyErrors }
            : { providerKey: key(variables.provider as string, '9xQ2'), errors: null }
        }
      }
    if (query.includes('mutation SetLlmCallLimit'))
      return {
        data: {
          setLlmCallLimit: {
            limit: limit(variables.provider as string, variables.dailyRequestLimit as number),
            errors: null
          }
        }
      }
    return { data: { llmUsageToday: null } }
  }
})

const count = (name: string) => calls.filter((c) => c.query.includes(name)).length

const setup = async () => {
  let keys!: ReturnType<typeof useProviderKeys>
  let limits!: ReturnType<typeof useLlmCallLimits>
  await mountSuspended(
    defineComponent({
      setup() {
        keys = useProviderKeys()
        limits = useLlmCallLimits()
        return () => h('div')
      }
    })
  )
  await vi.waitFor(() => expect(keys.keys.value).toHaveLength(2))
  await vi.waitFor(() => expect(limits.limits.value).toHaveLength(1))
  return { keys, limits }
}

beforeEach(() => {
  clearNuxtData()
  calls = []
  keyErrors = null
})

describe('useProviderKeys', () => {
  it('sends the key as a variable, shows the returned metadata and refreshes models and limits', async () => {
    const { keys } = await setup()
    const models = count('query LlmModels')
    const limits = count('query LlmCallLimits')

    expect(await keys.setKey('openai', 'sk-secret')).toBeUndefined()

    const sent = calls.find((c) => c.query.includes('mutation SetProviderKey'))!
    expect(sent.variables).toEqual({ provider: 'openai', apiKey: 'sk-secret' })
    expect(sent.query).not.toContain('sk-secret')
    expect(keys.keys.value[0]).toMatchObject({ provider: 'openai', last4: '9xQ2' })
    expect(count('query LlmModels')).toBe(models + 1)
    expect(count('query LlmCallLimits')).toBe(limits + 1)
  })

  it('returns a provider key error and leaves the row as it was', async () => {
    keyErrors = [{ __typename: 'ProviderKeyError', message: 'The key was rejected.' }]
    const { keys } = await setup()

    expect(await keys.setKey('openai', 'bad')).toBe('The key was rejected.')
    expect(keys.keys.value[0]).toMatchObject({ provider: 'openai', configured: false })
  })
})

describe('useLlmCallLimits', () => {
  it('saves a limit and shows the returned numbers', async () => {
    const { limits } = await setup()

    expect(await limits.setLimit('anthropic', 50)).toBeUndefined()
    expect(limits.limits.value[0]).toMatchObject({ dailyRequestLimit: 50, remainingRequests: 48 })
  })
})
