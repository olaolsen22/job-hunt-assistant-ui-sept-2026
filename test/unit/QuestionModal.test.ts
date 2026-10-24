import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { llmModels } from '../fixtures/llmModels'
import QuestionModal from '~/components/listings/QuestionModal.vue'

const requests: { query: string; variables: { input: Record<string, unknown> } }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    if (body.query.includes('query ApplicationAnswerExternalPrompt'))
      return { data: { applicationAnswerExternalPrompt: { instructions: 'Answer it' } } }
    if (body.query.includes('LlmUsage')) return { data: { llmUsageToday: null } }
    if (body.query.includes('mutation AddApplicationQuestion'))
      return {
        data: {
          addApplicationQuestion: {
            applicationQuestion: { id: 9 },
            errors: null
          }
        }
      }
    return { data: { updateApplicationQuestion: { applicationQuestion: { id: 3 }, errors: null } } }
  }
})

const question = { id: 3, question: 'Why us?', charLimit: 10, answer: 'Short.', notes: 'Be warm' }
const mounted: { unmount: () => void }[] = []
const mount = async (current: typeof question | null = question) => {
  const wrapper = await mountSuspended(QuestionModal, {
    props: { open: false, listingId: 5, question: current },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}
const field = (testid: string) =>
  document.body.querySelector<HTMLTextAreaElement>(`[data-testid="${testid}"]`)!
const save = async () => {
  document.body.querySelector<HTMLElement>('[data-testid="form-modal-save"]')!.click()
  await flushPromises()
}

beforeEach(() => requests.splice(0))
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('QuestionModal', () => {
  it('sends the whole record when editing, since update replaces it', async () => {
    const wrapper = await mount()
    field('answer-input').value = 'Better.'
    field('answer-input').dispatchEvent(new Event('input'))
    await save()

    expect(requests.at(-1)?.variables.input).toEqual({
      id: 3,
      question: 'Why us?',
      charLimit: 10,
      answer: 'Better.',
      notes: 'Be warm'
    })
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
  })

  it('does not save an answer over the limit', async () => {
    await mount()
    field('answer-input').value = 'This is far too long.'
    field('answer-input').dispatchEvent(new Event('input'))
    await save()

    expect(requests).toHaveLength(0)
    expect(document.body.textContent).toContain('Over the limit')
  })

  it('saves the edited answer before opening the AI draft, which reads the saved question', async () => {
    await mount()
    field('answer-input').value = 'Edited.'
    field('answer-input').dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLElement>('[data-testid="question-ai-open"]')!.click()
    await flushPromises()

    expect(requests.at(-1)?.variables.input).toMatchObject({ id: 3, answer: 'Edited.' })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Draft the answer with AI'))
  })

  it('explains instead of drafting when the answer is over the limit', async () => {
    await mount()
    field('answer-input').value = 'This is far too long.'
    field('answer-input').dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLElement>('[data-testid="question-ai-open"]')!.click()
    await flushPromises()

    expect(requests).toHaveLength(0)
    expect(document.body.textContent).toContain('Over the limit')
    expect(document.body.textContent).not.toContain('Draft the answer with AI')
  })

  it('refines a new question in one go: adds it, opens the AI, then Save updates it', async () => {
    const wrapper = await mount(null)
    field('question-input').value = 'Why us?'
    field('question-input').dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLElement>('[data-testid="question-ai-open"]')!.click()
    await flushPromises()

    expect(requests.at(-1)?.query).toContain('mutation AddApplicationQuestion')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Draft the answer with AI'))
    expect(wrapper.emitted('update:open')).toBeUndefined()

    await save()
    expect(requests.at(-1)?.variables.input).toMatchObject({ id: 9, question: 'Why us?' })
  })
})
