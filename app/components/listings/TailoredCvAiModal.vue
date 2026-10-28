<script setup lang="ts">
import type { useTailoredCvDraft } from '~/composables/useTailoredCvDraft'
import type { TailoredCvSectionKey } from '~/utils/tailoredCv'

// Built-in or your own AI for the whole CV (no `scope`) or one section. Nothing runs until the
// owner picks: built-in shows today's usage and the request count first; your own AI is copy,
// paste, preview. The editor's state comes in whole, since this drives its analysis and preview.
// Built-in runs on the page (live progress and suggestions); the page reopens this modal when the
// API's safeguards stop a run, so the retry confirm and limit link sit where the run started.
const {
  ai,
  scope = undefined,
  scopeLabel
} = defineProps<{
  ai: ReturnType<typeof useTailoredCvDraft>
  scope?: TailoredCvSectionKey
  scopeLabel: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ analyze: [] }>()

const json = ref('')
const { method, tab, error, usage } = useAiModalState(open, {
  onOpen: () => {
    json.value = ''
    if (!ai.instructions.value) ai.loadPrompt()
  }
})
watch(json, () => (error.value = ''))

const requests = computed(() => ai.requestCount(scope))

// The page runs it, so the overlay and per-section errors live there; this just closes.
const analyze = () => {
  method.value = 'builtin'
  open.value = false
  emit('analyze')
}
// The owner accepted that the repeat may be charged again.
const retry = () => {
  ai.confirmRetry()
  analyze()
}

const preview = async () => {
  error.value = (await ai.preview(json.value, scope)) ?? ''
  if (error.value) return
  method.value = 'own'
  open.value = false
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    :title="`Tailor ${scopeLabel} with AI`"
    description="Results show in the editor for review. Nothing saves until you save the draft."
    :busy="ai.previewing.value"
  >
    <AppAiMethodTabs v-model="tab" :disabled="ai.previewing.value" />
    <template v-if="tab === 'builtin'">
      <p class="text-sm text-muted" data-testid="tailored-cv-ai-requests">
        Makes {{ requests }} AI {{ requests === 1 ? 'request' : 'requests' }}.
      </p>
      <AppAiCostNotice :usage="usage" data-testid="tailored-cv-ai-usage" />
      <AppAiRetryConfirm
        v-if="ai.needsConfirm.value"
        :message="ai.safetyMessage.value"
        @retry="retry"
      />
      <AppAiErrorAlert
        v-else-if="ai.safetyCode.value"
        :title="ai.safetyMessage.value"
        :code="ai.safetyCode.value"
        data-testid="tailored-cv-ai-error"
      />
    </template>
    <AppAiOwnSteps
      v-else
      v-model:reply="json"
      :ai="ai"
      :note="`It holds the listing and your profile, without contact details.${scope ? ` Only ${scopeLabel} is taken from the reply.` : ''}`"
      :reply-error="error"
      testid-prefix="tailored-cv"
    />

    <template #actions>
      <UButton
        v-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :disabled="ai.needsConfirm.value"
        data-testid="tailored-cv-ai-run"
        @click="analyze"
        >Tailor</UButton
      >
      <UButton
        v-else
        :loading="ai.previewing.value"
        :disabled="!json.trim()"
        data-testid="tailored-cv-preview"
        @click="preview"
        >Preview changes</UButton
      >
    </template>
  </AppAiModal>
</template>
