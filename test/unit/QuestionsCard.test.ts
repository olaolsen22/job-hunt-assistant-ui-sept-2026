import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import QuestionsCard from '~/components/listings/QuestionsCard.vue'
import type { ListingDetail } from '~/composables/useListing'

const listing = (applicationQuestions: Partial<ListingDetail['applicationQuestions'][number]>[]) =>
  ({ id: 5, applicationQuestions }) as unknown as ListingDetail

const { success } = vi.hoisted(() => ({ success: vi.fn() }))
mockNuxtImport('useAppToast', () => () => ({
  success,
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
}))

registerEndpoint('/graphql', {
  method: 'POST',
  handler: () => ({
    data: { addApplicationQuestion: { applicationQuestion: { id: 9 }, errors: null } }
  })
})

const mounted: { unmount: () => void }[] = []
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('QuestionsCard', () => {
  it('opens an unanswered question straight from the list', async () => {
    const wrapper = await mountSuspended(QuestionsCard, {
      props: {
        listing: listing([
          { id: 1, question: 'Why us?', charLimit: 500, answer: null, notes: null }
        ])
      },
      attachTo: document.body
    })
    mounted.push(wrapper)
    await wrapper.get('[data-testid="question-add-answer"]').trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('Edit question')
    expect(document.body.querySelector('[data-testid="answer-input"]')).not.toBeNull()
  })

  it('says how far over the limit a saved answer is, not only in colour', async () => {
    const wrapper = await mountSuspended(QuestionsCard, {
      props: {
        listing: listing([
          { id: 1, question: 'Why us?', charLimit: 3, answer: 'Hello', notes: null }
        ])
      }
    })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="question-row"]').text()).toContain('2 over')
  })

  it('blocks adding at 20 questions', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      question: `Q${i}`,
      charLimit: null,
      answer: null,
      notes: null
    }))
    const wrapper = await mountSuspended(QuestionsCard, { props: { listing: listing(twenty) } })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="question-add"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="questions-count"]').text()).toContain('Limit reached')
  })

  it('sums up progress, with over the limit said in words', async () => {
    const wrapper = await mountSuspended(QuestionsCard, {
      props: {
        listing: listing([
          { id: 1, question: 'Why us?', charLimit: 3, answer: 'Hello', notes: null },
          { id: 2, question: 'Why you?', charLimit: null, answer: 'Because', notes: null },
          { id: 3, question: 'When?', charLimit: 100, answer: null, notes: 'Say May' },
          { id: 4, question: 'Where?', charLimit: null, answer: '  ', notes: null }
        ])
      }
    })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="questions-summary"]').text()).toMatch(
      /2 of 4 answered\s*·\s*1 over its limit/
    )
    const rows = wrapper.findAll('[data-testid="question-row"]')
    expect(rows[1]!.text()).toContain('2. Why you?')
    expect(rows[1]!.find('[data-testid="question-meta"]').text()).toBe('7 characters')
    expect(rows[2]!.find('[data-testid="question-meta"]').text()).toContain('Limit 100')
    expect(rows[2]!.find('[data-testid="question-notes"]').text()).toContain('Notes for the AI')
    expect(rows[0]!.find('[data-testid="question-notes"]').exists()).toBe(false)
    expect(rows[1]!.find('[aria-label="Edit question 2"]').exists()).toBe(true)
  })

  it('shows the empty state with its own Add button and no AI action', async () => {
    const wrapper = await mountSuspended(QuestionsCard, { props: { listing: listing([]) } })
    mounted.push(wrapper)

    expect(wrapper.find('[data-testid="questions-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="question-add"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="questions-ai-open"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="questions-summary"]').exists()).toBe(false)
  })

  it('explains the two steps in the empty state, with AI drafting shown but disabled', async () => {
    const wrapper = await mountSuspended(QuestionsCard, { props: { listing: listing([]) } })
    mounted.push(wrapper)

    expect(wrapper.findAll('[data-testid="questions-steps"] li')).toHaveLength(2)
    expect(wrapper.get('[data-testid="question-add"]').text()).toBe('Add questions')
    expect(
      wrapper.get('[data-testid="questions-ai-disabled"]').attributes('disabled')
    ).toBeDefined()
  })

  it('labels the header button for adding several', async () => {
    const wrapper = await mountSuspended(QuestionsCard, {
      props: {
        listing: listing([{ id: 1, question: 'Q', charLimit: null, answer: null, notes: null }])
      }
    })
    mounted.push(wrapper)
    expect(wrapper.get('[data-testid="question-add"]').text()).toBe('Add questions')
  })

  it('points at AI drafting after the first question on an empty listing', async () => {
    success.mockClear()
    const wrapper = await mountSuspended(QuestionsCard, {
      props: { listing: listing([]) },
      attachTo: document.body
    })
    mounted.push(wrapper)
    await wrapper.get('[data-testid="question-add"]').trigger('click')
    await flushPromises()
    const input = document.body.querySelector<HTMLTextAreaElement>(
      '[data-testid="question-input"]'
    )!
    input.value = 'Why us?'
    input.dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLElement>('[data-testid="form-modal-save"]')!.click()

    await vi.waitFor(() => expect(success).toHaveBeenCalledTimes(1))
    expect(success.mock.calls[0]![0]).toBe('Question added')
    expect(success.mock.calls[0]![1].action.label).toBe('Draft answers with AI')
  })

  it('shows no AI toast when the listing already had questions', async () => {
    success.mockClear()
    const wrapper = await mountSuspended(QuestionsCard, {
      props: {
        listing: listing([{ id: 1, question: 'Q', charLimit: null, answer: null, notes: null }])
      },
      attachTo: document.body
    })
    mounted.push(wrapper)
    await wrapper.get('[data-testid="question-add"]').trigger('click')
    await flushPromises()
    const input = document.body.querySelector<HTMLTextAreaElement>(
      '[data-testid="question-input"]'
    )!
    input.value = 'Why you?'
    input.dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLElement>('[data-testid="form-modal-save"]')!.click()

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    await flushPromises()
    expect(success).not.toHaveBeenCalled()
  })

  describe('copy and long answers', () => {
    const long = 'A'.repeat(1500)
    const rows = () =>
      listing([
        { id: 1, question: 'Short?', charLimit: null, answer: 'Short answer', notes: null },
        { id: 2, question: 'Long?', charLimit: null, answer: long, notes: null },
        { id: 3, question: 'Over?', charLimit: 3, answer: 'Hello', notes: null },
        { id: 4, question: 'Open?', charLimit: null, answer: null, notes: null }
      ])

    afterEach(() => {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it('copies the full answer and shows Copied on that row only, for 2 seconds', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      const wrapper = await mountSuspended(QuestionsCard, { props: { listing: rows() } })
      mounted.push(wrapper)
      vi.useFakeTimers()

      const copies = wrapper.findAll('[data-testid="question-copy"]')
      expect(copies).toHaveLength(3)
      expect(copies[1]!.attributes('aria-label')).toBe('Copy answer 2')
      await copies[1]!.trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith(long)
      expect(copies[1]!.text()).toBe('Copied')
      expect(copies[1]!.attributes('aria-label')).toBe('Answer 2 copied')
      expect(copies[0]!.text()).toBe('Copy')
      expect(copies[2]!.text()).toBe('Copy')

      vi.advanceTimersByTime(2000)
      await flushPromises()
      expect(copies[1]!.text()).toBe('Copy')
    })

    it('still copies an over-limit answer in full', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      const wrapper = await mountSuspended(QuestionsCard, { props: { listing: rows() } })
      mounted.push(wrapper)

      await wrapper.get('[aria-label="Copy answer 3"]').trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledWith('Hello')
    })

    it('has no Copy on an unanswered question', async () => {
      const wrapper = await mountSuspended(QuestionsCard, { props: { listing: rows() } })
      mounted.push(wrapper)

      const open = wrapper.findAll('[data-testid="question-row"]')[3]!
      expect(open.find('[data-testid="question-copy"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="Copy answer 4"]').exists()).toBe(false)
      expect(open.get('[data-testid="question-add-answer"]').text()).toBe('Write answer')
      expect(wrapper.findAll('[data-testid="question-add-answer"]')).toHaveLength(1)
    })

    it('clamps only long answers, with a toggle to show them in full', async () => {
      const wrapper = await mountSuspended(QuestionsCard, { props: { listing: rows() } })
      mounted.push(wrapper)

      const answers = wrapper.findAll('[data-testid="question-answer"]')
      expect(answers[0]!.classes()).not.toContain('line-clamp-6')
      expect(answers[1]!.classes()).toContain('line-clamp-6')
      expect(answers[1]!.text()).toBe(long)
      const toggles = wrapper.findAll('[data-testid="question-answer-toggle"]')
      expect(toggles).toHaveLength(1)
      expect(toggles[0]!.text()).toBe('Show full answer')
      expect(toggles[0]!.attributes('aria-expanded')).toBe('false')
      expect(toggles[0]!.attributes('aria-controls')).toBe(answers[1]!.attributes('id'))

      await toggles[0]!.trigger('click')
      expect(answers[1]!.classes()).not.toContain('line-clamp-6')
      expect(toggles[0]!.text()).toBe('Show less')
      expect(toggles[0]!.attributes('aria-expanded')).toBe('true')
      await toggles[0]!.trigger('click')
      expect(answers[1]!.classes()).toContain('line-clamp-6')
    })

    it('links the over-limit summary to the first over-limit row', async () => {
      const wrapper = await mountSuspended(QuestionsCard, {
        props: { listing: rows() },
        attachTo: document.body
      })
      mounted.push(wrapper)
      const row = document.getElementById('question-3')!
      const scrollIntoView = vi.fn()
      row.scrollIntoView = scrollIntoView

      const link = wrapper.get('[data-testid="questions-over-link"]')
      expect(link.text()).toContain('1 over its limit')
      await link.trigger('click')
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(row)
    })
  })
})
