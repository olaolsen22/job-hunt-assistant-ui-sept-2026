import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { UInputNumber, URadioGroup, USelect } from '#components'
import SettingsPage from '~/pages/settings.vue'
import { llmModels, ownKeyModel, unknownModelError } from '../fixtures/llmModels'

type Body = { query: string; variables?: Record<string, unknown> & { model?: string | null } }

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
  remainingRequests: dailyRequestLimit == null ? null : Math.max(0, dailyRequestLimit - 2),
  resetsAt: '2026-10-14T00:00:00Z'
})

let models = llmModels()
let loadFails = false
let saveErrors: unknown[] | null = null
let calls: Body[] = []
let limits = [limit('anthropic', null)]
let keyErrors: unknown[] | null = null

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    if (body.query.includes('query LlmModels')) {
      return loadFails ? { errors: [{ message: 'boom' }] } : { data: { llmModels: models } }
    }
    if (body.query.includes('mutation SetDefaultLlmModel')) {
      const model = body.variables?.model
      return {
        data: {
          setDefaultLlmModel: saveErrors
            ? { llmModels: null, errors: saveErrors }
            : { llmModels: llmModels(model ?? 'strong'), errors: null }
        }
      }
    }
    const vars = body.variables ?? {}
    if (body.query.includes('query ProviderKeys'))
      return { data: { providerKeys: [key('openai'), key('anthropic', 'a1b2')] } }
    if (body.query.includes('query LlmCallLimits')) return { data: { llmCallLimits: limits } }
    if (body.query.includes('mutation SetProviderKey'))
      return {
        data: {
          setProviderKey: keyErrors
            ? { providerKey: null, errors: keyErrors }
            : { providerKey: key(vars.provider as string, '9xQ2'), errors: null }
        }
      }
    if (body.query.includes('mutation RemoveProviderKey'))
      return {
        data: { removeProviderKey: { providerKey: key(vars.provider as string), errors: null } }
      }
    if (body.query.includes('mutation SetLlmCallLimit'))
      return {
        data: {
          setLlmCallLimit: {
            limit: limit(vars.provider as string, vars.dailyRequestLimit as number | null),
            errors: null
          }
        }
      }
    // The usage refresh after a save is not what this page is about.
    return { data: { llmUsageToday: null } }
  }
})

beforeEach(() => {
  clearNuxtData()
  models = llmModels()
  loadFails = false
  saveErrors = null
  keyErrors = null
  limits = [limit('anthropic', null)]
  calls = []
  useAuthStore().user = { id: '1', email: 'owner@example.com', role: 'Owner' }
})

const mountPage = async () => {
  const wrapper = await mountSuspended(SettingsPage, { attachTo: document.body })
  // The skeleton is the only aria-busy element; once it is gone the select or the error is showing.
  await vi.waitFor(() => expect(wrapper.find('[aria-busy]').exists()).toBe(false))
  return wrapper
}
const select = (wrapper: Awaited<ReturnType<typeof mountPage>>) => wrapper.getComponent(USelect)
const saves = () =>
  calls
    .filter((c) => c.query.includes('mutation SetDefaultLlmModel'))
    .map((c) => c.variables?.model)

