<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { ListingDetail } from '~/composables/useListing'

// Without `question` it adds one; with it, it edits that one. AI drafting lives on the questions
// card, which drafts every answer at once.
const { listingId, question } = defineProps<{
  listingId: number
  question: Question | null
}>()
const open = defineModel<boolean>('open', { required: true })
type Question = ListingDetail['applicationQuestions'][number]
const emit = defineEmits<{ changed: [] }>()

const ADD_QUESTION = graphql(`
  mutation AddApplicationQuestion($input: AddApplicationQuestionInput!) {
    addApplicationQuestion(input: $input) {
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
  }
`)

const UPDATE_QUESTION = graphql(`
  mutation UpdateApplicationQuestion($input: UpdateApplicationQuestionInput!) {
    updateApplicationQuestion(input: $input) {
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
  }
`)

const state = reactive({
  question: '',
  charLimit: undefined as number | undefined,
  answer: '',
  notes: ''
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.question = question?.question ?? ''
  state.charLimit = question?.charLimit ?? undefined
  state.answer = question?.answer ?? ''
  state.notes = question?.notes ?? ''
})

const validate = (s: Partial<typeof state>): FormError[] => {
  const errors: FormError[] = []
  if (!s.question?.trim()) errors.push({ name: 'question', message: 'Required' })
  if (s.answer && isOverLimit(s.answer, s.charLimit))
    errors.push({ name: 'answer', message: 'Over the limit. Trim it to save.' })
  return errors
}

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  // Update replaces the whole record, so every field is sent.
  const fields = {
    question: state.question.trim(),
    charLimit: state.charLimit ?? null,
    answer: state.answer || null,
    notes: state.notes.trim() || null
  }
  const ok = await run(async () => {
    if (question) {
      const { updateApplicationQuestion } = await gql(UPDATE_QUESTION, {
        input: { id: question.id, ...fields }
      })
      return updateApplicationQuestion.errors
    }
    const { addApplicationQuestion } = await gql(ADD_QUESTION, {
      input: { listingId, ...fields }
    })
    return addApplicationQuestion.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="question ? 'Edit question' : 'Add question'"
    :state="state"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField
        label="Question"
        name="question"
        required
        :hint="`${state.question.length} / ${QUESTION_MAX}`"
      >
        <UTextarea
          v-model="state.question"
          :maxlength="QUESTION_MAX"
          :rows="2"
          autoresize
          class="w-full"
          data-testid="question-input"
        />
      </UFormField>
      <UFormField label="Character limit" name="charLimit" help="Leave empty if the form has none.">
        <UInputNumber
          v-model="state.charLimit"
          :min="1"
          :max="CHAR_LIMIT_MAX"
          :increment="false"
          :decrement="false"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Answer"
        name="answer"
        help="What you paste into the form. It has to fit the limit to save. Draft answers with AI revises saved answers."
        :hint="`${state.answer.length} / ${state.charLimit ?? ANSWER_MAX}`"
      >
        <UTextarea
          v-model="state.answer"
          :rows="6"
          :maxrows="14"
          autoresize
          class="w-full"
          data-testid="answer-input"
        />
      </UFormField>
      <UFormField
        label="Notes for the AI"
        name="notes"
        help="Instructions only the AI sees when it drafts answers, e.g. “mention the Vue migration”. Never part of the answer."
        :hint="`${state.notes.length} / ${NOTES_MAX}`"
      >
        <UTextarea
          v-model="state.notes"
          :maxlength="NOTES_MAX"
          :rows="2"
          autoresize
          class="w-full"
        />
      </UFormField>
    </div>
  </AppFormModal>
</template>
