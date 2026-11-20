import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProviderRow from '~/components/settings/ProviderRow.vue'
import { callLimit, providerKey } from '../fixtures/providerKeys'

const mountRow = (props: InstanceType<typeof ProviderRow>['$props']) =>
  mountSuspended(ProviderRow, { props })
const testid = (wrapper: Awaited<ReturnType<typeof mountRow>>, id: string) =>
  wrapper.find(`[data-testid="${id}"]`)

describe('SettingsProviderRow', () => {
  it.each([
    ['no limit row', undefined, 'Active', undefined],
    ['no daily limit', callLimit('openai', null, 7), 'Active', '7 today · no daily limit'],
    ['under 80 %', callLimit('openai', 50, 39), 'Active', '39 of 50 today · resets'],
    ['from 80 %', callLimit('openai', 50, 40), 'Near limit', '40 of 50 today · resets'],
    ['at the cap', callLimit('openai', 50, 50), 'Limit reached', '50 of 50 today · resets'],
    ['paused', callLimit('openai', 0, 0), 'Paused', 'No AI calls on this key until you change']
  ])('a connected key with %s says %s', async (_, limit, badge, line) => {
    const wrapper = await mountRow({ providerKey: providerKey('openai', 'a1b2'), limit })

    expect(testid(wrapper, 'provider-status').text()).toBe(badge)
    expect(testid(wrapper, 'provider-key').text()).toContain('Key •••• a1b2')
    if (line) expect(testid(wrapper, 'provider-limit').text()).toContain(line)
    else expect(testid(wrapper, 'provider-limit').exists()).toBe(false)
  })

  it('offers Set limit without a daily limit and Edit limit with one', async () => {
    const none = await mountRow({
      providerKey: providerKey('openai', 'a1b2'),
      limit: callLimit('openai', null)
    })
    expect(testid(none, 'provider-limit-edit').text()).toBe('Set limit')

    const some = await mountRow({
      providerKey: providerKey('openai', 'a1b2'),
      limit: callLimit('openai', 0)
    })
    expect(testid(some, 'provider-limit-edit').text()).toBe('Edit limit')
  })

  it('shows Not connected with Connect key, whatever a kept limit says', async () => {
    const wrapper = await mountRow({
      providerKey: providerKey('mistral'),
      limit: callLimit('mistral', 50, 50)
    })

    expect(testid(wrapper, 'provider-status').text()).toBe('Not connected')
    expect(wrapper.text()).toContain('Connect a key to add Mistral models.')
    expect(testid(wrapper, 'provider-limit').text()).toBe('Limit kept: 50 a day')
    expect(testid(wrapper, 'provider-connect').text()).toBe('Connect key')
    expect(testid(wrapper, 'provider-limit-edit').exists()).toBe(false)
    expect(testid(wrapper, 'provider-key').exists()).toBe(false)
  })

  it('says a kept limit of 0 is paused and hides a kept "no limit"', async () => {
    const paused = await mountRow({
      providerKey: providerKey('mistral'),
      limit: callLimit('mistral', 0, 0)
    })
    expect(testid(paused, 'provider-limit').text()).toBe('Limit kept: paused')

    const none = await mountRow({
      providerKey: providerKey('mistral'),
      limit: callLimit('mistral', null)
    })
    expect(testid(none, 'provider-limit').exists()).toBe(false)
  })

  it('tells Gemini it runs on the app’s key without one', async () => {
    const wrapper = await mountRow({ providerKey: providerKey('gemini') })

    expect(wrapper.text()).toContain('Gemini runs on the app’s key.')
  })

  it('emits connect and limit from its buttons', async () => {
    const off = await mountRow({ providerKey: providerKey('mistral') })
    await testid(off, 'provider-connect').trigger('click')
    expect(off.emitted('connect')).toHaveLength(1)

    const on = await mountRow({ providerKey: providerKey('openai', 'a1b2') })
    await testid(on, 'provider-limit-edit').trigger('click')
    expect(on.emitted('limit')).toHaveLength(1)
  })

  it('names the provider on its menu button', async () => {
    const wrapper = await mountRow({ providerKey: providerKey('openai', 'a1b2') })

    expect(testid(wrapper, 'provider-menu').attributes('aria-label')).toBe('More for OpenAI')
  })
})
