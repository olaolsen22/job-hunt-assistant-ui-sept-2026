<script setup lang="ts">
import { languageLabel } from '~/constants/listing'

definePageMeta({ title: 'New CV template' })

// A new template drafted with AI, from the New CV template dialog. Nothing exists on the API until
// Save, so the owner reviews the draft first and walking away leaves nothing behind. The dialog's
// answers come in the URL, so a reload keeps them; without a name there's nothing to continue.
const route = useRoute()
const language = languageFromParam(route.query.lang) ?? 'ENGLISH'
const name = ref(String(route.query.name ?? ''))
const description = ref(String(route.query.description ?? ''))
if (!name.value.trim()) await navigateTo('/cv-templates', { replace: true })

const draft = useNewBaseCv(language)
const { cv, dirty, aiDrafted, loadError, saving } = draft
const saved = ref(false)

const aiOpen = ref(true)
const aiOpened = useOpenedOnce(aiOpen)

const nameInput = useTemplateRef('nameInput')
const nameError = ref<string>()
const existingId = ref<number>()
const saveError = ref('')
const toastSuccess = useSuccessToast()
const save = async () => {
  nameError.value = existingId.value = undefined
  saveError.value = ''
  const trimmed = name.value.trim()
  const result = trimmed
    ? await draft.save(trimmed, description.value.trim() || null)
    : { error: 'Give the template a name', duplicate: true, existingId: undefined }
  if ('id' in result) {
    saved.value = true
    toastSuccess('Template saved')
    await navigateTo(`/cv-templates/${result.id}`, { replace: true })
    return
  }
  // The fix is in the name field, so that's where the error goes and the focus moves.
  if (result.duplicate) {
    nameError.value = result.error
    existingId.value = result.existingId
    nameInput.value?.inputRef?.focus()
  } else saveError.value = result.error
}

const { open: leaveOpen, leave } = useLeaveConfirm(() => dirty.value && !saved.value)
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6">
      <div class="space-y-2">
        <UButton to="/cv-templates" icon="i-lucide-arrow-left" variant="ghost" color="neutral"
          >CV templates</UButton
        >
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-semibold text-highlighted">New CV template</h1>
          <UBadge color="neutral" variant="subtle" data-testid="cv-template-not-saved"
            >Not saved yet</UBadge
          >
        </div>
      </div>

      <UAlert
        v-if="loadError"
        color="error"
        :description="loadError"
        data-testid="cv-template-load-error"
      />

      <div v-else-if="!cv" class="space-y-4" data-testid="cv-template-loading">
        <USkeleton class="h-28 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>

      <template v-else>
        <AppCard title="Template details" data-testid="cv-template-details">
          <div class="space-y-4">
            <UFormField label="Name" required :error="nameError">
              <UInput
                ref="nameInput"
                v-model="name"
                class="w-full"
                data-testid="cv-template-name"
              />
            </UFormField>
            <!-- Outside the field: its help slot is hidden while the error shows. -->
            <ULink
              v-if="existingId"
              :to="`/cv-templates/${existingId}`"
              class="-mt-2 block text-sm text-primary"
              >Open the existing template</ULink
            >
            <UFormField label="Description">
              <UTextarea
                v-model="description"
                :rows="2"
                autoresize
                placeholder="Which roles it's for"
                class="w-full"
                data-testid="cv-template-description"
              />
            </UFormField>
            <UFormField label="Language">
              <p class="text-sm" data-testid="cv-template-new-language">
                {{ languageLabel(language) }}
              </p>
            </UFormField>
          </div>
        </AppCard>

        <CvTemplatesAiDraftAlert v-if="aiDrafted" @discard="draft.discardAiDraft" />

        <CvTemplatesOptionsCard v-model:cv="cv" :busy="saving" @draft="aiOpen = true">
          {{
            aiDrafted
              ? 'Run it again for another role, or edit the draft by hand.'
              : 'This is your profile for now. Paste your AI’s draft, or edit it by hand.'
          }}
        </CvTemplatesOptionsCard>

        <CvContentEditor v-model:cv="cv" :source="draft.source.value" :disabled="saving" />

        <UAlert
          v-if="saveError"
          color="error"
          variant="subtle"
          :description="saveError"
          data-testid="cv-template-save-error"
        />

        <AppSaveBar
          :status="
            aiDrafted
              ? 'AI draft: check bullets before saving'
              : 'Nothing is created until you save'
          "
          status-testid="cv-template-save-status"
          :changed="true"
          :warn="dirty"
          align="start"
          data-testid="cv-template-save-bar"
        >
          <UButton
            to="/cv-templates"
            color="neutral"
            variant="subtle"
            class="w-full justify-center sm:w-auto"
            data-testid="cv-template-cancel"
            >Cancel</UButton
          >
          <UButton
            icon="i-lucide-save"
            :loading="saving"
            class="w-full justify-center sm:w-auto"
            data-testid="cv-template-save"
            @click="save"
            >Save template</UButton
          >
        </AppSaveBar>
      </template>

      <LazyCvTemplatesAiDraftModal
        v-if="cv && aiOpened"
        v-model:open="aiOpen"
        :editor="draft"
        is-new
      />

      <AppConfirmModal
        v-model:open="leaveOpen"
        title="Leave without saving?"
        description="This CV template hasn’t been saved. It will be lost."
        confirm-label="Leave"
        @confirm="leave"
      />
    </div>
  </div>
</template>
