<script setup lang="ts">
import type { useRequirementMap } from '~/composables/useRequirementMap'
const { editor } = defineProps<{ editor: ReturnType<typeof useRequirementMap> }>()
const open = defineModel<boolean>('open', { required: true })
const reply = ref('')
const replacing = ref(false)
const { method, tab, error, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => {
    editor.reset()
    void editor.loadPrompt()
  }
})
const busy = computed(() => editor.generating.value || editor.previewing.value)
watch(reply, () => (error.value = ''))
const submit = async () => {
  replacing.value = false
  const builtin = tab.value === 'builtin'
  const outcome = builtin ? await editor.generate() : await editor.preview(reply.value)
  if (builtin) void refreshUsage()
  error.value = outcome.error ?? ''
  if (outcome.error !== undefined) return
  editor.loadCandidate(outcome.value)
  method.value = tab.value
  open.value = false
}
const request = () => {
  if (editor.dirty.value) replacing.value = true
  else void submit()
}
const retry = () => {
  editor.confirmRetry()
  request()
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Map requirements with AI"
    description="Review and edit the candidate before saving. Nothing is saved by this dialog."
    :busy="busy"
  >
    <AppAiMethodTabs v-model="tab" :disabled="busy" />
    <template v-if="tab === 'builtin'">
      <p class="text-sm text-muted">
        Uses this listing and your profile to identify requirements, evidence and gaps.
      </p>
      <AppAiCostNotice :usage="usage" />
      <AppAiRetryConfirm
        v-if="editor.needsConfirm.value"
        :message="editor.safetyMessage.value"
        :loading="editor.generating.value"
        @retry="retry"
      />
      <AppAiErrorAlert
        v-else-if="error"
        :title="error"
        :code="editor.safetyCode.value"
        data-testid="requirement-map-ai-error"
      />
    </template>
    <AppAiOwnSteps
      v-else
      v-model:reply="reply"
      :ai="editor"
      note="The prompt holds the listing and your profile. Copy it again when either changes."
      reply-help="Paste the JSON object without code fences; it must include schemaVersion: 1."
      :reply-error="error"
      testid-prefix="requirement-map"
    />
    <template #actions>
      <UButton
        :loading="busy"
        :disabled="tab === 'builtin' ? editor.needsConfirm.value : !reply.trim()"
        data-testid="requirement-map-run"
        @click="request"
        >{{ tab === 'builtin' ? 'Generate candidate' : 'Review reply' }}</UButton
      >
    </template>
  </AppAiModal>
  <AppConfirmModal
    v-model:open="replacing"
    title="Replace unsaved requirements?"
    description="The new candidate replaces your edits. Discard can restore them until you save. A built-in run may be charged."
    confirm-label="Continue"
    @confirm="submit"
  />
</template>
