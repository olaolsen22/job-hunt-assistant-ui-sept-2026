<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'

// The application form's free-text questions for this listing, numbered in form order, with their
// answers and how many are done. One AI run drafts every answer; each question is edited on its own.
const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

const DELETE_QUESTION = graphql(`
  mutation DeleteApplicationQuestion($input: DeleteApplicationQuestionInput!) {
    deleteApplicationQuestion(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

type Question = ListingDetail['applicationQuestions'][number]

const questions = computed(() => listing.applicationQuestions)
const full = computed(() => questions.value.length >= QUESTIONS_PER_LISTING)

const overBy = (q: Question) =>
  isOverLimit(q.answer ?? '', q.charLimit)
    ? (q.answer ?? '').length - (q.charLimit ?? ANSWER_MAX)
    : 0
const answered = computed(() => questions.value.filter((q) => q.answer?.trim()).length)
const overCount = computed(() => questions.value.filter((q) => overBy(q)).length)

const selected = ref<Question | null>(null)
const formOpen = ref(false)
const openForm = (question: Question | null) => {
  selected.value = question
  wasEmpty.value = !questions.value.length
  formOpen.value = true
}

const aiOpen = ref(false)

// The owner reads each answer and pastes it into the form, so answers show in full; only very long
// ones are cut short with a toggle. Copy always takes the whole answer.
const LONG_ANSWER = 1200
const expanded = ref(new Set<number>())
const toggleExpanded = (id: number) => {
  const next = new Set(expanded.value)
  if (!next.delete(id)) next.add(id)
  expanded.value = next
}
const clamped = (q: Question) => (q.answer?.length ?? 0) > LONG_ANSWER && !expanded.value.has(q.id)

const { copy, copiedKey: copiedId } = useCopyAsText('answer')
const copyAnswer = (q: Question) => copy(q.answer ?? '', q.id)

// Focus moves with the scroll, so the next Tab continues from that question.
const scrollToFirstOver = () => {
  const first = questions.value.find((q) => overBy(q))
  const row = first && document.getElementById(`question-${first.id}`)
  if (!row) return
  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  row.focus({ preventScroll: true })
}

// The first questions on a listing: point at the next step, drafting all answers at once.
const toast = useAppToast()
// Recorded on open: by the time the modal reports, the list may already have refetched.
const wasEmpty = ref(false)
const onAdded = (count: number) => {
  if (!wasEmpty.value) return
  toast.success(count === 1 ? 'Question added' : `${count} questions added`, {
    action: { label: 'Draft answers with AI', onClick: () => (aiOpen.value = true) }
  })
}

const deleteOpen = ref(false)
// Kept, not looked up: after the delete the list is replaced while the confirm is still closing.
const selectedNumber = ref(0)
const confirmDelete = (question: Question, n: number) => {
  selected.value = question
  selectedNumber.value = n
  deleteOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))
const remove = async () => {
  const ok = await run(async () => {
    const { deleteApplicationQuestion } = await gql(DELETE_QUESTION, {
      input: { id: selected.value!.id }
    })
    return deleteApplicationQuestion.errors
  })
  deleteOpen.value = false
  if (ok) emit('changed')
}
</script>

<template>
  <AppCard title="Application questions" data-testid="questions-card">
    <template v-if="questions.length" #actions>
      <span v-if="questions.length >= 18" class="text-sm text-muted" data-testid="questions-count">
        {{ questions.length }} / {{ QUESTIONS_PER_LISTING }}
        <template v-if="full">· Limit reached</template>
      </span>
      <UButton
        size="sm"
        color="neutral"
        variant="subtle"
        icon="i-lucide-plus"
        :disabled="full"
        data-testid="question-add"
        @click="openForm(null)"
        >Add questions</UButton
      >
    </template>

    <div
      v-if="!questions.length"
      class="flex flex-col items-center gap-4 py-4 text-center"
      data-testid="questions-empty"
    >
      <UIcon name="i-lucide-message-square-text" class="size-8 text-muted" />
      <ol class="space-y-1 text-left text-sm text-muted" data-testid="questions-steps">
        <li>1. Add the form’s free-text questions, in the order they appear.</li>
        <li>2. Draft all answers with one AI run, then review and save them.</li>
      </ol>
      <div class="flex flex-col items-center gap-1">
        <div class="flex flex-col items-center gap-2 sm:flex-row">
          <UButton icon="i-lucide-list-plus" data-testid="question-add" @click="openForm(null)"
            >Add questions</UButton
          >
          <UButton
            icon="i-lucide-sparkles"
            color="neutral"
            variant="ghost"
            disabled
            data-testid="questions-ai-disabled"
            >Draft answers with AI</UButton
          >
        </div>
        <p class="text-xs text-muted">Drafting needs at least one question.</p>
      </div>
    </div>

    <template v-else>
      <div class="mb-4 space-y-2">
        <div
          class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        >
          <p class="flex items-center gap-1 text-sm text-muted" data-testid="questions-summary">
            {{ answered }} of {{ questions.length }} answered
            <template v-if="overCount">
              ·
              <UButton
                variant="link"
                color="error"
                class="p-0 text-sm"
                data-testid="questions-over-link"
                @click="scrollToFirstOver"
                >{{ overCount }} over {{ overCount === 1 ? 'its' : 'their' }} limit</UButton
              >
            </template>
          </p>
          <UButton
            icon="i-lucide-sparkles"
            color="neutral"
            variant="subtle"
            class="max-sm:w-full max-sm:justify-center"
            data-testid="questions-ai-open"
            @click="aiOpen = true"
            >Draft answers with AI</UButton
          >
        </div>
        <p class="text-sm text-muted" data-testid="questions-order-hint">
          Add questions in the order the form asks them. They can’t be reordered later.
        </p>
      </div>

      <ul class="divide-y divide-default">
        <li
          v-for="(q, i) in questions"
          :id="`question-${q.id}`"
          :key="q.id"
          tabindex="-1"
          class="space-y-1 py-3 first:pt-0 last:pb-0"
          data-testid="question-row"
        >
          <p class="max-w-3xl font-medium break-words text-highlighted">
            {{ i + 1 }}. {{ q.question }}
          </p>
          <template v-if="q.answer">
            <p
              :id="`answer-${q.id}`"
              class="max-w-3xl text-sm break-words whitespace-pre-line"
              :class="{ 'line-clamp-6': clamped(q) }"
              data-testid="question-answer"
            >
              {{ q.answer }}
            </p>
          </template>
          <p v-else class="text-sm text-muted">No answer yet</p>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p
              class="flex flex-wrap items-center gap-x-3 text-xs text-muted"
              data-testid="question-meta"
            >
              <!-- Each item stays whole, so a narrow row wraps between items, not mid-item. -->
              <UButton
                v-if="q.answer && q.answer.length > LONG_ANSWER"
                variant="link"
                class="px-0 py-2 text-xs"
                :aria-expanded="!clamped(q)"
                :aria-controls="`answer-${q.id}`"
                data-testid="question-answer-toggle"
                @click="toggleExpanded(q.id)"
                >{{ clamped(q) ? 'Show full answer' : 'Show less' }}</UButton
              >
              <template v-if="q.answer">
                <span
                  class="flex items-center gap-1 whitespace-nowrap"
                  :class="{ 'text-error': overBy(q) }"
                >
                  <UIcon v-if="overBy(q)" name="i-lucide-circle-alert" class="size-3.5 shrink-0" />
                  {{ q.answer.length }}<template v-if="q.charLimit"> / {{ q.charLimit }}</template>
                  characters
                </span>
                <span v-if="overBy(q)" class="whitespace-nowrap text-error"
                  >{{ overBy(q) }} over</span
                >
              </template>
              <span v-else-if="q.charLimit" class="whitespace-nowrap">Limit {{ q.charLimit }}</span>
              <span
                v-if="q.notes"
                class="flex items-center gap-1 whitespace-nowrap"
                data-testid="question-notes"
              >
                <UIcon name="i-lucide-sticky-note" class="size-3.5 shrink-0" /> Notes for the AI
              </span>
            </p>
            <div class="flex shrink-0 items-center gap-1 max-sm:w-full">
              <!-- Over the limit still copies: the owner may trim it in the form itself. -->
              <UButton
                v-if="q.answer"
                color="neutral"
                variant="subtle"
                :icon="copiedId === q.id ? 'i-lucide-check' : 'i-lucide-copy'"
                :aria-label="copiedId === q.id ? `Answer ${i + 1} copied` : `Copy answer ${i + 1}`"
                data-testid="question-copy"
                @click="copyAnswer(q)"
                >{{ copiedId === q.id ? 'Copied' : 'Copy' }}</UButton
              >
              <UButton
                v-else
                color="neutral"
                variant="subtle"
                icon="i-lucide-pen-line"
                data-testid="question-add-answer"
                @click="openForm(q)"
                >Write answer</UButton
              >
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                class="max-sm:ml-auto"
                :aria-label="`Edit question ${i + 1}`"
                @click="openForm(q)"
              />
              <UButton
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                :aria-label="`Delete question ${i + 1}`"
                @click="confirmDelete(q, i + 1)"
              />
            </div>
          </div>
        </li>
      </ul>
    </template>
  </AppCard>

  <ListingsQuestionModal
    v-model:open="formOpen"
    :listing-id="listing.id"
    :question="selected"
    :remaining="QUESTIONS_PER_LISTING - questions.length"
    @changed="emit('changed')"
    @added="onAdded"
  />

  <ListingsAnswersAiModal
    v-if="questions.length"
    v-model:open="aiOpen"
    :listing-id="listing.id"
    :questions="questions"
    @changed="emit('changed')"
  />

  <AppConfirmModal
    v-model:open="deleteOpen"
    :title="`Delete question ${selectedNumber}?`"
    description="Its answer and notes are deleted too."
    confirm-label="Delete"
    color="error"
    :loading="loading"
    @confirm="remove"
  />
</template>
