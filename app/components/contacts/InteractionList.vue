<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContactInteraction } from '~/composables/contactFields'
import { CONTACT_CHANNEL_OPTIONS, CONTACT_DIRECTION_OPTIONS } from '~/constants/contact'

// Newest first, as the page fetches them.
defineProps<{ interactions: readonly ContactInteraction[] }>()
const emit = defineEmits<{ edit: [ContactInteraction]; delete: [ContactInteraction] }>()

const direction = (i: ContactInteraction) =>
  CONTACT_DIRECTION_OPTIONS.find((o) => o.value === i.direction)!
const channel = (i: ContactInteraction) =>
  CONTACT_CHANNEL_OPTIONS.find((o) => o.value === i.channel)!

const menu = (i: ContactInteraction): DropdownMenuItem[] => [
  { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit', i) },
  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('delete', i) }
]
</script>

<template>
  <ol class="divide-y divide-default" data-testid="interactions">
    <li
      v-for="i in interactions"
      :key="i.id"
      class="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
      data-testid="interaction"
    >
      <!-- Received ones stand out, since a reply is what the log is waiting for. -->
      <UIcon
        :name="direction(i).icon"
        class="mt-0.5 size-5 shrink-0"
        :class="i.direction === 'RECEIVED' ? 'text-primary' : 'text-muted'"
      />
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <p class="font-medium text-highlighted">
            {{ direction(i).verb }} · {{ channel(i).label }}
          </p>
          <time :datetime="i.occurredAt" class="text-sm text-muted">{{
            formatDateTime(i.occurredAt)
          }}</time>
        </div>
        <LazyAppMarkdownContent v-if="i.note" :source="i.note" class="text-sm" />
        <p v-if="i.followUpOn" class="flex items-center gap-1 text-sm text-muted">
          <UIcon name="i-lucide-bell" class="size-4 shrink-0" />
          Follow up by {{ formatDate(i.followUpOn) }}
        </p>
      </div>
      <UDropdownMenu :items="menu(i)" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Actions for the ${formatDateTime(i.occurredAt)} interaction`"
          data-testid="interaction-actions"
        />
      </UDropdownMenu>
    </li>
  </ol>
</template>
