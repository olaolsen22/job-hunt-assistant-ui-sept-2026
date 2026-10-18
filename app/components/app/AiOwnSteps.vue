<script setup lang="ts">
import type { AiPromptState } from '~/composables/useAiPrompt'

// The "use your own AI" steps every AI modal shares: copy the prompt, run it elsewhere, paste the
// reply. `#before` holds a feature's own first step (the ad parse: which ad to give the AI), and
// startStep numbers the rest after it.
const {
  ai,
  copy = undefined,
  copyDisabled = false,
  note = undefined,
  replyHelp = undefined,
  replyError = undefined,
  startStep = 1,
  testidPrefix
} = defineProps<{
  ai: AiPromptState
  // Replaces ai.copyPrompt when the copied text is built from input (the ad or its link).
  copy?: () => unknown
  copyDisabled?: boolean
  // One line under step 1, e.g. what the prompt contains.
  note?: string
  replyHelp?: string
  replyError?: string
  startStep?: number
  testidPrefix: string
}>()
const reply = defineModel<string>('reply', { required: true })

const { instructions, promptLoading, promptError, copied } = ai
const help = computed(() =>
  ['It’s checked before anything is applied.', replyHelp].filter(Boolean).join(' ')
)
</script>

<template>
  <div class="space-y-4">
    <slot name="before" />

    <div class="space-y-2">
      <p class="text-sm font-medium text-highlighted">
        {{ startStep }}. Copy the prompt and run it in ChatGPT, Gemini or Claude
      </p>
      <p v-if="note" class="text-sm text-muted">{{ note }}</p>
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :color="copied ? 'success' : 'primary'"
        variant="subtle"
        :loading="promptLoading"
        :disabled="!instructions || copyDisabled"
        :data-testid="`${testidPrefix}-copy-prompt`"
        @click="copy ? copy() : ai.copyPrompt?.()"
        >{{ copied ? 'Copied' : 'Copy prompt' }}</UButton
      >
    </div>

    <AppAiErrorAlert
      v-if="promptError"
      :title="promptError"
      :data-testid="`${testidPrefix}-prompt-error`"
    >
      <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" @click="ai.loadPrompt()"
        >Retry loading prompt</UButton
      >
    </AppAiErrorAlert>

    <details v-if="instructions" class="text-sm">
      <summary class="cursor-pointer text-muted">View prompt / copy manually</summary>
      <pre class="mt-2 break-words whitespace-pre-wrap">{{ instructions }}</pre>
    </details>

    <UFormField
      :label="`${startStep + 1}. Paste the AI’s reply`"
      :help="help"
      :error="replyError || undefined"
    >
      <UTextarea
        v-model="reply"
        :rows="6"
        :maxrows="12"
        autoresize
        placeholder="The JSON the AI returned"
        class="w-full font-mono"
        :data-testid="`${testidPrefix}-json`"
      />
    </UFormField>
  </div>
</template>
