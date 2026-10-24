<script setup lang="ts">
import type { AnswerCandidate } from '~/composables/useApplicationAnswerAi'

// A candidate answer for a saved question from built-in AI or your own. Nothing is saved: "Use
// answer" hands the (editable) text to the edit form, whose Save is the only write.
const { questionId, charLimit, currentAnswer } = defineProps<{
  questionId: number
  charLimit: number | null
  currentAnswer: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ use: [answer: string] }>()

const ai = useApplicationAnswerAi(() => questionId)
const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const json = ref('')
const candidate = ref<AnswerCandidate>()
const draft = ref('')
const { method, tab, error } = useAiModalState(open, {
  onOpen: () => {
    json.value = ''
    candidate.value = undefined
    draft.value = ''
    refreshUsage()
    if (!ai.instructions.value) ai.loadPrompt()
  }
})
watch(json, () => (error.value = ''))

const busy = computed(() => ai.generating.value || ai.previewing.value)
const over = computed(() => isOverLimit(draft.value, charLimit))
const limit = computed(() => charLimit ?? ANSWER_MAX)

const submit = async () => {
  const builtin = tab.value === 'builtin'
  const outcome = builtin ? await ai.generate() : await ai.preview(json.value)
  if (builtin) refreshUsage()
  error.value = outcome.error ?? ''
  if (!outcome.candidate) return
  method.value = tab.value
  candidate.value = outcome.candidate
  draft.value = outcome.candidate.answer
}
const retry = () => {
  ai.confirmRetry()
  void submit()
}

const use = () => {
  emit('use', draft.value)
  open.value = false
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Draft the answer with AI"
    description="Nothing is saved until you save the question."
    :busy="busy"
    :wide="!!candidate && !!currentAnswer"
  >
    <template v-if="candidate">
      <UAlert
        v-if="candidate.overLimit"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The AI couldn't get under the limit, even after retrying. Trim it to use it."
        data-testid="question-ai-over-limit"
      />
      <!-- Stacked, the candidate you edit comes first; side by side, it reads current → candidate. -->
      <div class="grid gap-4" :class="{ 'lg:grid-cols-2': currentAnswer }">
        <div
          v-if="currentAnswer"
          class="order-2 space-y-1 lg:order-1"
          data-testid="question-ai-current"
        >
          <p class="text-sm font-medium text-highlighted">Current answer</p>
          <p class="rounded-md bg-elevated/50 p-2 text-sm break-words whitespace-pre-wrap">
            {{ currentAnswer }}
          </p>
        </div>
        <UFormField
          label="Candidate answer"
          class="order-1 lg:order-2"
          :hint="`${draft.length} / ${limit}`"
          :error="over ? `${draft.length - limit} over the limit. Trim it to use it.` : undefined"
        >
          <UTextarea
            v-model="draft"
            :rows="8"
            :maxrows="16"
            autoresize
            class="w-full"
            data-testid="question-ai-candidate"
          />
        </UFormField>
      </div>
      <p class="text-sm text-muted">
        {{ currentAnswer ? 'Replaces your current answer. ' : '' }}Fills the Answer field. Save the
        question to keep it.
      </p>
    </template>

    <template v-else>
      <AppAiMethodTabs v-model="tab" :disabled="busy" />
      <template v-if="tab === 'builtin'">
        <p class="text-sm text-muted">
          Revises your saved answer in your voice, or writes one from scratch if it’s empty. Uses
          the question, limit and notes, your profile and your other saved answers. Save each answer
          before drafting the next.
        </p>
        <AppAiCostNotice :usage="usageData?.llmUsageToday" />
        <AppAiRetryConfirm
          v-if="ai.needsConfirm.value"
          :message="ai.safetyMessage.value"
          :loading="ai.generating.value"
          @retry="retry"
        />
        <AppAiErrorAlert
          v-else-if="error"
          :title="error"
          :code="ai.safetyCode.value"
          data-testid="question-ai-error"
        />
      </template>
      <AppAiOwnSteps
        v-else
        v-model:reply="json"
        :ai="ai"
        note="It holds the saved question, answer and notes, the listing and your profile. Copy it again if a reply says the prompt is out of date."
        :reply-error="error"
        testid-prefix="question-ai"
      />
    </template>

    <template v-if="candidate" #back>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        @click="candidate = undefined"
        >Try again</UButton
      >
    </template>
    <template #actions>
      <UButton
        v-if="candidate"
        :disabled="over || !draft.trim()"
        data-testid="question-ai-use"
        @click="use"
        >Use in answer</UButton
      >
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="ai.needsConfirm.value"
        data-testid="question-ai-run"
        @click="submit"
        >Generate</UButton
      >
      <UButton
        v-else
        :loading="busy"
        :disabled="!json.trim()"
        data-testid="question-ai-preview"
        @click="submit"
        >Preview answer</UButton
      >
    </template>
  </AppAiModal>
</template>
