<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const { companyId, notes: savedNotes } = defineProps<{
  companyId: number
  notes: string | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const SET_COMPANY_NOTES = graphql(`
  mutation SetCompanyNotes($input: SetCompanyNotesInput!) {
    setCompanyNotes(input: $input) {
      company {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const notes = ref('')
const errorMessage = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  notes.value = savedNotes ?? ''
  errorMessage.value = ''
})

// The error shows in the dialog rather than a toast, so the text stays next to what went wrong.
// The API trims and treats blank as "clear", so the text is sent as typed.
const save = async () => {
  saving.value = true
  errorMessage.value = ''
  try {
    const { setCompanyNotes } = await gql(SET_COMPANY_NOTES, {
      input: { id: companyId, notes: notes.value }
    })
    const error = setCompanyNotes.errors?.[0]
    if (error) {
      errorMessage.value = error.message
      return
    }
    open.value = false
    emit('saved')
  } catch {
    errorMessage.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="savedNotes ? 'Edit notes' : 'Add notes'"
    confirm-label="Save"
    :loading="saving"
    @confirm="save"
  >
    <div class="space-y-4">
      <AppMarkdownEditor v-model="notes" label="Notes" />
      <UAlert
        v-if="errorMessage"
        color="error"
        :description="errorMessage"
        data-testid="company-notes-error"
      />
    </div>
  </AppConfirmModal>
</template>
