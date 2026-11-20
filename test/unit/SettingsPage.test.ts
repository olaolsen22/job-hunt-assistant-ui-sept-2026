import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { URadioGroup, USelect } from '#components'
import SettingsPage from '~/pages/settings.vue'
import { llmModels, ownKeyModel, unknownModelError } from '../fixtures/llmModels'
import { callLimit, providerKey, retiredKey, usageToday } from '../fixtures/providerKeys'

type Body = { query: string; variables?: Record<string, unknown> }
type Models = { models: { id: string }[]; defaultModel: string }

// Gemini shared models plus one on the owner's OpenAI key.
const ownerModels = (defaultModel = 'fast'): Models => ({
  models: [...llmModels().models, ownKeyModel],
  defaultModel
})

// Day rows as LlmUsageHistory asks for them.
const day = (extra: object) => ({
  day: '2026-11-17',
  provider: 'openai',
  keySource: 'USER',
  credentialId: 'openai-a1b2',
  model: 'gpt-4.1-mini',
  requests: 1,
  inputTokens: 1000,
  outputTokens: 100,
  estimatedCost: 0.01,
  ...extra
})
const history = () => [
  day({ requests: 6, inputTokens: 30000, outputTokens: 5000, estimatedCost: 0.12 }),
  day({
    day: '2026-11-16',
    requests: 4,
    inputTokens: 20000,
    outputTokens: 3000,
    estimatedCost: 0.08
  }),
  // The same model on the key it replaced.
  day({
    credentialId: 'openai-old9',
    requests: 3,
    inputTokens: 9000,
    outputTokens: 1000,
    estimatedCost: 0.05
  }),
  // A model no longer offered, with no price.
  day({ model: 'gpt-4o', requests: 2, inputTokens: 4000, outputTokens: 500, estimatedCost: null }),
  ...[
    { requests: 20, inputTokens: 100000, outputTokens: 20000, estimatedCost: 0.3 },
    {
      day: '2026-11-16',
      requests: 10,
      inputTokens: 50000,
      outputTokens: 10000,
      estimatedCost: 0.2
    },
    {
      model: 'gemini-2.5-pro',
      requests: 5,
      inputTokens: 40000,
      outputTokens: 8000,
      estimatedCost: 1
    }
  ].map((d) =>
    day({
      provider: 'gemini',
      keySource: 'SHARED',
      credentialId: 'shared:gemini',
      model: 'gemini-2.5-flash',
      ...d
    })
  )
]

// Server state: mutations change it, the next read returns it.
let models: Models
let keys: ReturnType<typeof providerKey>[]
let limits: ReturnType<typeof callLimit>[]
let usageRows: ReturnType<typeof day>[]
let usage: ReturnType<typeof usageToday>
let fails: Set<string>
let saveErrors: unknown[] | null
let keyErrors: unknown[] | null
let calls: Body[]

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query } = body
    const vars = body.variables ?? {}
    const op = /(?:query|mutation) (\w+)/.exec(query)?.[1] ?? ''
    if (fails.has(op)) return { errors: [{ message: 'boom' }] }

    switch (op) {
      case 'LlmModels':
        return { data: { llmModels: models } }
      case 'DashboardLlmUsage':
        return { data: { llmUsageToday: usage } }
      case 'LlmUsageHistory':
        return { data: { usageDaily: usageRows } }
      case 'ProviderKeys':
        return { data: { providerKeys: keys } }
      case 'LlmCallLimits':
        return { data: { llmCallLimits: limits } }
      case 'SetDefaultLlmModel': {
        if (saveErrors)
          return { data: { setDefaultLlmModel: { llmModels: null, errors: saveErrors } } }
        models = { ...models, defaultModel: (vars.model as string | null) ?? 'fast' }
        return { data: { setDefaultLlmModel: { llmModels: models, errors: null } } }
      }
      case 'SetProviderKey': {
        if (keyErrors) return { data: { setProviderKey: { providerKey: null, errors: keyErrors } } }
        const provider = vars.provider as string
        const saved = providerKey(provider, '9xQ2')
        const old = keys.find((k) => k.provider === provider && k.configured)
        keys = [
          ...keys.filter((k) => !(k.provider === provider && !k.retiredAt)),
          ...(old ? [retiredKey(provider, old.last4!)] : []),
          saved
        ]
        return { data: { setProviderKey: { providerKey: saved, errors: null } } }
      }
      case 'RemoveProviderKey': {
        const provider = vars.provider as string
        const old = keys.find((k) => k.provider === provider && k.configured)!
        const removed = providerKey(provider)
        keys = [
          ...keys.filter((k) => !(k.provider === provider && !k.retiredAt)),
          retiredKey(provider, old.last4!),
          removed
        ]
        // Its models go, and the server falls back to the app default without saying so.
        models = {
          models: models.models.filter((m) => !m.id.startsWith(`${provider}:`)),
          defaultModel: models.defaultModel.startsWith(`${provider}:`)
            ? 'fast'
            : models.defaultModel
        }
        return { data: { removeProviderKey: { providerKey: removed, errors: null } } }
      }
      case 'SetLlmCallLimit': {
        const provider = vars.provider as string
        const saved = callLimit(provider, vars.dailyRequestLimit as number | null, 0)
        limits = [...limits.filter((l) => l.provider !== provider), saved]
        return { data: { setLlmCallLimit: { limit: saved, errors: null } } }
      }
    }
    throw new Error(`Unmocked operation ${op}`)
  }
})

