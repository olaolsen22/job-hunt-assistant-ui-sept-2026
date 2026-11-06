<script setup lang="ts">
import type { useCoverLetterDraft } from '~/composables/useCoverLetterDraft'

// The three ways to get a letter body, as tabs: built-in AI, your own AI, or a letter you paste
// (no AI). Each loads a whole unsaved letter into the editor, so a failure keeps this open with
// its error and the editor stays as it was.
const { editor } = defineProps<{ editor: ReturnType<typeof useCoverLetterDraft> }>()
const open = defineModel<boolean>('open', { required: true })

const pasted = ref('')
const { method, tab, error, usage, refreshUsage } = useAiModalState<'builtin' | 'own' | 'letter'>(
  open,
  {
    onOpen: () => {
      pasted.value = ''
    }
  }
)
// The prompt is loaded before the copy button can be used: a clipboard write after an await can fail.
watch(
  [open, tab],
  ([isOpen, current]) => {
    if (isOpen && current === 'own' && !editor.instructions.value) editor.loadPrompt()
  },
  { immediate: true }
)
watch(pasted, () => (error.value = ''))

const extraTabs = [{ label: 'Paste a letter', value: 'letter', icon: 'i-lucide-clipboard-paste' }]

// Built-in saves unsaved edits before it runs, so only a loaded letter can replace unsaved work.
const replacesEdits = computed(
  () => tab.value !== 'builtin' && editor.dirty.value && !editor.pristine.value
)
const busy = computed(() => editor.generating.value || editor.previewing.value)
const paragraphCount = computed(() => pasted.value.split(/\n\s*\n/).filter((p) => p.trim()).length)

const submit = async () => {
  const builtin = tab.value === 'builtin'
  error.value =
    (builtin
      ? await editor.generate()
      : await editor.preview(tab.value === 'own' ? 'json' : 'text', pasted.value)) ?? ''
  if (builtin) refreshUsage()
  if (error.value) return
  if (tab.value !== 'letter') method.value = tab.value
  open.value = false
}
const retry = () => {
  editor.confirmRetry()
  void submit()
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Write the letter body"
    description="The letter loads into the editor. Nothing is saved until you save it."
    :busy="busy"
  >
    <AppAiMethodTabs v-model="tab" :extra="extraTabs" :disabled="busy" />

    <p
      v-if="editor.noSavedCv.value && tab !== 'letter'"
      class="text-sm text-muted"
      data-testid="cover-letter-source-no-cv"
    >
      No tailored CV is saved for this listing, so the AI can’t use it as evidence.
    </p>

    <template v-if="tab === 'builtin'">
      <p class="text-sm text-muted">
        Uses the listing, your profile, your story, your writing samples and your notes for the AI.
        <template v-if="editor.dirty.value">Your edits are saved first.</template>
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
        data-testid="cover-letter-source-error"
      />
    </template>

    <AppAiOwnSteps
      v-else-if="tab === 'own'"
      v-model:reply="pasted"
      :ai="editor"
      note="It holds the listing, your profile and your notes."
      :reply-error="error"
      testid-prefix="cover-letter"
    />

    <UFormField
      v-else
      label="Your letter"
      :help="`Paste the whole letter; separate paragraphs with a blank line. ${paragraphCount} ${paragraphCount === 1 ? 'paragraph' : 'paragraphs'}.`"
      :error="error || undefined"
    >
      <UTextarea
        v-model="pasted"
        :rows="6"
        :maxrows="14"
        autoresize
        class="w-full"
        data-testid="cover-letter-paste"
      />
    </UFormField>

    <p v-if="replacesEdits" class="text-sm text-warning" data-testid="cover-letter-replaces">
      This replaces your unsaved edits. Discard brings them back until you save.
    </p>

    <template #actions>
      <UButton
        :icon="tab === 'builtin' ? 'i-lucide-sparkles' : 'i-lucide-file-input'"
        :color="replacesEdits ? 'warning' : 'primary'"
        :loading="busy"
        :disabled="tab === 'builtin' ? editor.needsConfirm.value : !pasted.trim()"
        data-testid="cover-letter-source-run"
        @click="submit"
        >{{
          tab === 'builtin'
            ? editor.dirty.value
              ? 'Save and generate'
              : 'Generate letter'
            : replacesEdits
              ? 'Replace my edits'
              : 'Load letter'
        }}</UButton
      >
    </template>
  </AppAiModal>
</template>
