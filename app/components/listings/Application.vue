<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ListingDetail } from '~/composables/useListing'
import type { Outcome } from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: []; archive: [] }>()

const status = computed(() => listing.status)
const current = computed(() => listing.statusHistory.at(-1))
const finished = computed(() => FINISHED_STATUSES.includes(status.value))
const context = computed(() => applicationContext(listing))

// Which outcomes to offer; the API enforces the actual transition rules. From an offer, the API's
// REJECTED means the company withdrew it and WITHDRAWN means we declined.
const outcomes = computed((): Outcome[] => {
  if (status.value === 'APPLIED' || status.value === 'INTERVIEWING')
    return ['OFFER', 'REJECTED', 'WITHDRAWN']
  if (status.value === 'OFFER') return ['ACCEPTED', 'REJECTED', 'WITHDRAWN']
  return []
})
// The same words the timeline will show once it's saved ("Declined by you" after an offer).
const outcomeLabels = computed(() =>
  Object.fromEntries(outcomes.value.map((o) => [o, statusLabel(o, status.value)]))
)
const appliedAt = computed(
  () => listing.statusHistory.find((e) => e.status === 'APPLIED')?.occurredAt
)
const canAddInterview = computed(() => ['APPLIED', 'INTERVIEWING'].includes(status.value))
// While an interview is coming up there's nothing to do but wait, so no button is primary.
// With none ahead, recording how it went is the likely next step.
const outcomeIsPrimary = computed(
  () => status.value === 'INTERVIEWING' && !context.value.nextInterview
)

const hasActions = computed(
  () =>
    status.value === 'SAVED' || outcomes.value.length > 0 || (finished.value && !listing.archivedAt)
)

const otherApplications = computed(() => {
  const count = listing.company.applicationCount
  return `You've applied to ${count} other ${count === 1 ? 'listing' : 'listings'} at ${listing.company.name}.`
})
const interviewingNote = computed(() =>
  current.value?.status === 'INTERVIEWING' ? current.value.note : null
)

const applyOpen = ref(false)
// Mounted on first open: it fetches the tailored CV draft, which the page doesn't need until then.
const applyOpened = useOpenedOnce(applyOpen)
const outcomeOpen = ref(false)
const interviewOpen = ref(false)
const entryOpen = ref(false)

const {
  label: undoLabel,
  request: requestUndo,
  confirm: confirmUndo,
  confirmOpen: undoOpen,
  confirmTitle: undoTitle,
  confirmDescription: undoDescription,
  loading: undoing
} = useUndoStatusChange(
  () => listing,
  () => emit('changed')
)

// The current status's own menu: undo exists only for the newest change, so it lives here and not
// on a timeline row. The Interviewing change has no row, so this is also where its note is edited.
const menu = computed((): DropdownMenuItem[][] => {
  const entry = current.value
  if (!entry || status.value === 'SAVED') return []
  const groups: DropdownMenuItem[][] = [
    [
      {
        label: entry.status === 'INTERVIEWING' ? 'Edit Interviewing note' : 'Edit date and note',
        icon: 'i-lucide-pencil',
        onSelect: () => (entryOpen.value = true)
      }
    ]
  ]
  if (undoLabel.value && !listing.archivedAt)
    groups.push([
      {
        label: undoLabel.value,
        icon: 'i-lucide-undo-2',
        disabled: undoing.value,
        onSelect: requestUndo
      }
    ])
  return groups
})
</script>

<template>
  <AppCard title="Application">
    <template v-if="menu.length" #actions>
      <UDropdownMenu :items="menu" :content="{ align: 'end' }">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-ellipsis-vertical"
          class="size-11 justify-center"
          aria-label="Application status actions"
          data-testid="application-menu"
        />
      </UDropdownMenu>
    </template>

    <div class="space-y-6">
      <div class="space-y-4">
        <div class="space-y-1 text-sm text-muted" data-testid="application-context">
          <p class="break-words">{{ context.line }}</p>
          <p
            v-if="status === 'SAVED' && listing.company.applicationCount"
            class="break-words"
            data-testid="listing-application-count"
          >
            {{ otherApplications }}
          </p>
          <LazyAppMarkdownContent v-if="interviewingNote" :source="interviewingNote" />
          <p v-if="finished">Application finished.</p>
        </div>

        <div v-if="hasActions" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <UButton
            v-if="status === 'SAVED'"
            icon="i-lucide-send"
            class="justify-center"
            data-testid="listing-apply"
            @click="applyOpen = true"
            >Record application</UButton
          >
          <UButton
            v-if="canAddInterview"
            icon="i-lucide-calendar-plus"
            :color="status === 'APPLIED' ? 'primary' : 'neutral'"
            :variant="status === 'APPLIED' ? 'solid' : 'outline'"
            class="justify-center"
            data-testid="interview-add"
            @click="interviewOpen = true"
            >Add interview</UButton
          >
          <UButton
            v-if="outcomes.length"
            :icon="status === 'OFFER' ? 'i-lucide-handshake' : 'i-lucide-flag'"
            :color="status === 'OFFER' || outcomeIsPrimary ? 'primary' : 'neutral'"
            :variant="status === 'OFFER' || outcomeIsPrimary ? 'solid' : 'outline'"
            class="justify-center"
            data-testid="listing-record-outcome"
            @click="outcomeOpen = true"
            >{{ status === 'OFFER' ? 'Record decision' : 'Record outcome' }}</UButton
          >
          <UButton
            v-if="finished && !listing.archivedAt"
            icon="i-lucide-archive"
            color="neutral"
            variant="subtle"
            class="justify-center"
            data-testid="application-archive"
            @click="emit('archive')"
            >Archive listing</UButton
          >
        </div>
      </div>

      <ListingsApplicationTimeline
        v-if="status !== 'SAVED'"
        :listing="listing"
        @changed="emit('changed')"
      />
    </div>

    <LazyListingsApplyModal
      v-if="applyOpened"
      v-model:open="applyOpen"
      :listing="listing"
      @changed="emit('changed')"
    />
    <ListingsOutcomeModal
      v-model:open="outcomeOpen"
      :listing-id="listing.id"
      :outcomes="outcomes"
      :labels="outcomeLabels"
      :title="status === 'OFFER' ? 'Record decision' : 'Record outcome'"
      :applied-at="appliedAt"
      @changed="emit('changed')"
    />
    <ListingsInterviewModal
      v-model:open="interviewOpen"
      :listing-id="listing.id"
      :interview="null"
      :moves-to-interviewing="status === 'APPLIED'"
      @changed="emit('changed')"
    />
    <ListingsStatusChangeModal
      v-model:open="entryOpen"
      :entry="current ?? null"
      @changed="emit('changed')"
    />
    <AppConfirmModal
      v-model:open="undoOpen"
      :title="undoTitle"
      :description="undoDescription"
      confirm-label="Undo"
      :loading="undoing"
      @confirm="confirmUndo"
    />
  </AppCard>
</template>
