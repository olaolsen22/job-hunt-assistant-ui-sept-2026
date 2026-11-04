<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'

// Creates a CV template, or renames one when `baseCv` is given. A new template starts as the profile
// in its language and is saved as v1 at once (the API needs content to create it); the language
// can't change later, so the other language is a separate template.
const { baseCv = undefined } = defineProps<{
  baseCv?: { id: number; name: string; description?: string | null }
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const state = reactive({ name: '', description: '', language: 'ENGLISH' as Language })
const nameError = ref<string>()
const existingId = ref<number>()
const formError = ref<string>()
watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, {
    name: baseCv?.name ?? '',
    description: baseCv?.description ?? '',
    language: 'ENGLISH'
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
        : 'Starts as your profile in the chosen language. Edit it, then save new versions as it changes.'
    "
    :save-label="baseCv ? 'Save' : 'Create and edit'"
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
        help="Can't be changed later. Make a separate template for the other language."
      >
        <URadioGroup
          v-model="state.language"
          :items="[...LANGUAGE_OPTIONS]"
          orientation="horizontal"
          data-testid="cv-template-language"
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