describe('Settings page', () => {
  it('shows the saved model and saves another one', async () => {
    const wrapper = await mountPage()
    expect(select(wrapper).props('modelValue')).toBe('fast')

    select(wrapper).vm.$emit('update:modelValue', 'strong')
    await vi.waitFor(() => expect(saves()).toEqual(['strong']))
    await vi.waitFor(() => expect(select(wrapper).props('modelValue')).toBe('strong'))
    wrapper.unmount()
  })

  it('clears the default with null for "Use app default"', async () => {
    const wrapper = await mountPage()

    select(wrapper).vm.$emit('update:modelValue', 'app-default')
    await vi.waitFor(() => expect(saves()).toEqual([null]))
    wrapper.unmount()
  })

  it('puts the select back when saving fails', async () => {
    saveErrors = [unknownModelError]
    const wrapper = await mountPage()

    select(wrapper).vm.$emit('update:modelValue', 'strong')
    await vi.waitFor(() => expect(saves()).toEqual(['strong']))
    await flushPromises()
    expect(select(wrapper).props('modelValue')).toBe('fast')
    wrapper.unmount()
  })

  it('shows an error and no select when the models fail to load', async () => {
    loadFails = true
    const wrapper = await mountPage()

    expect(wrapper.findComponent(USelect).exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables the select for a single model', async () => {
    models = { models: [{ id: 'fast', label: 'Fast' }], defaultModel: 'fast' }
    const wrapper = await mountPage()

    expect(select(wrapper).props('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('marks a model that runs on the owner’s own key', async () => {
    models = { models: [...llmModels().models, ownKeyModel], defaultModel: 'fast' }
    const wrapper = await mountPage()

    const items = select(wrapper).props('items') as { label: string; value: string }[]
    expect(items.find((i) => i.value === ownKeyModel.id)?.label).toBe('GPT-4.1 mini · your key')
    wrapper.unmount()
  })

  it('shows a guest only the AI model section and asks for no keys or limits', async () => {
    useAuthStore().user = { id: '2', email: '', role: 'Guest' }
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="settings-ai-model"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-provider-keys"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="settings-daily-limits"]').exists()).toBe(false)
    expect(calls.some((c) => /ProviderKeys|LlmCallLimits/.test(c.query))).toBe(false)
    wrapper.unmount()
  })
})

describe('Settings provider keys', () => {
  const el = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  const click = async (id: string) => {
    el(id).click()
    await flushPromises()
  }
  const rows = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
    wrapper.findAll('[data-testid="provider-key-row"]').map((r) => r.text())
  const enterKey = async (value: string) => {
    const input = el('provider-key-input') as HTMLInputElement
    input.value = value
    input.dispatchEvent(new Event('input'))
    await flushPromises()
  }

  it('lists each provider with only the last four characters of a saved key', async () => {
    const wrapper = await mountPage()

    expect(rows(wrapper)).toEqual([
      expect.stringContaining('Not set'),
      expect.stringContaining('Key •••• a1b2')
    ])
    expect(rows(wrapper)[0]).toContain('OpenAI')
    wrapper.unmount()
  })

  it('sets a key from a password field and refreshes the models', async () => {
    const wrapper = await mountPage()
    const modelLoads = calls.filter((c) => c.query.includes('query LlmModels')).length

    await click('provider-key-set')
    expect((el('provider-key-input') as HTMLInputElement).type).toBe('password')
    await enterKey('sk-secret')
    await click('form-modal-save')

    await vi.waitFor(() => expect(rows(wrapper)[0]).toContain('Key •••• 9xQ2'))
    const sent = calls.find((c) => c.query.includes('mutation SetProviderKey'))!
    expect(sent.variables).toEqual({ provider: 'openai', apiKey: 'sk-secret' })
    expect(calls.filter((c) => c.query.includes('query LlmModels')).length).toBe(modelLoads + 1)
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="provider-key-input"]')).toBeNull()
    )
    wrapper.unmount()
  })

  it('keeps the modal open with the API’s message for an invalid key', async () => {
    keyErrors = [
      {
        __typename: 'ProviderKeyError',
        message: 'The provider rejected that key.',
        code: 'invalid-key'
      }
    ]
    const wrapper = await mountPage()

    await click('provider-key-set')
    await enterKey('bad')
    await click('form-modal-save')

    await vi.waitFor(() =>
      expect(el('provider-key-error').textContent).toContain('The provider rejected that key.')
    )
    expect(rows(wrapper)[0]).toContain('Not set')
    wrapper.unmount()
  })

  it('removes a key after confirming', async () => {
    const wrapper = await mountPage()

    await click('provider-key-remove')
    await click('confirm-modal-confirm')

    await vi.waitFor(() => expect(rows(wrapper)[1]).toContain('Not set'))
    expect(calls.find((c) => c.query.includes('mutation RemoveProviderKey'))?.variables).toEqual({
      provider: 'anthropic'
    })
    wrapper.unmount()
  })
})

describe('Settings daily limits', () => {
  const summary = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
    wrapper.get('[data-testid="daily-limit-summary"]').text()
  const sentLimits = () =>
    calls
      .filter((c) => c.query.includes('mutation SetLlmCallLimit'))
      .map((c) => c.variables?.dailyRequestLimit)
  const openEdit = async (wrapper: Awaited<ReturnType<typeof mountPage>>) => {
    await wrapper.get('[data-testid="daily-limit-edit"]').trigger('click')
    await flushPromises()
  }
  const save = async () => {
    document.body.querySelector<HTMLElement>('[data-testid="form-modal-save"]')!.click()
    await flushPromises()
  }

  it('sets a daily allowance and shows the returned numbers', async () => {
    const wrapper = await mountPage()
    expect(summary(wrapper)).toBe('No limit · 2 used today')

    await openEdit(wrapper)
    wrapper.getComponent(URadioGroup).vm.$emit('update:modelValue', 'daily')
    await flushPromises()
    wrapper.getComponent(UInputNumber).vm.$emit('update:modelValue', 50)
    await flushPromises()
    await save()

    await vi.waitFor(() => expect(sentLimits()).toEqual([50]))
    await vi.waitFor(() => expect(summary(wrapper)).toBe('2 of 50 used · 48 left'))
    expect(wrapper.get('[data-testid="daily-limit-row"]').text()).toContain('Resets')
    wrapper.unmount()
  })

  it('pauses a provider with 0', async () => {
    const wrapper = await mountPage()

    await openEdit(wrapper)
    wrapper.getComponent(URadioGroup).vm.$emit('update:modelValue', 'paused')
    await flushPromises()
    await save()

    await vi.waitFor(() => expect(sentLimits()).toEqual([0]))
    await vi.waitFor(() => expect(summary(wrapper)).toBe('Paused'))
    wrapper.unmount()
  })

  it('points to provider keys when no personal key can be limited', async () => {
    limits = []
    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="daily-limits-empty"]').text()).toContain('Add a provider key')
    wrapper.unmount()
  })
})
