import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AnswersAiModal from '~/components/listings/AnswersAiModal.vue'
import { llmModels } from '../fixtures/llmModels'

let generated: Record<string, unknown> = {}
let previewed: Record<string, unknown> = {}
// Aliases (r0, r1...) whose save returns an error.
let failingSaves: string[] = []
const requests: { query: string; variables: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ApplicationAnswerExternalPrompt'))
      return { data: { applicationAnswerExternalPrompt: { instructions: 'Answer them' } } }
    if (body.query.includes('mutation GenerateApplicationAnswers'))
      return { data: { generateApplicationAnswers: generated } }
    if (body.query.includes('mutation PreviewApplicationAnswers'))
      return { data: { previewApplicationAnswers: previewed } }
    if (body.query.includes('mutation SaveApplicationAnswers'))
      return {
        data: Object.fromEntries(
          Object.keys(body.variables).map((_, i) => [
            `r${i}`,
            failingSaves.includes(`r${i}`)
              ? {
                  applicationQuestion: null,
                  errors: [{ __typename: 'InvalidApplicationQuestionError', message: 'Rejected.' }]
                }
              : { applicationQuestion: { id: i }, errors: null }
          ])
        )
      }
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    return { data: { llmUsageToday: null } }
  }
})

const questions = [
  { id: 1, question: 'Why us?', charLimit: 20, answer: 'Saved one.', notes: null },
  { id: 2, question: 'Why you?', charLimit: null, answer: null, notes: 'Be brief' }
]
const succeeded = (candidates: { questionId: number; answer: string }[]) => ({
  result: {
    status: 'SUCCEEDED',
    error: null,
    errorCode: null,
    candidates: candidates.map((c) => ({ ...c, length: c.answer.length, overLimit: false }))
  },
  errors: null
})

