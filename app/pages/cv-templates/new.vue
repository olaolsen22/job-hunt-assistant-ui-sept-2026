<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '~/constants/listing'

definePageMeta({ title: 'New CV template' })

// A new template, made here in one place: its details, then content from the profile or the owner's
// own AI (reviewed against the profile). Nothing exists on the API until Create template, which
// saves the content as v1 and opens the template.
const editor = useBaseCvEditor('new')
const { cv, newLanguage } = editor

const name = ref('')
const description = ref('')
const nameFields = useTemplateRef('nameFields')
const nameError = ref<string>()
const existingId = ref<number>()
const saveError = ref('')
const created = ref(false)
const notify = useAppToast()

const create = async () => {
  nameError.value = existingId.value = undefined
  saveError.value = ''
  const trimmed = name.value.trim()
  if (!trimmed) {
    nameError.value = 'Give the template a name'
    nameFields.value?.focus()
    return
  }
  const result = await editor.create(trimmed, description.value.trim() || null)
  if ('id' in result) {
    created.value = true
    notify.success('Template created', {
      description: 'Send it from a listing: open the listing and choose Apply.'
    })
    await navigateTo(`/cv-templates/${result.id}`, { replace: true })
    return
  }
  // The fix is in the name field, so that's where the error goes and the focus moves.
  if (result.duplicate) {
    nameError.value = result.error
    existingId.value = result.existingId
    nameFields.value?.focus()
  } else if (!editor.invalidContent.value) saveError.value = result.error
}
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6 lg:max-w-none">
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

      <CvTemplatesEditor :editor="editor" :allow-leave="created">
        <template #rail>
          <AppCard title="Details" data-testid="cv-template-details">
            <div class="space-y-4">
              <CvTemplatesNameFields
                ref="nameFields"
                v-model:name="name"
                v-model:description="description"
                :error="nameError"
                :existing-id="existingId"
              />
              <!-- The content is in this language, so it's picked before there is any. -->
              <UFormField
                label="Language"
                :help="
                  cv
                    ? 'Add other languages from the template’s page once it’s created.'
                    : 'The first language. Add others from the template’s page later.'
                "
              >
                <URadioGroup
                  v-model="newLanguage"
                  :items="[...LANGUAGE_OPTIONS]"
                  :disabled="!!cv"
                  orientation="horizontal"
                  data-testid="cv-template-language"
                />
              </UFormField>
            </div>
          </AppCard>
        </template>
        <template #intro>Edits here change this template only, not your profile.</template>
        <template #above>
          <UAlert
            v-if="saveError"
            color="error"
            variant="subtle"
            :description="saveError"
            data-testid="cv-template-save-error"
          />
        </template>
        <template #actions="{ busy }">
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
            :loading="editor.saving.value"
            :disabled="busy"
            class="w-full justify-center sm:w-auto"
            data-testid="cv-template-save"
            @click="create"
            >Create template</UButton
          >
        </template>
      </CvTemplatesEditor>
    </div>
  </div>
</template>
