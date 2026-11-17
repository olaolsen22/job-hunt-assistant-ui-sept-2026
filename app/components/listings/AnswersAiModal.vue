<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { ListingDetail } from '~/composables/useListing'
import type { AnswerCandidate } from '~/composables/useApplicationAnswersAi'
import type { AnswerRow } from '~/composables/useAnswerReview'

// Drafts every answer on the listing in one AI run, then reviews them: each question's saved answer
// next to an editable draft, ticked when it fits. Only ticked drafts are saved; an unticked question
// keeps its answer. Drafts live only here, so closing or reloading with unsaved ones asks first.
const { listingId, questions } = defineProps<{
  listingId: number
  questions: ListingDetail['applicationQuestions']
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ai = useApplicationAnswersAi(() => listingId)
const review = useAnswerReview(() => questions)
const { rows, included, pending } = review
const toast = useAppToast()

const json = ref('')
// Set after a save where some answers failed; the toast would cover the footer's Save.
const partial = ref('')
const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => {
    json.value = ''
    partial.value = ''
    review.clear()
    // Fetched on every open: the prompt holds the saved answers and notes, which change.
    ai.loadPrompt()
  }
})
watch(json, () => (error.value = ''))

const count = computed(() => questions.length)
const busy = computed(() => ai.generating.value || ai.previewing.value || review.saving.value)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const startReview = (candidates: AnswerCandidate[]) => {
  partial.value = ''
  review.start(candidates)
}
const submit = async () => {
  const builtin = tab.value === 'builtin'
  const outcome = builtin ? await ai.generate() : await ai.preview(json.value)
  if (builtin) refreshUsage()
  if (outcome.error !== undefined) {
    error.value = outcome.error
    errorCode.value = outcome.code
    return
  }
  method.value = tab.value
  startReview(outcome.value)
}
const retry = () => {
  ai.confirmRetry()
  void submit()
}

// Every run costs an AI call, so unsaved drafts are confirmed away even when nothing was edited.
const confirmOpen = ref(false)
let afterConfirm: () => void = () => {}
const close = () => {
  review.clear()
  open.value = false
}
const ask = (then: () => void) => {
  if (!pending.value) return then()
  afterConfirm = then
  confirmOpen.value = true
}
const requestClose = () => ask(close)
const back = () =>
  ask(() => {
    partial.value = ''
    review.clear()
  })
const confirmDiscard = () => {
  confirmOpen.value = false
  afterConfirm()
}

// A reload mid-run loses a paid result too; the layout's AI guard only covers in-app navigation.
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (!open.value || (!pending.value && !ai.generating.value)) return
  event.preventDefault()
})

const save = async () => {
  const result = await review.save()
  if (!result) return
  if (result.saved || result.stale) emit('changed')
  if (!result.failed) {
    toast.success(`${plural(result.saved, 'answer')} saved`)
    // Unticked drafts are kept answers by choice, so the review is done.
    close()
    return
  }
  partial.value = `${result.saved} saved. ${plural(result.failed, 'answer')} couldn’t be saved. Fix ${result.failed === 1 ? 'it' : 'them'} below and save again.`
}

