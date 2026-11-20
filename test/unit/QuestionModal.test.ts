import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import QuestionModal from '~/components/listings/QuestionModal.vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requests: { query: string; variables: Record<string, any> }[] = []
// Lines whose question contains "fail" come back with a typed error.
const batchResponse = (body: { variables: Record<string, { question: string }> }) => ({
  data: Object.fromEntries(
    Object.entries(body.variables).map(([key, v], i) => [
      key.replace('q', 'r'),
      v.question.includes('fail')
        ? {
            applicationQuestion: null,
            errors: [{ __typename: 'ValidationError', message: 'Question is not valid.' }]
          }
        : { applicationQuestion: { id: 100 + i }, errors: null }
    ])
  )
})
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('mutation AddApplicationQuestions')) return batchResponse(body)
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
const mount = async (current: typeof question | null = question, remaining = 20) => {
  const wrapper = await mountSuspended(QuestionModal, {
    props: { open: false, listingId: 5, question: current, remaining },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}
const field = (testid: string) =>
  document.body.querySelector<HTMLTextAreaElement>(`[data-testid="${testid}"]`)!
const type = async (testid: string, value: string) => {
  const el = document.body.querySelector<HTMLTextAreaElement>(
    `[data-testid="${testid}"] textarea, textarea[data-testid="${testid}"]`
  )!
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
const saveButton = () =>
  document.body.querySelector<HTMLElement>('[data-testid="form-modal-save"]')!
const pasteTab = async () => {
  const tab = [
    ...document.body.querySelectorAll<HTMLElement>('[data-testid="question-mode"] button')
  ].find((b) => b.textContent?.includes('Paste several'))!
  tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  tab.click()
  await flushPromises()
}
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

  it('adds a new question with its fields', async () => {
    const wrapper = await mount(null)
    field('question-input').value = 'Why us?'
    field('question-input').dispatchEvent(new Event('input'))
    await save()

    expect(requests.at(-1)?.query).toContain('mutation AddApplicationQuestion')
    expect(requests.at(-1)?.variables.input).toMatchObject({ listingId: 5, question: 'Why us?' })
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
  })

  it('offers no AI drafting, which lives on the questions card', async () => {
    await mount()

    expect(document.body.querySelector('[data-testid="question-ai-open"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Refine with AI')
  })

  it('adds another without closing, and reports the total once on close', async () => {
    const wrapper = await mount(null)
    document.body
      .querySelector<HTMLElement>(
        '[data-testid="question-add-another"] button, [data-testid="question-add-another"]'
      )!
      .click()
    await flushPromises()
    await type('question-input', 'Why us?')
    await save()
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    await flushPromises()
    expect(wrapper.props('open')).toBe(true)
    expect(field('question-input').value).toBe('')
    expect(wrapper.emitted('added')).toBeFalsy()

    await type('question-input', 'Why you?')
    await save()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(2))
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(wrapper.emitted('added')).toEqual([[2]])
  })

  it('closes after the save that fills the last slot, even with add another on', async () => {
    const wrapper = await mount(null, 2)
    document.body
      .querySelector<HTMLElement>(
        '[data-testid="question-add-another"] button, [data-testid="question-add-another"]'
      )!
      .click()
    await flushPromises()
    await type('question-input', 'A?')
    await save()
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    await flushPromises()
    expect(wrapper.emitted('update:open')).toBeFalsy()

    await type('question-input', 'B?')
    await save()
    await vi.waitFor(() => expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]))
  })

  it('has no add-another option when only one slot is left', async () => {
    await mount(null, 1)
    expect(document.body.querySelector('[data-testid="question-add-another"]')).toBeNull()
  })

  it('labels the single-question save as one question', async () => {
    await mount(null)
    expect(saveButton().textContent).toContain('Add question')
    expect(saveButton().textContent).not.toMatch(/\d/)
  })

  it('previews pasted lines and counts them in the save label', async () => {
    await mount(null)
    await pasteTab()
    await type('question-paste', '1. Why us? (500)\n\nWhy you?')

    const preview = document.body.querySelector('[data-testid="question-paste-preview"]')!
    expect(preview.querySelectorAll('li')).toHaveLength(2)
    expect(preview.textContent).toContain('Limit 500')
    expect(preview.textContent).not.toContain('1. Why us?  ')
    expect(saveButton().textContent).toContain('Add 2 questions')
  })

  it('adds all pasted lines in one batched request, in order', async () => {
    const wrapper = await mount(null)
    await pasteTab()
    await type('question-paste', 'Why us? (500)\nWhy you?')
    await save()

    await vi.waitFor(() => expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]))
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(wrapper.emitted('added')).toEqual([[2]])
    expect(requests).toHaveLength(1)
    expect(requests[0]!.query).toContain('mutation AddApplicationQuestions')
    expect(requests[0]!.variables).toEqual({
      q0: { listingId: 5, question: 'Why us?', charLimit: 500 },
      q1: { listingId: 5, question: 'Why you?', charLimit: null }
    })
    expect(wrapper.emitted('changed')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('does not send lines with errors or past the remaining slots', async () => {
    await mount(null, 1)
    await pasteTab()
    await type('question-paste', 'A\nB')
    expect(document.body.textContent).toContain('Only 1 more fit')
    await save()
    expect(requests).toHaveLength(0)
    expect(document.body.textContent).toContain('Remove the extra lines')

    await type('question-paste', 'Bad? (0)')
    expect(document.body.textContent).toContain('or use a limit from 1 to')
    await save()
    expect(requests).toHaveLength(0)
    expect(document.body.textContent).toContain('Fix the lines marked below')
  })

  it('keeps only the failed lines and says what happened on a partial failure', async () => {
    const wrapper = await mount(null)
    await pasteTab()
    await type('question-paste', 'Why us?\nThis will fail (300)')
    await save()

    await vi.waitFor(() =>
      expect(
        document.body.querySelector('[data-testid="question-paste-error"]')?.textContent
      ).toContain('1 added, 1 failed: Question is not valid.')
    )
    expect(field('question-paste').value ?? document.body.querySelector('textarea')!.value).toBe(
      'This will fail (300)'
    )
    expect(wrapper.emitted('update:open')).toBeFalsy()
    expect(wrapper.emitted('changed')).toBeTruthy()
    // The one that went through is counted once the modal closes.
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(wrapper.emitted('added')).toEqual([[1]])
  })
})
