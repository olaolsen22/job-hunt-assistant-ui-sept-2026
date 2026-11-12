<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// Renames a template: its name and description. New templates are made on /cv-templates/new.
const { baseCv } = defineProps<{
  baseCv: { id: number; name: string; description?: string | null }
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const state = reactive({ name: '', description: '' })
const nameError = ref<string>()
const existingId = ref<number>()
const formError = ref<string>()
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    Object.assign(state, { name: baseCv.name, description: baseCv.description ?? '' })
    nameError.value = formError.value = existingId.value = undefined
  },
  { immediate: true }
)

const validate = (value: Partial<typeof state>) =>
  value.name?.trim() ? [] : [{ name: 'name', message: 'Give the template a name' }]

const saving = ref(false)
const submit = async () => {
  saving.value = true
  nameError.value = formError.value = existingId.value = undefined
  try {
    const { updateBaseCv } = await gql(UPDATE_BASE_CV, {
      input: {
        id: baseCv.id,
        name: state.name.trim(),
        description: state.description.trim() || null
      }
    })
    const error = updateBaseCv.errors?.[0]
    if (!error) {
      open.value = false
      emit('saved')
    } else if (error.__typename === 'DuplicateBaseCvError') {
      nameError.value = error.message
      existingId.value = error.existingBaseCvId
    } else formError.value = error.message
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
    title="Edit details"
    save-label="Save"
    :loading="saving"
    :state="state"
    :validate="validate"
    @submit="submit"
  >
    <div class="space-y-4">
      <CvTemplatesNameFields
        v-model:name="state.name"
        v-model:description="state.description"
        :error="nameError"
        :existing-id="existingId"
      />
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
