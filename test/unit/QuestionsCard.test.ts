import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QuestionsCard from '~/components/listings/QuestionsCard.vue'
import type { ListingDetail } from '~/composables/useListing'

const listing = (applicationQuestions: Partial<ListingDetail['applicationQuestions'][number]>[]) =>
  ({ id: 5, applicationQuestions }) as unknown as ListingDetail

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
})
