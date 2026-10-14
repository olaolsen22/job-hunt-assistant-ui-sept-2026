<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'
import { APPLICATION_STATUS_OPTIONS } from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

const UNDO_STATUS_CHANGE = graphql(`
  mutation UndoStatusChange($input: UndoStatusChangeInput!) {
    undoStatusChange(input: $input) {
      listing {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
        ... on DuplicateListingError {
          existingListingId
        }
      }
    }
  }
`)

type Entry = ListingDetail['statusHistory'][number]

const labelOf = (status: Entry['status']) =>
  APPLICATION_STATUS_OPTIONS.find((o) => o.value === status)!.label

const items = computed(() =>
  listing.statusHistory.map((entry) => ({
    value: entry.id,
    title: labelOf(entry.status),
    date: formatDateTime(entry.occurredAt),
    entry
  }))
)
const newest = computed(() => listing.statusHistory.at(-1))

const editing = ref<Entry | null>(null)
const editOpen = ref(false)
const edit = (entry: Entry) => {
  editing.value = entry
  editOpen.value = true
}

const undoOpen = ref(false)
const undoDescription = computed(() => {
  if (newest.value?.status === 'APPLIED') return 'The documents sent will be marked as not sent.'
  return 'The listing goes back to its previous status.'
})

const toast = useToast()
const { run, loading } = useMutation(() => emit('changed'))

const undo = async () => {
  let reopenBlocked = false
  const ok = await run(async () => {
    const { undoStatusChange } = await gql(UNDO_STATUS_CHANGE, {
      input: { listingId: listing.id }
    })
    const duplicate = undoStatusChange.errors?.find((e) => e.__typename === 'DuplicateListingError')
    if (!duplicate) return undoStatusChange.errors
    // useMutation's toast has no link, and the user needs the open listing that blocks the undo.
    reopenBlocked = true
    toast.add({
      title: duplicate.message,
      color: 'error',
      actions: [
        {
          label: 'View open listing',
          to: `/listings/${duplicate.existingListingId}`,
          color: 'neutral',
          variant: 'outline'
        }
      ]
    })
  })
  undoOpen.value = false
  if (ok && !reopenBlocked) emit('changed')
}
</script>

<template>
  <!-- Every entry is a step already taken, so the newest one is the active value. -->
  <UTimeline :items="items" :default-value="newest?.id" size="xs" data-testid="status-timeline">
    <template #description="{ item }">
      <div class="space-y-1">
        <LazyAppMarkdownContent v-if="item.entry.note" :source="item.entry.note" />
        <div class="flex flex-wrap gap-1">
          <UButton
            size="xs"
            variant="link"
            color="neutral"
            icon="i-lucide-pencil"
            class="px-0"
            @click="edit(item.entry)"
            >Edit</UButton
          >
          <UButton
            v-if="item.entry.id === newest?.id && item.entry.status !== 'SAVED'"
            size="xs"
            variant="link"
            color="neutral"
            icon="i-lucide-undo-2"
            data-testid="status-undo"
            @click="undoOpen = true"
            >Undo {{ item.title }}</UButton
          >
        </div>
      </div>
    </template>
  </UTimeline>

  <ListingsStatusChangeModal v-model:open="editOpen" :entry="editing" @changed="emit('changed')" />

  <AppConfirmModal
    v-model:open="undoOpen"
    :title="`Undo ${newest ? labelOf(newest.status) : ''}?`"
    :description="undoDescription"
    confirm-label="Undo"
    :loading="loading"
    @confirm="undo"
  />
</template>