const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const queryAll = (id: string) => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)
]
const mounted: { unmount: () => void }[] = []
const mount = async () => {
  const wrapper = await mountSuspended(AnswersAiModal, {
    props: { open: true, listingId: 5, questions },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
const draft = async () => {
  const wrapper = await mount()
  query('answers-ai-run')!.click()
  await vi.waitFor(() =>
    expect(requests.some((r) => r.query.includes('mutation GenerateApplicationAnswers'))).toBe(true)
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  requests.length = 0
  failingSaves = []
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('AnswersAiModal', () => {
  it('drafts every question in one run and fetches the prompt for the listing', async () => {
    generated = succeeded([
      { questionId: 2, answer: 'Two.' },
      { questionId: 1, answer: 'One.' }
    ])
    await draft()

    const generate = requests.find((r) => r.query.includes('GenerateApplicationAnswers'))!
    expect(generate.variables.input).toMatchObject({ listingId: 5 })
    const prompt = requests.find((r) => r.query.includes('ApplicationAnswerExternalPrompt'))!
    expect(prompt.variables).toEqual({ listingId: 5 })
    expect(queryAll('answers-ai-row').map((r) => r.textContent)).toEqual([
      expect.stringContaining('1. Why us?'),
      expect.stringContaining('2. Why you?')
    ])
    expect(queryAll('answers-ai-candidate').map((t) => (t as HTMLTextAreaElement).value)).toEqual([
      'One.',
      'Two.'
    ])
  })

  it('saves only the ticked drafts, then closes', async () => {
    generated = succeeded([
      { questionId: 1, answer: 'One.' },
      { questionId: 2, answer: 'Two.' }
    ])
    const wrapper = await draft()
    queryAll('answers-ai-include')[0]!.click()
    await flushPromises()
    expect(query('answers-ai-save')!.textContent).toContain('Save 1 answer')

    query('answers-ai-save')!.click()
    await flushPromises()

    const save = requests.find((r) => r.query.includes('SaveApplicationAnswers'))!
    expect(save.variables).toEqual({
      q0: { id: 2, question: 'Why you?', charLimit: null, notes: 'Be brief', answer: 'Two.' }
    })
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('says when the AI returned nothing for a question', async () => {
    generated = succeeded([{ questionId: 1, answer: 'One.' }])
    await draft()

    expect(queryAll('answers-ai-missing')).toHaveLength(1)
    expect(queryAll('answers-ai-include')).toHaveLength(1)
  })

  it('shows a failed run with its code and stays on the first step', async () => {
    generated = {
      result: {
        status: 'FAILED',
        error: 'The AI gave up.',
        errorCode: 'bad-json',
        candidates: null
      },
      errors: null
    }
    await draft()

    expect(query('answers-ai-error')!.textContent).toContain('The AI gave up. (bad-json)')
    expect(query('answers-ai-row')).toBeNull()
  })

  it('shows the API message when the questions are too long together', async () => {
    generated = {
      result: null,
      errors: [{ __typename: 'InvalidApplicationQuestionError', message: 'Too long together.' }]
    }
    await draft()

    expect(query('answers-ai-error')!.textContent).toContain('Too long together.')
  })

  it('keeps a pasted reply that misses a question on the paste step', async () => {
    document.cookie = 'ai-method=own; path=/'
    previewed = {
      candidates: null,
      errors: [
        { __typename: 'InvalidApplicationQuestionError', message: 'Answer every question once.' }
      ]
    }
    await mount()
    const json = query('answers-ai-json') as HTMLTextAreaElement
    json.value = '{"answers":[]}'
    json.dispatchEvent(new Event('input'))
    await flushPromises()
    query('answers-ai-preview')!.click()
    await flushPromises()

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Answer every question once.')
    )
    expect(query('answers-ai-row')).toBeNull()
  })

  it('asks before closing with unsaved drafts, even unedited', async () => {
    generated = succeeded([{ questionId: 1, answer: 'One.' }])
    const wrapper = await draft()
    query('ai-modal-cancel')!.click()
    await flushPromises()

    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(document.body.textContent).toContain('Discard the drafted answers?')
    query('confirm-modal-confirm')!.click()
    await flushPromises()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('keeps a partly failed save open, says why, and retries only what failed', async () => {
    generated = succeeded([
      { questionId: 1, answer: 'One.' },
      { questionId: 2, answer: 'Two.' }
    ])
    failingSaves = ['r1']
    const wrapper = await draft()
    query('answers-ai-save')!.click()
    await vi.waitFor(() => expect(query('answers-ai-save-error')).not.toBeNull())

    expect(query('answers-ai-save-error')!.textContent).toContain('1 answer couldn’t be saved')
    expect(query('answers-ai-row-error')!.textContent).toContain('Rejected.')
    expect(queryAll('answers-ai-saved')).toHaveLength(1)
    expect(query('answers-ai-save')!.textContent).toContain('Save 1 answer')
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toBeUndefined()

    failingSaves = []
    query('answers-ai-save')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('update:open')).toEqual([[false]]))
    const saves = requests.filter((r) => r.query.includes('SaveApplicationAnswers'))
    expect(saves.at(-1)!.variables).toEqual({ q0: expect.objectContaining({ id: 2 }) })
  })

  it('asks before going back from unsaved drafts', async () => {
    generated = succeeded([{ questionId: 1, answer: 'One.' }])
    await draft()
    ;[...document.body.querySelectorAll<HTMLElement>('button')]
      .find((b) => b.textContent?.trim() === 'Back')!
      .click()
    await flushPromises()

    expect(document.body.textContent).toContain('Discard the drafted answers?')
    query('confirm-modal-confirm')!.click()
    await flushPromises()
    expect(query('answers-ai-row')).toBeNull()
    expect(query('answers-ai-run')).not.toBeNull()
  })

  it('fetches the prompt again on every open, since it holds the saved answers', async () => {
    const wrapper = await mount()
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    await vi.waitFor(() =>
      expect(
        requests.filter((r) => r.query.includes('query ApplicationAnswerExternalPrompt'))
      ).toHaveLength(2)
    )
  })
})
