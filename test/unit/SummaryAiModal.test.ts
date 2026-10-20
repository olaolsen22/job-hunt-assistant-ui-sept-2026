import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import SummaryAiModal from '~/components/profile/SummaryAiModal.vue'
import { llmModels } from '../fixtures/llmModels'

let result: Record<string, unknown> = {}
const requests: { query: string; variables?: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ProfileSummaryPrompt'))
      return { data: { profileSummaryPrompt: { instructions: 'Write a summary' } } }
    if (body.query.includes('mutation SuggestProfileSummary'))
      return { data: { suggestProfileSummary: { result, errors: null } } }
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    return {
      data: {
        llmUsageToday: {
          model: 'fast',
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          requestsLimit: 50,
          remainingRequests: 50,
          resetsAt: '2026-10-20T00:00:00Z'
        }
      }
    }
  }
})

const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const click = async (el: HTMLElement) => {
  el.click()
  await flushPromises()
}
const mounted: { unmount: () => void }[] = []
const mount = async (current = '') => {
  const wrapper = await mountSuspended(SummaryAiModal, {
    props: { open: true, current },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
// Reka tabs switch on mousedown.
const openOwnTab = async () => {
  const tab = [...document.body.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) =>
    t.textContent?.includes('own AI')
  )!
  tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  await flushPromises()
}
const generate = async (current = '') => {
  const wrapper = await mount(current)
  await click(query('summary-ai-suggest')!)
  await vi.waitFor(() =>
    expect(requests.some((r) => r.query.includes('mutation SuggestProfileSummary'))).toBe(true)
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  result = { status: 'SUCCEEDED', summary: 'Frontend developer.', error: null }
  requests.length = 0
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('SummaryAiModal', () => {
  it('fills an empty summary straight away', async () => {
    const wrapper = await generate()
    expect(wrapper.emitted('use')).toEqual([['Frontend developer.']])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('compares with existing text and uses the suggestion only when asked', async () => {
    const wrapper = await generate('I write JS.')
    expect(wrapper.emitted('use')).toBeUndefined()
    expect(query('compare-current')!.textContent).toContain('I write JS.')
    expect(query('summary-ai-compare')!.textContent).toContain('Frontend developer.')
    await click(query('summary-ai-use')!)
    expect(wrapper.emitted('use')).toEqual([['Frontend developer.']])
  })

  it('hints at adding content when the profile is too thin, without using anything', async () => {
    result = { status: 'SUCCEEDED', summary: null, error: null }
    const wrapper = await generate('I write JS.')
    expect(query('summary-ai-too-little')).not.toBeNull()
    expect(wrapper.emitted('use')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('shows the API error when the run fails', async () => {
    result = { status: 'FAILED', summary: null, error: 'The AI did not answer.' }
    const wrapper = await generate()
    expect(query('summary-ai-error')!.textContent).toContain('The AI did not answer.')
    expect(wrapper.emitted('use')).toBeUndefined()
  })

  it('uses a pasted reply from the owner’s own AI', async () => {
    const wrapper = await mount()
    await openOwnTab()
    const reply = query('summary-ai-json') as HTMLTextAreaElement
    reply.value = '```json\n{"summary": " Backend developer. "}\n```'
    reply.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(query('summary-ai-preview')!)
    expect(wrapper.emitted('use')).toEqual([['Backend developer.']])
  })

  it('rejects a pasted reply without a summary', async () => {
    const wrapper = await mount()
    await openOwnTab()
    const reply = query('summary-ai-json') as HTMLTextAreaElement
    reply.value = '{"headline": "Dev"}'
    reply.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(query('summary-ai-preview')!)
    expect(document.body.textContent).toContain('Expect a "summary" text.')
    expect(wrapper.emitted('use')).toBeUndefined()
  })
})
