<script setup lang="ts">
import { print } from '@0no-co/graphql.web'
import type { FormError } from '@nuxt/ui'
import type { ResultOf } from 'gql.tada'
import type { ListingDetail } from '~/composables/useListing'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// Without `question` it adds questions, one with all fields or several pasted one per line; with
// it, it edits that one. AI drafting lives on the questions card, which drafts every answer at once.
const { listingId, question, remaining } = defineProps<{
  listingId: number
  question: Question | null
  // Free slots on the listing, so a paste can't go past QUESTIONS_PER_LISTING.
  remaining: number
}>()
const open = defineModel<boolean>('open', { required: true })
type Question = ListingDetail['applicationQuestions'][number]
const emit = defineEmits<{ changed: []; added: [count: number] }>()

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

const ADD_RESULT = graphql(`
  fragment AddQuestionResult on AddApplicationQuestionPayload {
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
type AddResult = ResultOf<typeof ADD_RESULT>

// One aliased add per pasted line keeps it to one request. The API saves each on its own and in
// field order, so the questions keep the pasted order and one bad line doesn't stop the rest.
const buildBatch = (count: number) => {
  const indexes = [...Array(count).keys()]
  return batchDocument<AddResult>(`
    mutation AddApplicationQuestions(${indexes.map((i) => `$q${i}: AddApplicationQuestionInput!`).join(', ')}) {
      ${indexes.map((i) => `r${i}: addApplicationQuestion(input: $q${i}) { ...AddQuestionResult }`).join('\n')}
    }
    ${print(ADD_RESULT)}
  `)
}

const mode = ref<'one' | 'paste'>('one')
const tabs = [
  { label: 'One question', value: 'one', icon: 'i-lucide-message-square-plus' },
  { label: 'Paste several', value: 'paste', icon: 'i-lucide-list-plus' }
]
const addAnother = ref(false)
const pasteError = ref('')

const state = reactive({
  paste: '',
  question: '',
  charLimit: undefined as number | undefined,
  answer: '',
  notes: ''
})

// Saves made since opening: `remaining` only catches up once the parent's refetch lands.
const addedHere = ref(0)
const left = computed(() => remaining - addedHere.value)
const pasted = computed(() => parseQuestionLines(state.paste, left.value))
const pasteCount = computed(() => pasted.value.filter((l) => !l.overflow && !l.error).length)

const resetFields = () => {
  state.question = ''
  state.charLimit = undefined
  state.answer = ''
  state.notes = ''
}

// Reported once on close, so the card's next-step toast never opens AI over this modal.
watch(open, (isOpen) => {
  if (!isOpen) {
    if (addedHere.value) emit('added', addedHere.value)
    return
  }
  addedHere.value = 0
  addAnother.value = false
  mode.value = 'one'
  state.paste = ''
  pasteError.value = ''
  state.question = question?.question ?? ''
  state.charLimit = question?.charLimit ?? undefined
  state.answer = question?.answer ?? ''
  state.notes = question?.notes ?? ''
})

const validate = (s: Partial<typeof state>): FormError[] => {
  const errors: FormError[] = []
  if (mode.value === 'paste') {
    if (!pasted.value.length) errors.push({ name: 'paste', message: 'Add at least one question' })
    else if (pasted.value.some((l) => l.error))
      errors.push({ name: 'paste', message: 'Fix the lines marked below' })
    else if (pasted.value.some((l) => l.overflow))
      errors.push({
        name: 'paste',
        message: `Only ${left.value} more fit. Remove the extra lines.`
      })
    return errors
  }
  if (!s.question?.trim()) errors.push({ name: 'question', message: 'Required' })
  if (s.answer && isOverLimit(s.answer, s.charLimit))
    errors.push({ name: 'answer', message: 'Over the limit. Trim it to save.' })
  return errors
}

const { run, loading } = useMutation(() => emit('changed'))
const modal = useTemplateRef('modal')
const questionInput = useTemplateRef('questionInput')
const pasting = ref(false)

const submitPaste = async () => {
  const lines = pasted.value
  pasting.value = true
  pasteError.value = ''
  try {
    const vars = Object.fromEntries(
      lines.map((l, i) => [`q${i}`, { listingId, question: l.question, charLimit: l.charLimit }])
    )
    const result = await gql(buildBatch(lines.length), vars)
    const failed = lines
      .map((l, i) => ({ l, r: result[`r${i}`] }))
      .filter(({ r }) => !r?.applicationQuestion)
    const added = lines.length - failed.length
    addedHere.value += added
    if (added) emit('changed')
    if (!failed.length) {
      open.value = false
      return
    }
    // Keep only what failed, so fixing and saving again doesn't add the rest twice.
    state.paste = failed
      .map(({ l }) => (l.charLimit !== null ? `${l.question} (${l.charLimit})` : l.question))
      .join('\n')
    const messages = [
      ...new Set(failed.map(({ r }) => r?.errors?.[0]?.message ?? ERROR_MESSAGES.generic))
    ]
    pasteError.value = `${added} added, ${failed.length} failed: ${messages.join(' ')}`
    modal.value?.markClean()
  } catch (e) {
    // A failure outside the typed errors can come after earlier lines saved: refetch, and warn
    // before a retry adds them twice.
    emit('changed')
    pasteError.value = `${genericError(e)} Some questions may have been added; check the list before adding again.`
  } finally {
    pasting.value = false
  }
}

const submit = async () => {
  if (mode.value === 'paste') return submitPaste()
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
  emit('changed')
  if (question) {
    open.value = false
    return
  }
  addedHere.value++
  if (!addAnother.value || left.value < 1) {
    open.value = false
    return
  }
  resetFields()
  modal.value?.markClean()
  await nextTick()
  questionInput.value?.textareaRef?.focus()
}

const saveLabel = computed(() => {
  if (question) return 'Save'
  if (mode.value === 'one') return 'Add question'
  if (!pasteCount.value) return 'Add questions'
  return pasteCount.value === 1 ? 'Add 1 question' : `Add ${pasteCount.value} questions`
})
</script>

<template>
  <AppFormModal
    ref="modal"
    v-model:open="open"
    :title="question ? 'Edit question' : 'Add questions'"
    :state="state"
    :validate="validate"
    :loading="loading || pasting"
    :save-label="saveLabel"
    @submit="submit"
  >
    <UTabs
      v-if="!question"
      v-model="mode"
      :items="tabs"
      :content="false"
      class="mb-4"
      data-testid="question-mode"
    />
    <div v-if="mode === 'paste' && !question" class="space-y-4">
      <UFormField
        label="Questions, one per line"
        name="paste"
        help="In form order; they can’t be reordered later. Limits go at the end, e.g. “Why us? (500)”."
      >
        <UTextarea
          v-model="state.paste"
          :rows="8"
          :maxrows="16"
          autoresize
          :disabled="pasting"
          placeholder="Why do you want to work here? (500)&#10;Describe a project you’re proud of."
          class="w-full"
          data-testid="question-paste"
        />
      </UFormField>
      <UAlert
        v-if="pasteError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="pasteError"
        data-testid="question-paste-error"
      />
      <ol v-if="pasted.length" class="space-y-2 text-sm" data-testid="question-paste-preview">
        <li
          v-for="(l, i) in pasted"
          :key="i"
          class="flex items-start gap-2"
          :class="{ 'text-error': l.error || l.overflow }"
        >
          <span class="w-6 shrink-0 text-right text-muted">{{ i + 1 }}.</span>
          <span class="min-w-0 flex-1 break-words">
            {{ l.question || `(${l.charLimit})` }}
            <span v-if="l.error" class="block text-xs">{{ l.error }}</span>
            <span v-else-if="l.overflow" class="block text-xs"
              >Only {{ left }} more fit (max {{ QUESTIONS_PER_LISTING }})</span
            >
          </span>
          <UBadge v-if="l.charLimit" color="neutral" variant="subtle" class="shrink-0"
            >Limit {{ l.charLimit }}</UBadge
          >
        </li>
      </ol>
    </div>
    <div v-else class="space-y-4">
      <UFormField
        label="Question"
        name="question"
        required
        :hint="`${state.question.length} / ${QUESTION_MAX}`"
      >
        <UTextarea
          ref="questionInput"
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
      <UCheckbox
        v-if="!question && left > 1"
        v-model="addAnother"
        label="Add another after saving"
        data-testid="question-add-another"
      />
    </div>
  </AppFormModal>
</template>
