<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'

// Without `interview` it adds one; with it, it edits that one.
const { listingId, interview } = defineProps<{
  listingId: number
  interview: ListingDetail['interviews'][number] | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_INTERVIEW = graphql(`
  mutation AddInterview($input: AddInterviewInput!) {
    addInterview(input: $input) {
      interview {
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

const UPDATE_INTERVIEW = graphql(`
  mutation UpdateInterview($input: UpdateInterviewInput!) {
    updateInterview(input: $input) {
      interview {
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

const scheduledAt = ref('')
const title = ref('')
const notes = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  scheduledAt.value = interview ? toDateTimeLocal(interview.scheduledAt) : ''
  title.value = interview?.title ?? ''
  notes.value = interview?.notes ?? ''
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const fields = {
    scheduledAt: new Date(scheduledAt.value).toISOString(),
    title: title.value,
    notes: notes.value
  }
  const ok = await run(async () => {
    if (interview) {
      const { updateInterview } = await gql(UPDATE_INTERVIEW, {
        input: { id: interview.id, ...fields }
      })
      return updateInterview.errors
    }
    const { addInterview } = await gql(ADD_INTERVIEW, { input: { listingId, ...fields } })
    return addInterview.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="interview ? 'Edit interview' : 'Add interview'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!scheduledAt"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Scheduled at" required>
        <UInput v-model="scheduledAt" type="datetime-local" class="w-full" />
      </UFormField>
      <UFormField label="Title" :hint="`${title.length} / 200`">
        <UInput v-model="title" :maxlength="200" placeholder="HR screen" class="w-full" />
      </UFormField>
      <AppMarkdownEditor v-model="notes" label="Notes" />
    </div>
  </AppConfirmModal>
</template>
