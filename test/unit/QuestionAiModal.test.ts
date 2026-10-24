import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import QuestionAiModal from '~/components/listings/QuestionAiModal.vue'
import { llmModels } from '../fixtures/llmModels'

let result: Record<string, unknown> = {}
const requests: { query: string }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ApplicationAnswerExternalPrompt'))
      return { data: { applicationAnswerExternalPrompt: { instructions: 'Answer it' } } }
    if (body.query.includes('mutation GenerateApplicationAnswer'))
      return { data: { generateApplicationAnswer: { result, errors: null } } }
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
const mounted: { unmount: () => void }[] = []
const generate = async () => {
  const wrapper = await mountSuspended(QuestionAiModal, {
    props: { open: true, questionId: 3, charLimit: 10, currentAnswer: 'My draft.' },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  query('question-ai-run')!.click()
  await vi.waitFor(() =>
    expect(requests.some((r) => r.query.includes('mutation GenerateApplicationAnswer'))).toBe(true)
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  requests.length = 0
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('QuestionAiModal', () => {
  it('hands the edited candidate over without saving anything', async () => {
    result = {
      status: 'SUCCEEDED',
      candidate: { answer: 'Fits.', length: 5, overLimit: false },
      error: null
    }
    const wrapper = await generate()
    query('question-ai-use')!.click()

    expect(wrapper.emitted('use')).toEqual([['Fits.']])
    expect(requests.some((r) => r.query.includes('UpdateApplicationQuestion'))).toBe(false)
  })

  it('flags a candidate the AI could not fit and blocks using it until trimmed', async () => {
    result = {
      status: 'SUCCEEDED',
      candidate: { answer: 'Far too long for this.', length: 22, overLimit: true },
      error: null
    }
    await generate()

    expect(query('question-ai-current')?.textContent).toContain('My draft.')
    expect(query('question-ai-over-limit')).not.toBeNull()
    expect(query('question-ai-use')!.hasAttribute('disabled')).toBe(true)
  })

  it('shows a failed run with its error code', async () => {
    result = { status: 'FAILED', candidate: null, error: 'Model overloaded', errorCode: 'busy' }
    await generate()

    expect(query('question-ai-error')?.textContent).toContain('Model overloaded (busy)')
  })
})
