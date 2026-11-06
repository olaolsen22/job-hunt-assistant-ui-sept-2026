<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'

// Creates a CV template, or renames one when `baseCv` is given. "My profile" saves the profile in
// that language as v1 at once, since there's nothing to review. "AI draft" creates nothing yet: its
// page holds the draft until the owner has reviewed and saved it. Other languages are added from
// the template's page.
const { baseCv = undefined } = defineProps<{
  baseCv?: { id: number; name: string; description?: string | null }
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const START_OPTIONS = [
  { label: 'My profile', value: 'profile' },
  { label: 'AI draft', value: 'ai' }
]

const state = reactive({
  name: '',
  description: '',
  language: 'ENGLISH' as Language,
  startFrom: 'profile'
})
const nameError = ref<string>()
const existingId = ref<number>()
const formError = ref<string>()
watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, {
    name: baseCv?.name ?? '',
    description: baseCv?.description ?? '',
    language: 'ENGLISH',
    startFrom: 'profile'
  })
  nameError.value = formError.value = existingId.value = undefined
})

const validate = (value: Partial<typeof state>) =>
  value.name?.trim() ? [] : [{ name: 'name', message: 'Give the template a name' }]

type PayloadError = { __typename: string; message: string; existingBaseCvId?: number }
// A duplicate name shows on the field, with a way to the template that has it.
const showError = (error: PayloadError) => {
  if (error.__typename === 'DuplicateBaseCvError') {
    nameError.value = error.message
    existingId.value = error.existingBaseCvId
  } else formError.value = error.message
}

const saving = ref(false)
const submit = async () => {
  saving.value = true
  nameError.value = formError.value = existingId.value = undefined
  const name = state.name.trim()
  const description = state.description.trim() || null
  try {
    if (baseCv) {
      const { updateBaseCv } = await gql(UPDATE_BASE_CV, {
        input: { id: baseCv.id, name, description }
      })
      const error = updateBaseCv.errors?.[0]
      if (error) return showError(error)
      open.value = false
      emit('saved')
      return
    }
    if (state.startFrom === 'ai') {
      open.value = false
      await navigateTo({
        path: '/cv-templates/new',
        query: { name, description: description ?? undefined, lang: languageParam(state.language) }
      })
      return
    }
    const content = toTailoredCvInput(await baseCvFromProfile(state.language))
    const { createBaseCv } = await gql(CREATE_BASE_CV, {
      input: { name, description, language: state.language, content }
    })
    const error = createBaseCv.errors?.[0]
    if (error) return showError(error)
    open.value = false
    emit('saved')
    await navigateTo(`/cv-templates/${createBaseCv.baseCv!.id}`)
  } catch (e) {
    formError.value = `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="baseCv ? 'Edit details' : 'New CV template'"
    :description="
      baseCv
        ? undefined
        : state.startFrom === 'ai'
          ? 'Draft it with your own AI and review it. Nothing is created until you save.'
          : 'Starts as your profile in the chosen language. Edit it, then save new versions as it changes.'
    "
    :save-label="
      baseCv ? 'Save' : state.startFrom === 'ai' ? 'Continue to AI draft' : 'Create and edit'
    "
    :loading="saving"
    :state="state"
    :validate="validate"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Name" name="name" required :error="nameError">
        <UInput
          v-model="state.name"
          placeholder="Frontend (EN)"
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
      <UFormField label="Description" name="description">
        <UTextarea
          v-model="state.description"
          :rows="2"
          autoresize
          placeholder="Which roles it's for"
          class="w-full"
          data-testid="cv-template-description"
        />
      </UFormField>
      <UFormField
        v-if="!baseCv"
        label="Language"
        name="language"
        help="The first language. Add a translated version from the template's page later."
      >
        <URadioGroup
          v-model="state.language"
          :items="[...LANGUAGE_OPTIONS]"
          orientation="horizontal"
          data-testid="cv-template-language"
        />
      </UFormField>
      <UFormField v-if="!baseCv" label="Start from" name="startFrom">
        <URadioGroup
          v-model="state.startFrom"
          :items="START_OPTIONS"
          orientation="horizontal"
          data-testid="cv-template-start-from"
        />
      </UFormField>
      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        :description="formError"
        data-testid="cv-template-form-error"
      />
    </div>
  </AppFormModal>
</template>
