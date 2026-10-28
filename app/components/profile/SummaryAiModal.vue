<script setup lang="ts">
import { INVALID_DRAFT_JSON } from '~/utils/parseDraft'

// Opened from the summary form. An empty field takes the AI's summary straight away; existing text
// is compared first, so nothing is overwritten until the owner picks the suggestion. Nothing is
// saved here: the summary form's Save does that.
const { current } = defineProps<{ current: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ use: [summary: string] }>()

const api = useProfileSummary()
const { busy, needsConfirm, safetyMessage } = api

const reply = ref('')
const suggestion = ref<string>()
const tooLittle = ref(false)

const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => {
    suggestion.value = undefined
    tooLittle.value = false
    reply.value = ''
    api.loadPrompt()
  }
})
watch([reply, tab], () => {
  error.value = ''
  tooLittle.value = false
})

const receive = (summary: string | null) => {
  if (!summary) {
    tooLittle.value = true
    return
  }
  if (current.trim()) suggestion.value = summary
  else use(summary)
}
const suggest = async () => {
  error.value = ''
  tooLittle.value = false
  const result = await api.suggest()
  refreshUsage()
  if (result.error !== undefined) {
    error.value = result.error
    errorCode.value = result.code
    return
  }
  method.value = 'builtin'
  receive(result.value)
}
const retryConfirmed = () => {
  api.confirmRetry()
  suggest()
}
const preview = () => {
  const summary = parseSummaryReply(reply.value)
  if (summary === undefined) {
    error.value = `${INVALID_DRAFT_JSON} Expect a "summary" text.`
    return
  }
  method.value = 'own'
  receive(summary)
}
const use = (summary: string) => {
  emit('use', summary)
  open.value = false
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Write your summary with AI"
    :description="
      suggestion
        ? 'Nothing changes until you use it and save.'
        : 'Write a short summary from your profile.'
    "
    :busy="busy"
  >
    <fieldset :disabled="busy" class="min-w-0 space-y-4">
      <AppCompareBlock
        v-if="suggestion"
        :current="current"
        :suggested="suggestion"
        data-testid="summary-ai-compare"
      />

      <template v-else>
        <AppAiMethodTabs v-model="tab" :disabled="busy" />
        <UAlert
          v-if="tooLittle"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Your profile doesn’t have enough content for a summary yet."
          description="Add experience, skills or a headline, then try again."
          data-testid="summary-ai-too-little"
        />
        <template v-if="tab === 'builtin'">
          <p class="text-sm text-muted">
            The AI reads your profile and writes a short summary in its language. You can edit it
            before saving.
          </p>
          <AppAiCostNotice :usage="usage" data-testid="summary-ai-cost-notice" />
          <AppAiRetryConfirm
            v-if="needsConfirm"
            :message="safetyMessage"
            :loading="busy"
            @retry="retryConfirmed"
          />
          <AppAiErrorAlert
            v-else-if="error"
            :title="error"
            :code="errorCode"
            data-testid="summary-ai-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="reply"
          :ai="api"
          :reply-error="error"
          testid-prefix="summary-ai"
        />
      </template>
    </fieldset>

    <template v-if="suggestion" #back>
      <UButton color="neutral" variant="subtle" @click="suggestion = undefined">Back</UButton>
    </template>

    <template #actions>
      <UButton v-if="suggestion" data-testid="summary-ai-use" @click="use(suggestion)"
        >Use in summary</UButton
      >
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="busy || needsConfirm"
        data-testid="summary-ai-suggest"
        @click="suggest"
        >Write summary</UButton
      >
      <!-- An empty field takes the reply straight away; existing text is compared first. -->
      <UButton v-else :disabled="!reply.trim()" data-testid="summary-ai-preview" @click="preview">{{
        current.trim() ? 'Preview summary' : 'Fill summary'
      }}</UButton>
    </template>
  </AppAiModal>
</template>
