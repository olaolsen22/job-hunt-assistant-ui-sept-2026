import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useAnswerReview } from '~/composables/useAnswerReview'
import type { ListingDetail } from '~/composables/useListing'

type Question = ListingDetail['applicationQuestions'][number]

const requests: { query: string; variables: Record<string, Record<string, unknown>> }[] = []
// Aliases whose save fails, and with which error type.
let failing: Record<string, string> = {}
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    return {
      data: Object.fromEntries(
        Object.keys(body.variables).map((key, i) => [
          `r${i}`,
          failing[key]
            ? {
                applicationQuestion: null,
                errors: [{ __typename: failing[key], message: `${key} failed` }]
              }
            : { applicationQuestion: { id: body.variables[key].id }, errors: null }
        ])
      )
    }
  }
})

const q = (id: number, extra: Partial<Question> = {}): Question => ({
  id,
  question: `Q${id}?`,
  charLimit: 10,
  answer: `Saved ${id}`,
  notes: null,
  ...extra
})
const candidate = (questionId: number, answer: string, overLimit = false) => ({
  questionId,
  answer,
  length: answer.length,
  overLimit
})

beforeEach(() => {
  requests.length = 0
  failing = {}
})

describe('useAnswerReview', () => {
  it('lists every question in card order, ticking drafts that fit', () => {
    const questions = ref([q(1), q(2), q(3), q(4)])
    const review = useAnswerReview(() => questions.value)
    review.start([
      candidate(2, 'Far too long here', true),
      candidate(1, 'Fits.'),
      candidate(4, '  '),
      candidate(99, 'Not on the listing')
    ])

    const rows = review.rows.value!
    expect(rows.map((r) => [r.id, review.numberOf(r)])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4]
    ])
    expect(rows.map((r) => r.include)).toEqual([true, false, false, false])
    expect(rows[1]!.aiOverLimit).toBe(true)
    expect(rows[2]!.missing).toBe(true)
    expect(review.pending.value).toBe(3)
    expect(review.overRows.value.map((r) => r.id)).toEqual([2])
    expect(review.selectable.value).toBe(1)
  })

  it('select all ticks only drafts that fit, and saving needs every ticked one to fit', () => {
    const questions = ref([q(1), q(2)])
    const review = useAnswerReview(() => questions.value)
    review.start([candidate(1, 'Fits.'), candidate(2, 'Far too long here')])

    review.setAll(false)
    expect(review.canSave.value).toBe(false)
    review.setAll(true)
    expect(review.included.value.map((r) => r.id)).toEqual([1])

    review.rows.value![0]!.text = 'Now this is over'
    expect(review.canSave.value).toBe(false)
    review.rows.value![0]!.text = 'Ok.'
    expect(review.canSave.value).toBe(true)
  })

  it('saves ticked drafts with the question as it is now, since update replaces the record', async () => {
    const questions = ref([q(1, { notes: 'Old' }), q(2), q(3)])
    const review = useAnswerReview(() => questions.value)
    review.start([candidate(1, 'One. '), candidate(2, 'Two.'), candidate(3, 'Three.')])
    review.rows.value![1]!.include = false
    // Edited in the form after the drafts came back.
    questions.value = [q(1, { question: 'Edited?', charLimit: 20, notes: 'New' }), q(2), q(3)]

    const result = await review.save()

    expect(result).toEqual({ saved: 2, failed: 0, stale: false })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.query).toContain('mutation SaveApplicationAnswers')
    expect(requests[0]!.variables).toEqual({
      q0: { id: 1, question: 'Edited?', charLimit: 20, notes: 'New', answer: 'One.' },
      q1: { id: 3, question: 'Q3?', charLimit: 10, notes: null, answer: 'Three.' }
    })
    expect(review.rows.value!.map((r) => r.saved)).toEqual([true, false, true])
    expect(review.pending.value).toBe(1)
  })

  it('keeps failed rows for a retry that sends only them, and refetches when one is gone', async () => {
    const questions = ref([q(1), q(2)])
    const review = useAnswerReview(() => questions.value)
    review.start([candidate(1, 'One.'), candidate(2, 'Two.')])
    failing = { q1: 'ApplicationQuestionNotFoundError' }

    expect(await review.save()).toEqual({ saved: 1, failed: 1, stale: true })
    expect(review.rows.value![1]!.error).toBe('q1 failed')
    expect(review.rows.value![1]!.include).toBe(true)

    failing = {}
    expect(await review.save()).toEqual({ saved: 1, failed: 0, stale: false })
    expect(requests.at(-1)!.variables).toEqual({
      q0: expect.objectContaining({ id: 2, answer: 'Two.' })
    })
  })

  it('includes a trimmed draft unless the owner unticked it by hand', async () => {
    const questions = ref([q(1), q(2)])
    const review = useAnswerReview(() => questions.value)
    review.start([candidate(1, 'Far too long here'), candidate(2, 'Also too long here')])
    const [one, two] = review.rows.value!

    review.toggle(two!, false)
    one!.text = 'Short.'
    two!.text = 'Short.'
    await nextTick()

    expect(one!.include).toBe(true)
    expect(two!.include).toBe(false)
  })

  it('measures the trimmed text, which is what gets saved', () => {
    const questions = ref([q(1)])
    const review = useAnswerReview(() => questions.value)
    review.start([candidate(1, 'Ten chars.\n\n')])

    expect(review.rows.value![0]!.include).toBe(true)
  })

  it('drops the row of a question that is deleted while reviewing', async () => {
    const questions = ref([q(1), q(2)])
    const review = useAnswerReview(() => questions.value)
    review.start([candidate(1, 'One.'), candidate(2, 'Two.')])

    questions.value = [q(2)]
    await nextTick()

    expect(review.rows.value!.map((r) => r.id)).toEqual([2])
    expect(review.numberOf(review.rows.value![0]!)).toBe(1)
  })
})
