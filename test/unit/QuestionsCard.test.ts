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
})
