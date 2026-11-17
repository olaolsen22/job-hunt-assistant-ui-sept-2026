<script setup lang="ts">
import type { useCoverLetterDraft } from '~/composables/useCoverLetterDraft'

// The ways to get a new letter, as tabs: built-in AI, your own AI, or a letter you paste (no AI).
// The notes and relocation weeks steer the AI, so they sit here, above its tabs. A new letter
// waits for review beside the owner's own (a pasted one into an empty letter goes straight in), so
// a failure keeps this open with its error and the editor stays as it was. `paste` opens on the
// paste tab (the page's ⋮ Paste a letter).
const {
  editor,
  listingId,
  paste = false
} = defineProps<{
  editor: ReturnType<typeof useCoverLetterDraft>
  listingId: number
  paste?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })

const pasted = ref('')
const { method, tab, error, usage, refreshUsage } = useAiModalState<'builtin' | 'own' | 'letter'>(
  open,
  {
    onOpen: (current) => {
      pasted.value = ''
      if (paste) current.value = 'letter'
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
// One box per kind of text: a JSON reply must not load as a pasted letter, or the other way round.
watch(tab, () => (pasted.value = ''))

const extraTabs = [{ label: 'Paste a letter', value: 'letter', icon: 'i-lucide-clipboard-paste' }]

const letter = computed(() => editor.letter.value!)
// A whole number of weeks from 0 to 52, or none. Clamped as typed, so the field never shows a
// value that won't be saved.
const weeks = computed({
  get: () => letter.value.relocationLeadWeeks ?? undefined,
  set: (value: number | string | undefined | null) => {
    const n = value === '' || value == null ? NaN : Math.trunc(Number(value))
    letter.value.relocationLeadWeeks = Number.isFinite(n) ? Math.min(52, Math.max(0, n)) : null
  }
})

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
    title="Write the letter"
    description="A new letter waits beside yours until you choose to use it."
    :busy="busy"
  >
    <AppAiMethodTabs v-model="tab" :extra="extraTabs" :disabled="busy" />

    <p v-if="tab === 'builtin'" class="text-sm text-muted">
      Writes a new letter from the listing, your CV, story, writing samples and these notes.
      <template v-if="editor.dirty.value">Your edits and notes are saved first.</template>
    </p>

    <template v-if="tab !== 'letter'">
      <UFormField
        label="Notes for the AI"
        help="Every point here gets covered. Saved with the letter, never printed."
      >
        <UTextarea
          v-model="letter.brief"
          :rows="3"
          :maxrows="10"
          :maxlength="2000"
          autoresize
          class="w-full"
          :disabled="busy"
          placeholder="What to stress for this job, a person you spoke to, things to leave out…"
          data-testid="cover-letter-brief"
        />
        <template #hint>{{ letter.brief.length }}/2000</template>
      </UFormField>
      <UFormField
        label="Weeks you need to relocate"
        help="Optional. How long before you could start if you have to move for this job."
      >
        <UInput
          v-model="weeks"
          type="number"
          :min="0"
          :max="52"
          :step="1"
          inputmode="numeric"
          class="w-32"
          :disabled="busy"
          data-testid="cover-letter-relocation-weeks"
        />
      </UFormField>

      <UAlert
        v-if="editor.noSavedCv.value"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        description="No tailored CV is saved for this listing, so the AI uses your profile and may be more generic."
        :actions="[
          {
            label: 'Tailor a CV first',
            to: `/listings/${listingId}/cv`,
            color: 'neutral',
            variant: 'outline'
          }
        ]"
        data-testid="cover-letter-source-no-cv"
      />
    </template>

    <template v-if="tab === 'builtin'">
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
      note="It holds the listing, your profile and these notes."
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

    <template #actions>
      <UButton
        :icon="tab === 'builtin' ? 'i-lucide-sparkles' : 'i-lucide-file-input'"
        :loading="busy"
        :disabled="tab === 'builtin' ? editor.needsConfirm.value : !pasted.trim()"
        data-testid="cover-letter-source-run"
        @click="submit"
        >{{
          tab === 'builtin'
            ? editor.dirty.value
              ? 'Save and write letter'
              : 'Write letter'
            : 'Load letter'
        }}</UButton
      >
    </template>
  </AppAiModal>
</template>