const label = (row: AnswerRow) => `${review.numberOf(row)}. ${review.question(row)?.question}`
// Names the questions that won't be saved because they don't fit, instead of a bare count.
const overNote = computed(() => {
  const over = review.overRows.value
  if (!over.length) return ''
  if (over.length === 1) {
    const n = review.numberOf(over[0]!)
    return over[0]!.include
      ? `Question ${n} is over its limit`
      : `Question ${n} is over its limit and won’t be saved`
  }
  return `${over.length} questions are over their limit`
})
const limitLabel = (row: AnswerRow) => {
  const limit = review.limitOf(row)
  return limit ? `Limit ${limit}` : 'No limit'
}
const rowError = (row: AnswerRow) => {
  const over = review.overBy(row)
  if (over) return `${over} over the limit. Trim it and it will be included.`
  if (row.include && !row.text.trim()) return 'Empty. Write an answer or untick it.'
  return row.error
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Draft answers with AI"
    :description="
      rows
        ? 'Review each draft. Nothing is saved until you save.'
        : `Drafts all ${plural(count, 'question')} in one go. Nothing is saved until you choose.`
    "
    :busy="busy"
    :close="requestClose"
    :wide="!!rows"
  >
    <fieldset :disabled="busy" class="min-w-0 space-y-4">
      <template v-if="rows">
        <AppAiReviewSelectAll
          :selected="included.length"
          :total="review.selectable.value"
          @all="review.setAll(true)"
          @none="review.setAll(false)"
        />
        <p class="text-sm text-muted">
          Saving replaces that question’s answer. Untick a question to keep its current one.
        </p>
        <ul class="space-y-3">
          <AppAiReviewRow
            v-for="row in rows"
            :key="row.id"
            :include="row.saved || row.missing ? undefined : row.include"
            :label="label(row)"
            :description="row.saved || row.missing ? undefined : limitLabel(row)"
            :badge="row.saved ? 'Saved' : 'No draft'"
            :disabled="!row.include && !review.fits(row)"
            :invalid="!row.saved && !row.missing && !!rowError(row)"
            :current="review.question(row)?.answer"
            :current-label="row.saved ? 'Previous answer' : 'Saved answer'"
            suggested-label="Draft"
            testid-prefix="answers-ai"
            @update:include="review.toggle(row, !!$event)"
          >
            <template #suggested>
              <p
                v-if="row.missing"
                class="text-sm text-muted italic"
                data-testid="answers-ai-missing"
              >
                The AI didn’t return an answer for this question. Your saved answer stays.
              </p>
              <p
                v-else-if="row.saved"
                class="text-sm break-words whitespace-pre-line text-highlighted"
                data-testid="answers-ai-saved"
              >
                {{ row.text }}
              </p>
              <UFormField v-else :error="rowError(row)">
                <UTextarea
                  v-model="row.text"
                  :rows="4"
                  :maxrows="10"
                  autoresize
                  class="w-full"
                  :aria-label="`Draft answer for question ${review.numberOf(row)}`"
                  data-testid="answers-ai-candidate"
                />
                <!-- Below the field, not as a hint: the field has no label row to hold one, and the
                     count must stay visible while an error shows. -->
                <p class="mt-1 text-xs text-muted" data-testid="answers-ai-count">
                  {{ review.lengthOf(row) }} / {{ review.limitOf(row) ?? ANSWER_MAX }}
                  <template v-if="row.aiOverLimit && review.overBy(row)">
                    · The AI couldn’t get under the limit.</template
                  >
                </p>
                <template v-if="row.error" #error>
                  <span data-testid="answers-ai-row-error">{{ rowError(row) }}</span>
                </template>
              </UFormField>
            </template>
          </AppAiReviewRow>
        </ul>
      </template>

      <template v-else>
        <AppAiMethodTabs v-model="tab" :disabled="busy" />
        <template v-if="tab === 'builtin'">
          <p class="text-sm text-muted">
            Writes every answer together so they don’t repeat each other. Saved answers are revised
            in your voice, empty ones written from scratch, using each question’s limit and notes,
            the listing and your profile.
          </p>
          <AppAiCostNotice :usage="usage" />
          <p v-if="ai.generating.value" class="text-sm text-muted" data-testid="answers-ai-busy">
            Drafting {{ plural(count, 'answer') }}. This can take a minute.
          </p>
          <AppAiRetryConfirm
            v-if="ai.needsConfirm.value"
            :message="ai.safetyMessage.value"
            :loading="ai.generating.value"
            @retry="retry"
          />
          <AppAiErrorAlert
            v-else-if="error"
            :title="error"
            :code="errorCode"
            data-testid="answers-ai-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="json"
          :ai="ai"
          :note="`It holds all ${plural(count, 'question')} with their saved answers and notes, the listing and your profile. Copy it again after changing a question.`"
          :reply-error="error"
          testid-prefix="answers-ai"
        />
      </template>
    </fieldset>

    <template v-if="review.saveError.value || partial" #footer-top>
      <AppAiErrorAlert
        :title="review.saveError.value || partial"
        data-testid="answers-ai-save-error"
      />
    </template>

    <template v-if="rows" #back>
      <UButton color="neutral" variant="subtle" :disabled="busy" @click="back">Back</UButton>
    </template>
    <template v-if="rows && overNote" #footer-info>
      <p class="text-sm text-error" data-testid="answers-ai-over-note">{{ overNote }}</p>
    </template>

    <template #actions>
      <UButton
        v-if="rows"
        :loading="review.saving.value"
        :disabled="!review.canSave.value"
        data-testid="answers-ai-save"
        @click="save"
        >Save {{ plural(included.length, 'answer') }}</UButton
      >
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="ai.needsConfirm.value"
        data-testid="answers-ai-run"
        @click="submit"
        >Draft {{ plural(count, 'answer') }}</UButton
      >
      <UButton
        v-else
        :loading="busy"
        :disabled="!json.trim()"
        data-testid="answers-ai-preview"
        @click="submit"
        >Preview answers</UButton
      >
    </template>
  </AppAiModal>

  <AppConfirmModal
    v-model:open="confirmOpen"
    title="Discard the drafted answers?"
    description="Answers you haven’t saved are lost. Running the AI again drafts new ones."
    confirm-label="Discard"
    @confirm="confirmDiscard"
  />
</template>
