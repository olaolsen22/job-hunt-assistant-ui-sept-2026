<script setup lang="ts">
import type { BaseCvEditor } from '~/composables/useBaseCvs'
import type { CvContentStyle } from '~/utils/tailoredCv'
import {
  CONTENT_STYLE_DESCRIPTION,
  CONTENT_STYLE_OPTIONS,
  TEMPLATE_HINTS,
  TEMPLATE_OPTIONS
} from '~/constants/cv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { languageLabel } from '~/constants/listing'

// The tailored CV's own-AI steps for a CV template, in the language being edited. The prompt depends
// on what's typed here, so it can't load up front; it's fetched on request, so that "Copy prompt"
// stays a direct clipboard write. The reply comes in as suggestions to review, an entry (company) at
// a time. The CV style and entry format are the template's own (the Layout card's too), so picking
// them here changes both. The prompt has no entry format: the reply always carries bullets.
const { editor } = defineProps<{
  editor: Pick<BaseCvEditor, 'isNew' | 'language' | 'cv' | 'offerReply' | 'aiDrafted'>
}>()
const open = defineModel<boolean>('open', { required: true })

const TARGET_ROLE_MAX = 100
const NOTES_MAX = 2000
const DETAILED_VERBATIM_HINT =
  'Detailed without rewriting keeps each bullet word for word. Copy the prompt and run it again (an older prompt can cause this), or choose Concise or “Rewrite in plain words”, then update the prompt.'

const role = ref('')
const notes = ref('')
const style = computed({
  get: () => editor.cv.value!.template,
  set: (value) => (editor.cv.value!.template = value)
})
// The preview must get the same value as the prompt, or rewritten bullets fall back to the source.
const rewrite = ref(false)
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
        template: style.value,
        rewrite: rewrite.value
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
watch([() => role.value.trim(), () => notes.value.trim(), style, rewrite, language], () =>
  ai.reset()
)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    json.value = ''
    error.value = ''
  },
  { immediate: true }
)
watch(json, () => (error.value = ''))

// Fields and closing wait for a request, so a prompt can't arrive for details that have since changed.
const locked = computed(() => promptLoading.value || previewing.value)
const notify = useAppToast()

const load = async () => {
  previewing.value = true
  error.value = ''
  try {
    const { previewBaseCv } = await gql(PREVIEW_BASE_CV, {
      input: {
        language: language.value,
        json: json.value.trim(),
        template: style.value,
        rewrite: rewrite.value
      }
    })
    const { candidate, errors } = previewBaseCv
    if (!candidate) {
      const first = errors?.[0]
      error.value = first?.message ?? ERROR_MESSAGES.generic
      // Detailed without rewriting must keep each bullet verbatim, and replies to older prompts
      // reworded or merged them, so say how to get a reply the API accepts.
      if (
        first?.__typename === 'InvalidTailoredCvDraftError' &&
        style.value === 'DETAILED' &&
        !rewrite.value
      )
        error.value += ` ${DETAILED_VERBATIM_HINT}`
      return
    }
    // A paragraph that failed the API's word check comes back null; fill it like the PDF does.
    const offered = editor.offerReply(
      fillMissingParagraphs({
        ...tailoredCvFromContent(candidate.content),
        template: style.value,
        contentStyle: editor.cv.value!.contentStyle
      })
    )
    if (!offered && !editor.aiDrafted.value) notify.info('The AI draft matches your content')
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
    :description="
      editor.isNew
        ? 'You review the draft in the editor, company by company. Nothing is created until you save.'
        : 'You review the draft in the editor, company by company. Nothing saves until you save the version.'
    "
    :busy="locked"
  >
    <AppAiOwnSteps
      v-model:reply="json"
      :ai="ai"
      :start-step="2"
      note="It holds your profile, without contact details."
      reply-help="Each change shows on its card to accept or dismiss."
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
            :help="
              rewrite
                ? 'Anything to emphasize or leave out, and how to word it, e.g. explain IT work for non-IT readers.'
                : 'Anything the AI should emphasize or leave out.'
            "
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
            :help="
              editor.isNew ? undefined : 'To draft another language, use Add language on the page.'
            "
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
          <UFormField label="Entry format" :description="CONTENT_STYLE_DESCRIPTION">
            <URadioGroup
              :model-value="editor.cv.value!.contentStyle"
              :items="CONTENT_STYLE_OPTIONS"
              :disabled="locked"
              orientation="horizontal"
              data-testid="cv-ai-draft-content-style"
              @update:model-value="setCvContentStyle(editor.cv.value!, $event as CvContentStyle)"
            />
          </UFormField>
          <UCheckbox
            v-model="rewrite"
            label="Rewrite in plain words"
            description="Bullets may be reworded. Numbers and skills are checked; review the meaning."
            :disabled="locked"
            data-testid="cv-ai-draft-rewrite"
          />
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

    <template #actions>
      <UButton
        icon="i-lucide-file-input"
        :loading="previewing"
        :disabled="!instructions || !json.trim()"
        data-testid="cv-ai-draft-load"
        @click="load"
        >Review in editor</UButton
      >
    </template>
  </AppAiModal>
</template>
