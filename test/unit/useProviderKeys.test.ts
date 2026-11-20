import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useLlmCallLimits, useProviderKeys } from '~/composables/useProviderKeys'
import { llmModels } from '../fixtures/llmModels'
import { callLimit, providerKey, retiredKey } from '../fixtures/providerKeys'

type Body = { query: string; variables: Record<string, unknown> }

let calls: Body[] = []
let keyErrors: unknown[] | null = null
let removeErrors: unknown[] | null = null
// What the server holds; a mutation changes it and the next ProviderKeys read returns it.
let serverKeys: ReturnType<typeof providerKey>[] = []

registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query, variables } = body
    if (query.includes('query ProviderKeys')) return { data: { providerKeys: serverKeys } }
    if (query.includes('query LlmCallLimits'))
      return { data: { llmCallLimits: [callLimit('openai', null)] } }
    if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    if (query.includes('mutation SetProviderKey')) {
      if (keyErrors) return { data: { setProviderKey: { providerKey: null, errors: keyErrors } } }
      const provider = variables.provider as string
      const saved = providerKey(provider, '9xQ2')
      // Setting a key retires the one it replaces.
      serverKeys = [
        ...serverKeys.map((k) =>
          k.provider === provider && k.configured ? retiredKey(provider, k.last4!) : k
        ),
        saved
      ].filter((k) => !(k.provider === provider && !k.configured && !k.retiredAt))
      return { data: { setProviderKey: { providerKey: saved, errors: null } } }
    }
    if (query.includes('mutation RemoveProviderKey')) {
      if (removeErrors)
        return { data: { removeProviderKey: { providerKey: null, errors: removeErrors } } }
      const provider = variables.provider as string
      const removed = providerKey(provider)
      serverKeys = [
        ...serverKeys.map((k) =>
          k.provider === provider && k.configured ? retiredKey(provider, k.last4!) : k
        ),
        removed
      ]
      return { data: { removeProviderKey: { providerKey: removed, errors: null } } }
    }
    if (query.includes('mutation SetLlmCallLimit'))
      return {
        data: {
          setLlmCallLimit: {
            limit: callLimit(variables.provider as string, variables.dailyRequestLimit as number),
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
  await vi.waitFor(() => expect(keys.keys.value).toHaveLength(3))
  await vi.waitFor(() => expect(limits.limits.value).toHaveLength(1))
  return { keys, limits }
}

beforeEach(() => {
  clearNuxtData()
  useToast().clear()
  calls = []
  keyErrors = null
  removeErrors = null
  // Not in label order, and with a replaced OpenAI key the list must hide.
  serverKeys = [
    providerKey('openai', 'a1b2'),
    providerKey('gemini'),
    retiredKey('openai', 'old9'),
    providerKey('mistral')
  ]
})

describe('useProviderKeys', () => {
  it('asks for retired keys too, but lists only live rows by provider name', async () => {
    const { keys } = await setup()

    expect(calls.find((c) => c.query.includes('query ProviderKeys'))?.query).toMatch(
      /providerKeys\(includeRetired: true\)/
    )
    expect(keys.keys.value.map((k) => [k.provider, k.last4])).toEqual([
      ['gemini', null],
      ['mistral', null],
      ['openai', 'a1b2']
    ])
  })

  it('finds a key by credential id, retired ones included', async () => {
    const { keys } = await setup()

    expect(keys.keyFor('openai-old9')).toMatchObject({
      last4: 'old9',
      retiredAt: expect.any(String)
    })
    expect(keys.keyFor('openai-a1b2')).toMatchObject({ last4: 'a1b2', retiredAt: null })
    expect(keys.keyFor('unknown')).toBeUndefined()
  })

  it('sends the key as a variable and refetches keys, models and limits', async () => {
    const { keys } = await setup()
    const before = {
      keys: count('query ProviderKeys'),
      models: count('query LlmModels'),
      limits: count('query LlmCallLimits')
    }

    expect(await keys.setKey('openai', 'sk-secret')).toBeUndefined()

    const sent = calls.find((c) => c.query.includes('mutation SetProviderKey'))!
    expect(sent.variables).toEqual({ provider: 'openai', apiKey: 'sk-secret' })
    expect(sent.query).not.toContain('sk-secret')
    expect(count('query ProviderKeys')).toBe(before.keys + 1)
    expect(count('query LlmModels')).toBe(before.models + 1)
    expect(count('query LlmCallLimits')).toBe(before.limits + 1)
    // The refetched list has the new key; the replaced one is only reachable by credential id.
    expect(keys.keys.value.find((k) => k.provider === 'openai')).toMatchObject({ last4: '9xQ2' })
    expect(keys.keyFor('openai-a1b2')?.retiredAt).toBeTruthy()
  })

  it('returns a provider key error, leaves the rows as they were and refetches nothing', async () => {
    keyErrors = [{ __typename: 'ProviderKeyError', message: 'The key was rejected.' }]
    const { keys } = await setup()
    const keyLoads = count('query ProviderKeys')

    expect(await keys.setKey('mistral', 'bad')).toBe('The key was rejected.')
    expect(keys.keys.value.find((k) => k.provider === 'mistral')).toMatchObject({
      configured: false
    })
    expect(count('query ProviderKeys')).toBe(keyLoads)
  })

  it('removes a key and refetches the list', async () => {
    const { keys } = await setup()

    expect(await keys.removeKey('openai')).toBe(true)

    expect(calls.find((c) => c.query.includes('mutation RemoveProviderKey'))?.variables).toEqual({
      provider: 'openai'
    })
    expect(keys.keys.value.find((k) => k.provider === 'openai')).toMatchObject({
      configured: false
    })
  })

  it('toasts the API’s message when removing fails and keeps the key', async () => {
    removeErrors = [{ __typename: 'ProviderKeyError', message: 'Could not remove the key.' }]
    const { keys } = await setup()

    expect(await keys.removeKey('openai')).toBe(false)

    expect(useToast().toasts.value.at(-1)?.title).toBe('Could not remove the key.')
    expect(keys.keys.value.find((k) => k.provider === 'openai')).toMatchObject({ last4: 'a1b2' })
  })
})

describe('useLlmCallLimits', () => {
  it('saves a limit and shows the returned numbers', async () => {
    const { limits } = await setup()

    expect(await limits.setLimit('openai', 50)).toBeUndefined()
    expect(calls.at(-1)?.variables).toEqual({ provider: 'openai', dailyRequestLimit: 50 })
    expect(limits.limits.value[0]).toMatchObject({ dailyRequestLimit: 50, remainingRequests: 48 })
  })
})
