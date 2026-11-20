<script setup lang="ts">
import { OUTCOME_OPTIONS, type Outcome } from '~/constants/listing'

const {
  listingId,
  outcomes,
  labels = {},
  appliedAt,
  title = 'Record outcome'
} = defineProps<{
  listingId: number
  title?: string
  outcomes: readonly Outcome[]
  // Replaces the default label of an outcome whose meaning depends on the current status.
  labels?: Partial<Record<Outcome, string>>
  appliedAt: string | undefined
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

// RECORD_OUTCOME lives in useUndoStatusChange.ts: undoing an outcome re-records it there too.

const items = computed(() =>
  OUTCOME_OPTIONS.filter((o) => outcomes.includes(o.value)).map((o) => ({
    ...o,
    label: labels[o.value] ?? o.label
  }))
)

const outcome = ref<Outcome>()
const occurredAt = ref('')
const now = ref('')
const note = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  outcome.value = outcomes.length === 1 ? outcomes[0] : undefined
  occurredAt.value = now.value = toDateTimeLocal()
  note.value = ''
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const ok = await run(async () => {
    const { recordOutcome } = await gql(RECORD_OUTCOME, {
      input: {
        listingId,
        outcome: outcome.value!,
        occurredAt: new Date(occurredAt.value).toISOString(),
        note: note.value
      }
    })
    return recordOutcome.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="title"
    confirm-label="Save"
    :loading="loading"
    :disabled="!outcome || !occurredAt"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Outcome" required>
        <URadioGroup v-model="outcome" orientation="horizontal" :items="items" />
      </UFormField>
      <UFormField label="Date" required>
        <UInput
          v-model="occurredAt"
          type="datetime-local"
          :min="appliedAt && toDateTimeLocal(appliedAt)"
          :max="now"
          class="w-full"
        />
      </UFormField>
      <AppMarkdownEditor v-model="note" label="Note" />
    </div>
  </AppConfirmModal>
</template>
