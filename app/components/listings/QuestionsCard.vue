<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'

// The application form's free-text questions for this listing, with their answers. Answers are
// edited and drafted in the question's edit form, one question at a time.
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

const selected = ref<Question | null>(null)
const formOpen = ref(false)
const openForm = (question: Question | null) => {
  selected.value = question
  formOpen.value = true
}

const deleteOpen = ref(false)
const confirmDelete = (question: Question) => {
  selected.value = question
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
    <template #actions>
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
        >Add question</UButton
      >
    </template>

    <div
      v-if="!questions.length"
      class="flex flex-col items-center gap-2 py-4 text-center text-muted"
      data-testid="questions-empty"
    >
      <UIcon name="i-lucide-message-square-text" class="size-8" />
      <p class="text-sm">No questions yet</p>
    </div>

    <ul v-else class="divide-y divide-default">
      <li
        v-for="q in questions"
        :key="q.id"
        class="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
        data-testid="question-row"
      >
        <div class="min-w-0 space-y-1">
          <p class="font-medium break-words text-highlighted">{{ q.question }}</p>
          <p v-if="q.answer" class="line-clamp-2 text-sm break-words whitespace-pre-line">
            {{ q.answer }}
          </p>
          <p v-else class="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            No answer yet
            <UButton
              variant="link"
              size="sm"
              class="p-0"
              data-testid="question-add-answer"
              @click="openForm(q)"
              >Add answer</UButton
            >
          </p>
          <p
            v-if="q.answer || q.charLimit"
            class="flex items-center gap-1 text-xs"
            :class="overBy(q) ? 'text-error' : 'text-muted'"
          >
            <UIcon v-if="overBy(q)" name="i-lucide-circle-alert" class="size-3.5 shrink-0" />
            {{ (q.answer ?? '').length
            }}<template v-if="q.charLimit"> / {{ q.charLimit }}</template> characters<template
              v-if="overBy(q)"
            >
              · {{ overBy(q) }} over</template
            >
          </p>
        </div>
        <div class="flex shrink-0 gap-1">
          <UButton
            size="lg"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pencil"
            aria-label="Edit question"
            @click="openForm(q)"
          />
          <UButton
            size="lg"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            aria-label="Delete question"
            @click="confirmDelete(q)"
          />
        </div>
      </li>
    </ul>
  </AppCard>

  <ListingsQuestionModal
    v-model:open="formOpen"
    :listing-id="listing.id"
    :question="selected"
    @changed="emit('changed')"
  />

  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete question?"
    description="Its answer and notes are deleted too."
    confirm-label="Delete"
    color="error"
    :loading="loading"
    @confirm="remove"
  />
</template>