beforeEach(() => {
  clearNuxtData()
  useToast().clear()
  models = ownerModels()
  // Gemini on the app's key, OpenAI connected near its cap, Mistral removed with its limit kept.
  keys = [
    providerKey('openai', 'a1b2'),
    providerKey('gemini'),
    providerKey('mistral'),
    retiredKey('openai', 'old9')
  ]
  // The API lists every supported provider's limit for the owner.
  limits = [callLimit('gemini', null, 0), callLimit('openai', 50, 45), callLimit('mistral', 20, 0)]
  usageRows = history()
  usage = usageToday()
  fails = new Set()
  saveErrors = null
  keyErrors = null
  calls = []
  useAuthStore().user = { id: '1', email: 'owner@example.com', role: 'Owner' }
})
let mounted: VueWrapper[] = []
afterEach(() => {
  mounted.forEach((w) => w.unmount())
  mounted = []
  document.body.innerHTML = ''
})

const has = (testid: string) => !!document.body.querySelector(`[data-testid="${testid}"]`)
const get = (testid: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
const text = (testid: string) => get(testid).textContent!.replace(/\s+/g, ' ').trim()
const sent = (op: string) =>
  calls
    .filter((c) => c.query.includes(`${op}(`) || c.query.includes(`${op} `))
    .map((c) => c.variables)
const titles = () => useToast().toasts.value.map((t) => t.title)

const mountPage = async () => {
  const wrapper = await mountSuspended(SettingsPage, { attachTo: document.body })
  mounted.push(wrapper)
  // The sections are ready once the model summary (or its error) is showing and, for the owner,
  // the key rows and usage.
  const card = () => get('settings-ai-model')
  await vi.waitFor(() =>
    expect(has('settings-model-summary') || /Try again/.test(card().textContent!)).toBe(true)
  )
  if (useAuthStore().user?.role === 'Owner') {
    await vi.waitFor(() =>
      expect(
        has('provider-row') || /Try again/.test(get('settings-provider-keys').textContent!)
      ).toBe(true)
    )
    await vi.waitFor(() =>
      expect(get('settings-usage').querySelector('.animate-pulse, [aria-busy]')).toBeNull()
    )
  }
  await flushPromises()
  return wrapper
}

const click = async (el: HTMLElement) => {
  el.click()
  await flushPromises()
}
const button = (root: Element, label: string) =>
  [...root.querySelectorAll<HTMLElement>('button, a')].find((b) => b.textContent?.trim() === label)!

describe('Settings page: AI model', () => {
  const picker = (wrapper: VueWrapper) => wrapper.getComponent(URadioGroup)

  it('says which model the next AI action uses, that the app’s key pays and the shared cap', async () => {
    await mountPage()

    expect(text('settings-model-current')).toBe('Fast')
    expect(text('settings-model-summary')).toContain('App’s key')
    await vi.waitFor(() =>
      expect(text('settings-model-cap')).toMatch(/^40 of 500 today for all users · resets /)
    )
  })

  it('on an own-key default, names the key and its provider limit, with a link to change it', async () => {
    models = ownerModels(ownKeyModel.id)
    await mountPage()

    expect(text('settings-model-current')).toBe('GPT-4.1 mini')
    const summary = get('settings-model-summary')
    expect(summary.textContent).toContain('Your OpenAI key')
    await vi.waitFor(() => expect(text('settings-model-cap')).toMatch(/^45 of 50 today · resets /))
    expect(summary.textContent).toContain('5 left today')
    expect(text('settings-model-cap')).not.toContain('all users')
    expect(button(summary, 'Change limit').getAttribute('href')).toMatch(/#keys$/)
  })

  it('offers the models grouped by provider, each saying who pays', async () => {
    const wrapper = await mountPage()

    expect(picker(wrapper).props('modelValue')).toBe('fast')
    expect(
      (picker(wrapper).props('items') as { label: string; description: string }[]).map(
        (i) => `${i.label} | ${i.description}`
      )
    ).toEqual([
      'Fast | Gemini · App’s key',
      'Strong | Gemini · App’s key',
      'GPT-4.1 mini | OpenAI · Your key'
    ])
  })

  it('saves a picked model straight away, with Undo putting the previous one back', async () => {
    const wrapper = await mountPage()

    picker(wrapper).vm.$emit('update:modelValue', 'strong')
    await vi.waitFor(() => expect(sent('setDefaultLlmModel')).toEqual([{ model: 'strong' }]))
    await vi.waitFor(() => expect(text('settings-model-current')).toBe('Strong'))
    expect(picker(wrapper).props('modelValue')).toBe('strong')

    const toast = useToast().toasts.value.find((t) => t.title === 'Default model: Strong')!
    expect(toast.actions?.map((a) => a.label)).toEqual(['Undo'])
    toast.actions![0]!.onClick!(new MouseEvent('click'))
    await vi.waitFor(() =>
      expect(sent('setDefaultLlmModel')).toEqual([{ model: 'strong' }, { model: 'fast' }])
    )
    await vi.waitFor(() => expect(text('settings-model-current')).toBe('Fast'))
  })

  it('keeps the saved model selected and toasts the API’s message when saving fails', async () => {
    saveErrors = [unknownModelError]
    const wrapper = await mountPage()

    picker(wrapper).vm.$emit('update:modelValue', 'strong')
    await vi.waitFor(() => expect(sent('setDefaultLlmModel')).toEqual([{ model: 'strong' }]))
    await flushPromises()

    expect(picker(wrapper).props('modelValue')).toBe('fast')
    expect(text('settings-model-current')).toBe('Fast')
    expect(titles()).toContain('That model isn’t available.')
    expect(titles().some((t) => t?.startsWith('Default model'))).toBe(false)
  })

  it('resets to the app default by sending null', async () => {
    models = ownerModels('strong')
    await mountPage()

    await click(get('settings-model-reset'))

    await vi.waitFor(() => expect(sent('setDefaultLlmModel')).toEqual([{ model: null }]))
    await vi.waitFor(() => expect(text('settings-model-current')).toBe('Fast'))
    expect(titles()).toContain('Using the app default, Fast')
  })

  it('points to the keys for providers that are not connected, never Gemini', async () => {
    await mountPage()
    expect(text('settings-model-connect')).toContain('Connect Mistral to add their models.')
    expect(button(get('settings-model-connect'), 'Your keys').getAttribute('href')).toMatch(
      /#keys$/
    )
  })

  it('names every unconnected provider other than Gemini', async () => {
    keys = [providerKey('gemini'), providerKey('mistral'), providerKey('openai')]
    models = { models: llmModels().models, defaultModel: 'fast' }
    await mountPage()

    expect(text('settings-model-connect')).toContain(
      'Connect Mistral or OpenAI to add their models.'
    )
  })

  it('has no picker when there is only one model', async () => {
    models = { models: [llmModels().models[0]!], defaultModel: 'fast' }
    const wrapper = await mountPage()

    expect(wrapper.findComponent(URadioGroup).exists()).toBe(false)
    expect(get('settings-ai-model').textContent).toContain('This is the only model available.')
  })

  it('shows an error with a retry when the models fail to load', async () => {
    fails.add('LlmModels')
    const wrapper = await mountPage()

    expect(has('settings-model-summary')).toBe(false)
    expect(wrapper.findComponent(URadioGroup).exists()).toBe(false)

    fails.delete('LlmModels')
    await click(button(get('settings-ai-model'), 'Try again'))
    await vi.waitFor(() => expect(text('settings-model-current')).toBe('Fast'))
  })
})

describe('Settings page: guest', () => {
  beforeEach(() => {
    useAuthStore().user = { id: '2', email: '', role: 'Guest' }
  })

  it('shows only the model summary and asks for no keys, limits or usage history', async () => {
    models = llmModels()
    const wrapper = await mountPage()

    expect(text('settings-model-current')).toBe('Fast')
    expect(get('settings-ai-model').textContent).toContain(
      'Every built-in AI action runs on this model, on the app’s key.'
    )
    expect(wrapper.findComponent(URadioGroup).exists()).toBe(false)
    expect(has('settings-model-reset')).toBe(false)
    expect(has('settings-provider-keys')).toBe(false)
    expect(has('settings-usage')).toBe(false)
    expect(calls.some((c) => /ProviderKeys|LlmCallLimits|LlmUsageHistory/.test(c.query))).toBe(
      false
    )
  })
})

describe('Settings page: your keys', () => {
  const rows = () => [
    ...document.body.querySelectorAll<HTMLElement>('[data-testid="provider-row"]')
  ]
  const row = (name: string) => rows().find((r) => r.textContent!.includes(name))!
  const inRow = (name: string, testid: string) =>
    row(name).querySelector<HTMLElement>(`[data-testid="${testid}"]`)
  const status = (name: string) => inRow(name, 'provider-status')!.textContent!.trim()
  const rowText = (name: string) => row(name).textContent!.replace(/\s+/g, ' ')

  // Reka opens a dropdown on pointerdown or Enter, not on click.
  const choose = async (name: string, label: string) => {
    inRow(name, 'provider-menu')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    await flushPromises()
    const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (el) => el.textContent?.trim() === label
    )
    expect(item, `menu item ${label}`).toBeTruthy()
    await click(item!)
  }
  const menuItems = async (name: string) => {
    inRow(name, 'provider-menu')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    await flushPromises()
    return [...document.body.querySelectorAll('[role="menuitem"]')].map((i) =>
      i.textContent?.trim()
    )
  }
  const enterKey = async (value: string) => {
    const input = get('provider-key-input') as HTMLInputElement
    input.value = value
    input.dispatchEvent(new Event('input'))
    await flushPromises()
  }
  const modalTitle = () => document.body.querySelector('[role="dialog"] h2')?.textContent?.trim()

  // Without the limits a row can't tell "no limit" from "not known", so editing waits for them.
  it('blocks limit edits when the limits fail to load, and retries them', async () => {
    fails.add('LlmCallLimits')
    await mountPage()
    await vi.waitFor(() => expect(has('settings-limits-error')).toBe(true))
    expect((inRow('OpenAI', 'provider-limit-edit') as HTMLButtonElement).disabled).toBe(true)

    fails.delete('LlmCallLimits')
    const retry = [...get('settings-limits-error').querySelectorAll('button')].find(
      (b) => b.textContent!.trim() === 'Try again'
    )!
    retry.click()
    await vi.waitFor(() => expect(has('settings-limits-error')).toBe(false))
    expect((inRow('OpenAI', 'provider-limit-edit') as HTMLButtonElement).disabled).toBe(false)
  })

  it('lists one row per provider, hiding replaced keys, with only the last four characters', async () => {
    await mountPage()

    expect(rows().map((r) => r.querySelector('.font-medium')!.textContent)).toEqual([
      'Gemini',
      'Mistral',
      'OpenAI'
    ])
    expect(status('Gemini')).toBe('Not connected')
    expect(rowText('Gemini')).toContain('Gemini runs on the app’s key.')
    expect(status('Mistral')).toBe('Not connected')
    expect(status('OpenAI')).toBe('Near limit')
    expect(inRow('OpenAI', 'provider-key')!.textContent).toContain('Key •••• a1b2')
    expect(rowText('OpenAI')).not.toContain('old9')
    expect(inRow('OpenAI', 'provider-limit')!.textContent).toMatch(/45 of 50 today · resets/)
    expect(inRow('OpenAI', 'provider-limit-edit')!.textContent).toBe('Edit limit')
  })

  it('shows a limit kept on a provider whose key was removed', async () => {
    await mountPage()

    expect(inRow('Mistral', 'provider-limit')!.textContent!.trim()).toBe('Limit kept: 20 a day')
    expect(inRow('Gemini', 'provider-limit')).toBeNull()
  })

  it('offers Replace and Remove for a connected key, Set limit for one that is not', async () => {
    await mountPage()

    expect(await menuItems('OpenAI')).toEqual(['Replace key', 'Remove key'])
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(await menuItems('Mistral')).toEqual(['Set limit'])
  })

  it('connects a key from a password field and refetches the list', async () => {
    await mountPage()
    const keyLoads = sent('providerKeys').length

    await click(inRow('Mistral', 'provider-connect')!)
    expect(modalTitle()).toBe('Connect Mistral key')
    expect((get('provider-key-input') as HTMLInputElement).type).toBe('password')
    await enterKey('sk-secret')
    await click(get('form-modal-save'))

    await vi.waitFor(() => expect(status('Mistral')).toBe('Active'))
    expect(sent('setProviderKey')).toEqual([{ provider: 'mistral', apiKey: 'sk-secret' }])
    expect(sent('providerKeys').length).toBeGreaterThan(keyLoads)
    expect(inRow('Mistral', 'provider-key')!.textContent).toContain('Key •••• 9xQ2')
    await vi.waitFor(() => expect(has('provider-key-input')).toBe(false))
    expect(titles()).toContain('Mistral key saved')
  })

  it('keeps the modal open with the API’s message for a rejected key', async () => {
    keyErrors = [
      {
        __typename: 'ProviderKeyError',
        message: 'The provider rejected that key.',
        code: 'invalid-key'
      }
    ]
    await mountPage()

    await click(inRow('Mistral', 'provider-connect')!)
    await enterKey('bad')
    await click(get('form-modal-save'))

    await vi.waitFor(() =>
      expect(text('provider-key-error')).toContain('The provider rejected that key.')
    )
    expect(status('Mistral')).toBe('Not connected')
  })

  it('replaces a key from the menu', async () => {
    await mountPage()

    await choose('OpenAI', 'Replace key')
    expect(modalTitle()).toBe('Replace OpenAI key')
    await enterKey('sk-new')
    await click(get('form-modal-save'))

    await vi.waitFor(() => expect(inRow('OpenAI', 'provider-key')!.textContent).toContain('9xQ2'))
    expect(sent('setProviderKey')).toEqual([{ provider: 'openai', apiKey: 'sk-new' }])
  })

  it('removes a key after confirming and keeps its limit', async () => {
    await mountPage()

    await choose('OpenAI', 'Remove key')
    expect(modalTitle()).toBe('Remove the OpenAI key?')
    expect(sent('removeProviderKey')).toEqual([])
    await click(get('confirm-modal-confirm'))

    await vi.waitFor(() => expect(status('OpenAI')).toBe('Not connected'))
    expect(sent('removeProviderKey')).toEqual([{ provider: 'openai' }])
    expect(inRow('OpenAI', 'provider-limit')!.textContent!.trim()).toBe('Limit kept: 50 a day')
    expect(titles()).toContain('OpenAI key removed')
    // The default was a Gemini model, so it didn't change.
    expect(titles().some((t) => t?.startsWith('Default is now'))).toBe(false)
  })

  it('says the default changed when the removed key ran it', async () => {
    models = ownerModels(ownKeyModel.id)
    await mountPage()

    await choose('OpenAI', 'Remove key')
    await click(get('confirm-modal-confirm'))

    await vi.waitFor(() => expect(titles()).toContain('Default is now Fast (app’s key)'))
    await vi.waitFor(() => expect(text('settings-model-current')).toBe('Fast'))
  })

  it('pauses a connected key from its limit button', async () => {
    const wrapper = await mountPage()

    await click(inRow('OpenAI', 'provider-limit-edit')!)
    expect(modalTitle()).toBe('OpenAI daily limit')
    const mode = wrapper.findAllComponents(URadioGroup).at(-1)!
    expect(mode.props('modelValue')).toBe('daily')
    mode.vm.$emit('update:modelValue', 'paused')
    await flushPromises()
    await click(get('form-modal-save'))

    await vi.waitFor(() =>
      expect(sent('setLlmCallLimit')).toEqual([{ provider: 'openai', dailyRequestLimit: 0 }])
    )
    await vi.waitFor(() => expect(status('OpenAI')).toBe('Paused'))
    expect(inRow('OpenAI', 'provider-limit')!.textContent).toContain(
      'No AI calls on this key until you change the limit.'
    )
  })

  it('sets a limit before a key is connected and shows it as kept', async () => {
    const wrapper = await mountPage()

    await choose('Gemini', 'Set limit')
    expect(modalTitle()).toBe('Gemini daily limit')
    const mode = wrapper.findAllComponents(URadioGroup).at(-1)!
    expect(mode.props('modelValue')).toBe('none')
    mode.vm.$emit('update:modelValue', 'paused')
    await flushPromises()
    await click(get('form-modal-save'))

    await vi.waitFor(() =>
      expect(sent('setLlmCallLimit')).toEqual([{ provider: 'gemini', dailyRequestLimit: 0 }])
    )
    await vi.waitFor(() => expect(has('form-modal-save')).toBe(false))
    expect(inRow('Gemini', 'provider-limit')?.textContent?.trim()).toBe('Limit kept: paused')
  })

  it('shows an error with a retry when the keys fail to load', async () => {
    fails.add('ProviderKeys')
    await mountPage()

    expect(rows()).toHaveLength(0)
    fails.delete('ProviderKeys')
    await click(button(get('settings-provider-keys'), 'Try again'))
    await vi.waitFor(() => expect(rows()).toHaveLength(3))
  })
})

describe('Settings page: usage', () => {
  const group = (id: 'own' | 'shared') => get(`settings-usage-${id}`)
  const total = (id: 'own' | 'shared') =>
    group(id)
      .querySelector('[data-testid="settings-usage-total"]')!
      .textContent!.replace(/\s+/g, ' ')
      .trim()
  const lines = (id: 'own' | 'shared') =>
    [...group(id).querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) =>
        // Block children (model + key lines) read as separate words.
        [...td.childNodes]
          .map((n) => n.textContent)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
    )

  it('asks for the last 30 days by default', async () => {
    await mountPage()
    expect(sent('usageDaily')).toEqual([{ days: 30 }])
  })

  it('keeps own keys and the app’s key in separate groups with their own totals', async () => {
    await mountPage()

    expect(group('own').textContent).toContain('Your keys')
    expect(group('shared').textContent).toContain('App’s key')
    // A day without a price makes the own-key total a lower bound.
    expect(total('own')).toBe('15 requests · 63K tokens in, 9.5K out · est. at least $0.25')
    expect(total('shared')).toBe('35 requests · 190K tokens in, 38K out · est. $1.50')
  })

  // The key is a second line in the model cell, so a phone keeps the cost column.
  it('lists one line per model and key, with labels, old keys and missing prices', async () => {
    await mountPage()

    expect(lines('own')).toEqual([
      ['GPT-4.1 mini Key •••• a1b2', '10', '50K / 8K', '$0.20'],
      ['GPT-4.1 mini Old key •••• old9', '3', '9K / 1K', '$0.05'],
      // Not offered any more: the raw id still says what it was.
      ['gpt-4o Key •••• a1b2', '2', '4K / 500', 'No price']
    ])
    expect(lines('shared')).toEqual([
      ['Fast App’s key', '30', '150K / 30K', '$0.50'],
      ['Strong App’s key', '5', '40K / 8K', '$1.00']
    ])
  })

  it('leaves out a group with no requests', async () => {
    usageRows = history().filter((r) => r.keySource === 'SHARED')
    await mountPage()

    expect(has('settings-usage-own')).toBe(false)
    expect(has('settings-usage-shared')).toBe(true)
  })

  it('asks again for another period', async () => {
    const wrapper = await mountPage()

    wrapper.getComponent(USelect).vm.$emit('update:modelValue', 7)
    await vi.waitFor(() => expect(sent('usageDaily')).toEqual([{ days: 30 }, { days: 7 }]))
  })

  it('says when there were no requests in the period', async () => {
    usageRows = []
    await mountPage()

    expect(text('settings-usage-empty')).toBe('No AI requests in the last 30 days.')
  })

  it('shows an error with a retry when usage fails to load', async () => {
    fails.add('LlmUsageHistory')
    await mountPage()

    expect(has('settings-usage-own')).toBe(false)
    fails.delete('LlmUsageHistory')
    await click(button(get('settings-usage'), 'Try again'))
    await vi.waitFor(() => expect(has('settings-usage-own')).toBe(true))
  })
})
