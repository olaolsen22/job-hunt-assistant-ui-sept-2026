<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { ListingDetail } from '~/composables/useListing'

// Without `question` it adds one; with it, it edits that one. Refine with AI saves first (the AI
// reads the saved question), then fills the answer here for a final Save.
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

const aiOpen = ref(false)
const form = useTemplateRef('form')

const { run, loading } = useMutation(() => emit('changed'))

// A new question gets its id from the first save (Refine with AI), and later saves update it.
const addedId = ref<number>()
watch(open, (isOpen) => {
  if (isOpen) addedId.value = undefined
})
const savedId = computed(() => question?.id ?? addedId.value)

const save = () => {
  // Update replaces the whole record, so every field is sent.
  const fields = {
    question: state.question.trim(),
    charLimit: state.charLimit ?? null,
    answer: state.answer || null,
    notes: state.notes.trim() || null
  }
  return run(async () => {
    if (savedId.value) {
      const { updateApplicationQuestion } = await gql(UPDATE_QUESTION, {
        input: { id: savedId.value, ...fields }
      })
      return updateApplicationQuestion.errors
    }
    const { addApplicationQuestion } = await gql(ADD_QUESTION, {
      input: { listingId, ...fields }
    })
    addedId.value = addApplicationQuestion.applicationQuestion?.id
    return addApplicationQuestion.errors
  })
}

const submit = async () => {
  if (!(await save())) return
  open.value = false
  emit('changed')
}

// The AI reads the saved question, so the form is saved first and stays open for the result.
const refine = async () => {
  if (!(await form.value?.validate())) return
  if (!(await save())) return
  form.value?.markClean()
  emit('changed')
  aiOpen.value = true
}
</script>

<template>
  <AppFormModal
    ref="form"
    v-model:open="open"
    :title="savedId ? 'Edit question' : 'Add question'"
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
        help="Your own text. Refine with AI revises it in your voice, or writes one if it’s empty."
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
        help="Instructions only the AI sees, e.g. “mention the Vue migration”. Never part of the answer."
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
      <UButton
        block
        icon="i-lucide-sparkles"
        :disabled="loading"
        data-testid="question-ai-open"
        @click="refine"
        >Refine with AI</UButton
      >
    </div>
  </AppFormModal>

  <!-- Keyed by question, so its prompt and retry state never carry over to another one. -->
  <ListingsQuestionAiModal
    v-if="savedId"
    :key="savedId"
    v-model:open="aiOpen"
    :question-id="savedId"
    :char-limit="state.charLimit ?? null"
    :current-answer="state.answer"
    @use="state.answer = $event"
  />
</template>
