<script setup lang="ts">
import type { useBaseCvEditor } from '~/composables/useBaseCvs'
import type { TailoredCv } from '~/utils/tailoredCv'
import { TEMPLATE_HINTS, TEMPLATE_OPTIONS } from '~/constants/cv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { languageLabel } from '~/constants/listing'

// The tailored CV's own-AI steps for a CV template, in the language being edited. The prompt depends
// on what's typed here, so it can't load up front; it's fetched on request, so that "Copy prompt"
// stays a direct clipboard write. The reply loads into the editor unsaved.
const { editor } = defineProps<{ editor: ReturnType<typeof useBaseCvEditor> }>()
const open = defineModel<boolean>('open', { required: true })

const TARGET_ROLE_MAX = 100
const NOTES_MAX = 2000

const role = ref('')
const notes = ref('')
const style = ref<TailoredCv['template']>('DETAILED')
const json = ref('')
const error = ref('')
const previewing = ref(false)
const language = computed(() => editor.language.value!)

const ai = useAiPrompt(
  async () =>
    (
      await gql(BASE_CV_EXTERNAL_PROMPT, {
        language: language.value,
        targetRole: role.value.trim(),
        notes: notes.value.trim() || null,
        template: style.value
      })
    ).baseCvExternalPrompt.instructions
)
const { instructions, promptLoading } = ai

// A changed detail means a different prompt, so Copy and Load wait for a new one. That also keeps
// the reply's preview on the language and style its prompt was written for. The reply stays.
const created = ref(false)
watch(instructions, (value) => {
  if (value) created.value = true
})
watch([() => role.value.trim(), () => notes.value.trim(), style, language], () => ai.reset())

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    json.value = ''
    error.value = ''
    style.value = editor.cv.value!.template
  },
  { immediate: true }
)
watch(json, () => (error.value = ''))

// Fields and closing wait for a request, so a prompt can't arrive for details that have since changed.
const locked = computed(() => promptLoading.value || previewing.value)
const replacesEdits = computed(() => editor.dirty.value)

const load = async () => {
  previewing.value = true
  error.value = ''
  try {
    const { previewBaseCv } = await gql(PREVIEW_BASE_CV, {
      input: { language: language.value, json: json.value.trim(), template: style.value }
    })
    const { candidate, errors } = previewBaseCv
    if (!candidate) {
      error.value = errors?.[0]?.message ?? ERROR_MESSAGES.generic
      return
    }
    editor.replaceContent({ ...tailoredCvFromContent(candidate.content), template: style.value })
    open.value = false
  } catch (e) {
    error.value = genericError(e)
  } finally {
    previewing.value = false
  }
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Draft with AI"
    description="The draft shows in the editor for review. Nothing saves until you save the version."
    :busy="locked"
  >
    <AppAiOwnSteps
      v-model:reply="json"
      :ai="ai"
      :start-step="2"
      note="It holds your profile, without contact details."
      reply-help="You review the draft in the editor before saving."
      :reply-error="error"
      testid-prefix="cv-ai-draft"
    >
      <template #before>
        <div class="space-y-4">
          <p class="text-sm font-medium text-highlighted">1. Describe the role</p>
          <UFormField label="Target role" required :hint="`${role.length} / ${TARGET_ROLE_MAX}`">
            <UInput
              v-model="role"
              :maxlength="TARGET_ROLE_MAX"
              :disabled="locked"
              placeholder="Senior frontend developer"
              class="w-full"
              data-testid="cv-ai-draft-role"
            />
          </UFormField>
          <UFormField
            label="Notes"
            help="Anything the AI should emphasize or leave out."
            :hint="`${notes.length} / ${NOTES_MAX}`"
          >
            <UTextarea
              v-model="notes"
              :maxlength="NOTES_MAX"
              :disabled="locked"
              :rows="2"
              :maxrows="8"
              autoresize
              class="w-full"
              data-testid="cv-ai-draft-notes"
            />
          </UFormField>
          <UFormField
            label="Language"
            help="To draft another language, switch to it or add it on the page first."
          >
            <p class="text-sm" data-testid="cv-ai-draft-language">{{ languageLabel(language) }}</p>
          </UFormField>
          <UFormField label="CV style" :description="TEMPLATE_HINTS[style]">
            <URadioGroup
              v-model="style"
              :items="TEMPLATE_OPTIONS"
              :disabled="locked"
              orientation="horizontal"
              data-testid="cv-ai-draft-style"
            />
          </UFormField>
          <div class="space-y-2">
            <UButton
              :icon="instructions ? 'i-lucide-check' : 'i-lucide-file-text'"
              variant="subtle"
              :loading="promptLoading"
              :disabled="!role.trim() || !!instructions"
              data-testid="cv-ai-draft-create"
              @click="ai.loadPrompt()"
              >{{
                instructions ? 'Prompt ready' : created ? 'Update prompt' : 'Create prompt'
              }}</UButton
            >
            <p
              v-if="created && !instructions && !promptLoading"
              class="text-sm text-warning"
              data-testid="cv-ai-draft-outdated"
            >
              You changed the details. Update the prompt before copying.
            </p>
          </div>
        </div>
      </template>
    </AppAiOwnSteps>

    <p v-if="replacesEdits" class="text-sm text-warning" data-testid="cv-ai-draft-replaces">
      This replaces your unsaved edits. Your saved versions stay as they are.
    </p>

    <template #actions>
      <UButton
        icon="i-lucide-file-input"
        :color="replacesEdits ? 'warning' : 'primary'"
        :loading="previewing"
        :disabled="!instructions || !json.trim()"
        data-testid="cv-ai-draft-load"
        @click="load"
        >{{ replacesEdits ? 'Replace my edits' : 'Load into editor' }}</UButton
      >
    </template>
  </AppAiModal>
</template>
