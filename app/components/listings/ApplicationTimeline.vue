<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ListingDetail } from '~/composables/useListing'
import type { TimelineRow } from '~/utils/applicationTimeline'

const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

const DELETE_INTERVIEW = graphql(`
  mutation DeleteInterview($input: DeleteInterviewInput!) {
    deleteInterview(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

type Entry = ListingDetail['statusHistory'][number]
type Interview = ListingDetail['interviews'][number]

const STATUS_ICONS: Partial<Record<Entry['status'], string>> = {
  APPLIED: 'i-lucide-send',
  OFFER: 'i-lucide-handshake',
  ACCEPTED: 'i-lucide-circle-check',
  REJECTED: 'i-lucide-circle-x',
  WITHDRAWN: 'i-lucide-circle-minus'
}

const rows = computed(() => timelineRows(listing))
const items = computed(() =>
  rows.value.map((row) => ({
    value: row.key,
    icon: row.kind === 'interview' ? 'i-lucide-calendar' : STATUS_ICONS[row.entry.status],
    row
  }))
)
// Newest first, so `reverse` colours everything below the newest past row as done and leaves
// upcoming interviews above it in the not-yet colour.
const active = computed(() => rows.value.find((r) => r.kind === 'status' || !r.upcoming)?.key)

const editingEntry = ref<Entry | null>(null)
const entryOpen = ref(false)
const selected = ref<Interview | null>(null)
const interviewOpen = ref(false)
const deleteOpen = ref(false)

const menu = (row: TimelineRow): DropdownMenuItem[][] => {
  if (row.kind === 'status')
    return [
      [
        {
          label: 'Edit date and note',
          icon: 'i-lucide-pencil',
          onSelect: () => {
            editingEntry.value = row.entry
            entryOpen.value = true
          }
        }
      ]
    ]
  return [
    [
      {
        label: 'Edit interview',
        icon: 'i-lucide-pencil',
        onSelect: () => {
          selected.value = row.interview
          interviewOpen.value = true
        }
      }
    ],
    [
      {
        label: 'Delete interview',
        icon: 'i-lucide-trash-2',
        color: 'error',
        onSelect: () => {
          selected.value = row.interview
          deleteOpen.value = true
        }
      }
    ]
  ]
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const ok = await run(async () => {
    const { deleteInterview } = await gql(DELETE_INTERVIEW, { input: { id: selected.value!.id } })
    return deleteInterview.errors
  })
  deleteOpen.value = false
  if (ok) emit('changed')
}
</script>

<template>
  <UTimeline
    :items="items"
    :default-value="active"
    reverse
    size="sm"
    :ui="{ wrapper: 'w-full min-w-0' }"
    data-testid="status-timeline"
  >
    <!-- The row menu shares the date line, so it sits top right without its own row.
         `:ui` wrapper: the content column must take the full width for it to reach the right edge. -->
    <template #date="{ item }">
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <template v-if="item.row.kind === 'interview'">
            <span
              ><time :datetime="item.row.at">{{ formatDateTime(item.row.at) }}</time> ·
              {{ relativeDays(item.row.at) }}</span
            >
            <UBadge v-if="item.row.upcoming" color="primary" variant="subtle" size="sm"
              >Upcoming</UBadge
            >
          </template>
          <time v-else :datetime="item.row.at">{{ formatInstantDate(item.row.at) }}</time>
        </div>
        <UDropdownMenu :items="menu(item.row)" :content="{ align: 'end' }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis-vertical"
            class="size-11 shrink-0 justify-center"
            :aria-label="`Actions for ${item.row.label}`"
            data-testid="timeline-row-menu"
          />
        </UDropdownMenu>
      </div>
    </template>

    <template #title="{ item }">
      <span
        class="break-words font-medium text-highlighted"
        :data-testid="item.row.kind === 'interview' ? 'timeline-interview' : 'timeline-status'"
        >{{ item.row.label }}</span
      >
    </template>

    <template #description="{ item }">
      <div class="space-y-1">
        <LazyAppMarkdownContent v-if="item.row.note" :source="item.row.note" />
        <div
          v-if="item.row.kind === 'status' && item.row.sent.length"
          class="flex flex-col items-start gap-1"
          data-testid="listing-documents"
        >
          <span class="text-muted">Sent:</span>
          <!-- `external` because /api/** is a proxied backend route, not a Nuxt page. -->
          <UButton
            v-for="doc in item.row.sent"
            :key="doc.id"
            :to="`/api/documents/${doc.id}`"
            external
            target="_blank"
            variant="link"
            size="sm"
            icon="i-lucide-file-text"
            class="min-w-0 items-start p-0"
          >
            <span class="whitespace-normal break-words text-left">{{ doc.fileName }}</span>
          </UButton>
        </div>
      </div>
    </template>
  </UTimeline>

  <ListingsStatusChangeModal
    v-model:open="entryOpen"
    :entry="editingEntry"
    @changed="emit('changed')"
  />
  <ListingsInterviewModal
    v-model:open="interviewOpen"
    :listing-id="listing.id"
    :interview="selected"
    @changed="emit('changed')"
  />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete interview?"
    :description="selected?.title ?? undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>
