<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'

const { entry } = defineProps<{ entry: ListingDetail['statusHistory'][number] | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const UPDATE_STATUS_CHANGE = graphql(`
  mutation UpdateStatusChange($input: UpdateStatusChangeInput!) {
    updateStatusChange(input: $input) {
      listing {
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

const occurredAt = ref('')
const now = ref('')
const note = ref('')

watch(open, (isOpen) => {
  if (!isOpen || !entry) return
  occurredAt.value = toDateTimeLocal(entry.occurredAt)
  now.value = toDateTimeLocal()
  note.value = entry.note ?? ''
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const ok = await run(async () => {
    const { updateStatusChange } = await gql(UPDATE_STATUS_CHANGE, {
      input: {
        id: entry!.id,
        occurredAt: new Date(occurredAt.value).toISOString(),
        note: note.value
      }
    })
    return updateStatusChange.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    title="Edit status change"
    confirm-label="Save"
    :loading="loading"
    :disabled="!occurredAt"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Date" required>
        <UInput v-model="occurredAt" type="datetime-local" :max="now" class="w-full" />
      </UFormField>
      <AppMarkdownEditor v-model="note" label="Note" />
    </div>
  </AppConfirmModal>
</template>
