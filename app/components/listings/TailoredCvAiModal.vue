<script setup lang="ts">
import type { useTailoredCvDraft } from '~/composables/useTailoredCvDraft'
import type { TailoredCvSectionKey } from '~/utils/tailoredCv'

// Built-in or external AI for the whole CV (no `scope`) or one section. Nothing runs until the
// owner picks: built-in shows today's usage and the request count first; external is copy, paste,
// preview. The editor's state comes in whole, since this drives its analysis and preview.
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

const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const tab = ref<'builtin' | 'external'>('builtin')
const json = ref('')
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  tab.value = 'builtin'
  json.value = error.value = ''
  refreshUsage()
  if (!ai.instructions.value) ai.loadPrompt()
})

const requests = computed(() => ai.requestCount(scope))

// The page runs it, so the overlay and per-section errors live there; this just closes.
const analyze = () => {
  open.value = false
  emit('analyze')
}

const preview = async () => {
  error.value = (await ai.preview(json.value, scope)) ?? ''
  if (!error.value) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Optimize ${scopeLabel} with AI`"
    description="Results show in the editor for review. Nothing saves until you save the draft."
    :dismissible="!ai.previewing.value"
  >
    <template #body>
      <div class="space-y-4">
        <UTabs
          v-model="tab"
          :items="[
            { label: 'Built-in AI', value: 'builtin', icon: 'i-lucide-sparkles' },
            { label: 'External AI', value: 'external', icon: 'i-lucide-bot' }
          ]"
          :content="false"
          class="w-full"
        />
        <template v-if="tab === 'builtin'">
          <AppAiCostNotice :usage="usageData?.llmUsageToday" data-testid="tailored-cv-ai-usage" />
          <p class="text-sm text-muted" data-testid="tailored-cv-ai-requests">
            Makes {{ requests }} AI {{ requests === 1 ? 'request' : 'requests' }}.
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">
            1. Copy the prompt and run it in your chosen AI. It holds the listing and your profile,
            without contact details.
            <template v-if="scope">Only {{ scopeLabel }} is taken from the reply.</template>
          </p>
          <UButton
            :loading="ai.promptLoading.value"
            :disabled="!ai.instructions.value"
            :icon="ai.copied.value ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
            :color="ai.copied.value ? 'success' : 'primary'"
            variant="subtle"
            data-testid="tailored-cv-copy-prompt"
            @click="ai.copyPrompt()"
            >{{ ai.copied.value ? 'Copied' : 'Copy prompt to clipboard' }}</UButton
          >
          <UAlert
            v-if="ai.promptError.value"
            color="error"
            variant="subtle"
            :title="ai.promptError.value"
            :actions="[
              {
                label: 'Retry loading prompt',
                color: 'neutral',
                variant: 'soft',
                onClick: () => ai.loadPrompt()
              }
            ]"
          />
          <details v-if="ai.instructions.value" class="text-sm">
            <summary class="cursor-pointer text-muted">View prompt / copy manually</summary>
            <pre class="mt-2 whitespace-pre-wrap break-words">{{ ai.instructions.value }}</pre>
          </details>
          <UFormField
            label="2. Paste the JSON reply"
            help="The server checks it first."
            :error="error || undefined"
          >
            <UTextarea
              v-model="json"
              :rows="6"
              :maxrows="12"
              autoresize
              class="w-full font-mono"
              data-testid="tailored-cv-json"
            />
          </UFormField>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
        <UButton
          v-if="tab === 'builtin'"
          icon="i-lucide-sparkles"
          data-testid="tailored-cv-ai-run"
          @click="analyze"
          >Analyze</UButton
        >
        <UButton
          v-else
          :loading="ai.previewing.value"
          :disabled="!json.trim()"
          data-testid="tailored-cv-preview"
          @click="preview"
          >Preview JSON</UButton
        >
      </div>
    </template>
  </UModal>
</template>
