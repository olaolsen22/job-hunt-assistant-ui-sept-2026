import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AiOwnSteps from '~/components/app/AiOwnSteps.vue'

const promptState = (overrides: { instructions?: string; promptError?: string } = {}) => ({
  instructions: computed(() => overrides.instructions ?? ''),
  promptLoading: ref(false),
  promptError: ref(overrides.promptError ?? ''),
  copied: ref(false),
  loadPrompt: vi.fn(),
  copyPrompt: vi.fn()
})
const mount = (ai: ReturnType<typeof promptState>, props: Record<string, unknown> = {}) =>
  mountSuspended(AiOwnSteps, { props: { ai, reply: '', testidPrefix: 'x', ...props } })

describe('AiOwnSteps', () => {
  it('keeps copy disabled until the prompt has loaded, then copies it', async () => {
    const waiting = await mount(promptState())
    expect(waiting.get('[data-testid="x-copy-prompt"]').attributes('disabled')).toBeDefined()

    const ai = promptState({ instructions: 'Prompt text' })
    const ready = await mount(ai)
    await ready.get('[data-testid="x-copy-prompt"]').trigger('click')
    expect(ai.copyPrompt).toHaveBeenCalled()
    expect(ready.text()).toContain('View prompt / copy manually')
  })

  it('offers a retry when the prompt failed to load', async () => {
    const ai = promptState({ promptError: 'Could not load' })
    const wrapper = await mount(ai)
    const alert = wrapper.get('[data-testid="x-prompt-error"]')
    expect(alert.text()).toContain('Could not load')
    await alert.get('button').trigger('click')
    expect(ai.loadPrompt).toHaveBeenCalled()
  })

  it('numbers the steps after a feature step and shows reply errors on the field', async () => {
    const wrapper = await mount(promptState({ instructions: 'P' }), {
      startStep: 2,
      replyError: 'Not valid JSON'
    })
    expect(wrapper.text()).toContain('2. Copy the prompt')
    expect(wrapper.text()).toContain('3. Paste the AI’s reply')
    expect(wrapper.text()).toContain('Not valid JSON')

    await wrapper.get('[data-testid="x-json"]').setValue('{}')
    await flushPromises()
    expect(wrapper.emitted('update:reply')?.[0]).toEqual(['{}'])
  })
})
