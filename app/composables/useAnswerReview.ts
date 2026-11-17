import { print } from '@0no-co/graphql.web'
import type { ResultOf } from 'gql.tada'
import type { ListingDetail } from '~/composables/useListing'
import type { AnswerCandidate } from '~/composables/useApplicationAnswersAi'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

type Question = ListingDetail['applicationQuestions'][number]

const RESULT_FRAGMENT = graphql(`
  fragment UpdateAnswerResult on UpdateApplicationQuestionPayload {
    applicationQuestion {
      id
    }
    errors {
      __typename
      ... on Error {
        message
      }
    }
  }
`)
type UpdateResult = ResultOf<typeof RESULT_FRAGMENT>

// One aliased update per answer keeps a save to one request; the API saves each on its own, so one
// failing answer doesn't stop the others.
const buildMutation = (count: number) => {
  const indexes = [...Array(count).keys()]
  return batchDocument<UpdateResult>(`
    mutation SaveApplicationAnswers(${indexes.map((i) => `$q${i}: UpdateApplicationQuestionInput!`).join(', ')}) {
      ${indexes.map((i) => `r${i}: updateApplicationQuestion(input: $q${i}) { ...UpdateAnswerResult }`).join('\n')}
    }
    ${print(RESULT_FRAGMENT)}
  `)
}

// One question in the review. missing: the AI returned no draft for it, so there is nothing to save.
// touched: the owner set the tick themselves, so fitting or not fitting no longer moves it.
export interface AnswerRow {
  id: number
  text: string
  include: boolean
  aiOverLimit: boolean
  missing: boolean
  saved: boolean
  touched: boolean
  error?: string
}

// stale: a question was gone (deleted elsewhere), so the listing should be refetched.
export interface AnswerSaveResult {
  saved: number
  failed: number
  stale: boolean
}

// The review step of drafting every answer at once: each question's draft, ticked when it fits.
// Saving sends the ticked ones and keeps a per-row result, so a retry only sends what failed. The
// question, limit and notes are read from the live list at save time, because update replaces the
// whole record and the question may have been edited since the drafts came back.
export const useAnswerReview = (questions: () => Question[]) => {
  const rows = ref<AnswerRow[]>()
  const saving = ref(false)
  const saveError = ref('')

  const byId = computed(() => new Map(questions().map((q, i) => [q.id, { q, n: i + 1 }])))
  const question = (row: AnswerRow) => byId.value.get(row.id)?.q
  // The live position, so the numbers match the card after a question is deleted mid-review.
  const numberOf = (row: AnswerRow) => byId.value.get(row.id)?.n ?? 0
  const limitOf = (row: AnswerRow) => question(row)?.charLimit ?? null
  // What is saved is the trimmed text, so that is what is measured.
  const lengthOf = (row: AnswerRow) => row.text.trim().length
  const overBy = (row: AnswerRow) => Math.max(0, lengthOf(row) - (limitOf(row) ?? ANSWER_MAX))
  const fits = (row: AnswerRow) => !!lengthOf(row) && !overBy(row)
  // Rows that can still be saved: a draft came back and it isn't saved yet.
  const open = (row: AnswerRow) => !row.missing && !row.saved

  const included = computed(() => rows.value?.filter((r) => r.include && open(r)) ?? [])
  const invalid = computed(() => included.value.filter((r) => !fits(r)).length)
  const canSave = computed(() => !!included.value.length && !invalid.value)
  const pending = computed(() => rows.value?.filter(open).length ?? 0)
  // What Select all can reach: drafts that fit, plus any still ticked while over (so "selected"
  // never exceeds the total).
  const selectable = computed(
    () => rows.value?.filter((r) => open(r) && (r.include || fits(r))).length ?? 0
  )
  const overRows = computed(() => rows.value?.filter((r) => open(r) && !!overBy(r)) ?? [])

  // In card order; a candidate for a question that isn't on the listing is ignored.
  const start = (candidates: AnswerCandidate[]) => {
    const drafts = new Map(candidates.map((c) => [c.questionId, c]))
    saveError.value = ''
    rows.value = questions().map((q) => {
      const draft = drafts.get(q.id)
      const row: AnswerRow = {
        id: q.id,
        text: draft?.answer ?? '',
        include: false,
        aiOverLimit: !!draft?.overLimit,
        missing: !draft,
        saved: false,
        touched: false
      }
      row.include = !!draft && fits(row)
      return row
    })
  }

  const toggle = (row: AnswerRow, include: boolean) => {
    row.include = include
    row.touched = true
  }
  // Select all goes back to "tick what fits", so a draft trimmed later still joins; none is a choice.
  const setAll = (include: boolean) =>
    rows.value?.forEach((r) => {
      if (!open(r)) return
      r.touched = !include
      r.include = include && fits(r)
    })

  // A draft the owner hasn't ticked by hand follows whether it fits: trimming an over-limit draft
  // includes it, and editing one past the limit (or a limit lowered in the form) leaves it out.
  watch(
    () => rows.value?.map(fits),
    () =>
      rows.value?.forEach((r) => {
        if (open(r) && !r.touched) r.include = fits(r)
      })
  )

  const clear = () => {
    rows.value = undefined
    saveError.value = ''
  }

  // A question deleted while reviewing (a stale refetch) takes its row with it.
  watch(
    () => questions().map((q) => q.id),
    (ids) => {
      if (rows.value) rows.value = rows.value.filter((r) => ids.includes(r.id))
    }
  )

  const save = async (): Promise<AnswerSaveResult | undefined> => {
    if (!canSave.value || saving.value) return
    const batch = included.value.flatMap((row) => {
      const q = question(row)
      return q ? [{ row, q }] : []
    })
    if (!batch.length) return
    saving.value = true
    saveError.value = ''
    try {
      const data = await gql(
        buildMutation(batch.length),
        Object.fromEntries(
          batch.map(({ row, q }, i) => [
            `q${i}`,
            {
              id: row.id,
              question: q.question,
              charLimit: q.charLimit,
              notes: q.notes,
              answer: row.text.trim()
            }
          ])
        )
      )
      let stale = false
      batch.forEach(({ row }, i) => {
        const errors = data[`r${i}`]?.errors
        row.error = errors?.map((e) => e.message).join(' ') || undefined
        row.saved = !row.error
        if (row.saved) row.include = false
        if (errors?.some((e) => e.__typename.endsWith('NotFoundError'))) stale = true
      })
      const saved = batch.filter(({ row }) => row.saved).length
      return { saved, failed: batch.length - saved, stale }
    } catch {
      saveError.value = ERROR_MESSAGES.generic
    } finally {
      saving.value = false
    }
  }

  return {
    rows,
    saving,
    saveError,
    included,
    invalid,
    canSave,
    pending,
    selectable,
    overRows,
    question,
    numberOf,
    limitOf,
    lengthOf,
    overBy,
    fits,
    start,
    setAll,
    toggle,
    clear,
    save
  }
}
