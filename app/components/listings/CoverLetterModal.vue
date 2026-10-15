<script setup lang="ts">
import type { useCoverLetterDraft } from '~/composables/useCoverLetterDraft'

// The three ways to get a letter body. Each loads a whole unsaved letter into the editor, so a
// failure keeps this open with its error and the editor stays as it was.
export type CoverLetterSource = 'ai' | 'json' | 'text'

const { editor, source } = defineProps<{
  editor: ReturnType<typeof useCoverLetterDraft>
  source: CoverLetterSource
}>()
const open = defineModel<boolean>('open', { required: true })

const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const pasted = ref('')
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  pasted.value = error.value = ''
  if (source === 'ai') refreshUsage()
  if (source === 'json' && !editor.instructions.value) editor.loadPrompt()
})

const TITLES: Record<CoverLetterSource, string> = {
  ai: 'Generate with AI',
  json: 'Use an external chat',
  text: 'Paste your own letter'
}

// AI saves unsaved edits before it runs, so only a pasted letter can replace work that isn't saved.
const replacesEdits = computed(
  () => source !== 'ai' && editor.dirty.value && !editor.pristine.value
)
const busy = computed(() => editor.generating.value || editor.previewing.value)
const paragraphCount = computed(() => pasted.value.split(/\n\s*\n/).filter((p) => p.trim()).length)

const submit = async () => {
  error.value =
    (source === 'ai' ? await editor.generate() : await editor.preview(source, pasted.value)) ?? ''
  if (source === 'ai') refreshUsage()
  if (!error.value) open.value = false
}
const retry = () => {
  editor.confirmRetry()
  void submit()
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="TITLES[source]"
    description="The letter loads into the editor. Nothing is saved until you save it."
    :dismissible="!busy"
  >
    <template #body>
      <div class="space-y-4">
        <template v-if="source === 'ai'">
          <AppAiCostNotice :usage="usageData?.llmUsageToday" />
          <p class="text-sm text-muted">
            Uses the listing, your profile, your story, your writing samples and your notes for the
            AI.
            <template v-if="editor.dirty.value">Your edits are saved first.</template>
          </p>
          <AppAiRetryConfirm
            v-if="editor.needsConfirm.value"
            :message="editor.safetyMessage.value"
            :loading="editor.generating.value"
            @retry="retry"
          />
        </template>

        <template v-else-if="source === 'json'">
          <p class="text-sm text-muted">
            1. Copy the prompt and run it in your chosen AI. It holds the listing, your profile and
            your notes.
          </p>
          <UButton
            :loading="editor.promptLoading.value"
            :disabled="!editor.instructions.value"
            :icon="editor.copied.value ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
            :color="editor.copied.value ? 'success' : 'primary'"
            variant="subtle"
            data-testid="cover-letter-copy-prompt"
            @click="editor.copyPrompt()"
            >{{ editor.copied.value ? 'Copied' : 'Copy prompt to clipboard' }}</UButton
          >
          <UAlert
            v-if="editor.promptError.value"
            color="error"
            variant="subtle"
            :title="editor.promptError.value"
            :actions="[
              {
                label: 'Retry loading prompt',
                color: 'neutral',
                variant: 'soft',
                onClick: () => editor.loadPrompt()
              }
            ]"
          />
          <details v-if="editor.instructions.value" class="text-sm">
            <summary class="cursor-pointer text-muted">View prompt / copy manually</summary>
            <pre class="mt-2 whitespace-pre-wrap break-words">{{ editor.instructions.value }}</pre>
          </details>
        </template>

        <UFormField
          v-if="source !== 'ai'"
          :label="source === 'json' ? '2. Paste the JSON reply' : 'Your letter'"
          :help="
            source === 'json'
              ? 'The server checks it first.'
              : `Paste the whole letter; separate paragraphs with a blank line. ${paragraphCount} ${paragraphCount === 1 ? 'paragraph' : 'paragraphs'}.`
          "
        >
          <UTextarea
            v-model="pasted"
            :rows="6"
            :maxrows="14"
            autoresize
            class="w-full"
            :class="{ 'font-mono': source === 'json' }"
            data-testid="cover-letter-paste"
          />
        </UFormField>

        <UAlert
          v-if="error && !editor.needsConfirm.value"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          data-testid="cover-letter-source-error"
        >
          <template v-if="editor.safetyCode.value === 'daily-limit-reached'" #actions>
            <AppAiLimitLink />
          </template>
        </UAlert>
        <p v-if="replacesEdits" class="text-sm text-warning" data-testid="cover-letter-replaces">
          This replaces your unsaved edits. Discard brings them back until you save.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" :disabled="busy" @click="open = false"
          >Cancel</UButton
        >
        <UButton
          :icon="source === 'ai' ? 'i-lucide-sparkles' : 'i-lucide-file-input'"
          :color="replacesEdits ? 'warning' : 'primary'"
          :loading="busy"
          :disabled="(source !== 'ai' && !pasted.trim()) || editor.needsConfirm.value"
          data-testid="cover-letter-source-run"
          @click="submit"
          >{{
            source === 'ai'
              ? editor.dirty.value
                ? 'Save and generate'
                : 'Generate letter'
              : replacesEdits
                ? 'Replace my edits'
                : 'Load letter'
          }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
