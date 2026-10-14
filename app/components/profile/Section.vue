<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// A profile card: title, rows in the default slot, and one centered empty state with the Add action.
// The header Add shows only when there is content, so an empty card has a single Add button.
// A section that isn't added to (the summary) fills `actions` itself instead. `full` hides Add once
// nothing more can be added (every language listed). `clearable` adds a ⋮ menu to wipe the section,
// kept in a menu since it's rare and can't be undone; an empty section has nothing to clear.
defineProps<{
  title: string
  icon: string
  empty: boolean
  emptyMessage: string
  addLabel: string
  testid: string
  full?: boolean
  clearable?: boolean
}>()
const emit = defineEmits<{ add: []; clear: [] }>()

const menu = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Clear section',
    icon: 'i-lucide-eraser',
    color: 'error',
    onSelect: () => emit('clear')
  }
])
</script>

<template>
  <AppCard :title="title" :data-testid="testid">
    <template #actions>
      <div class="flex items-center gap-1">
        <slot name="actions">
          <UButton
            v-if="!empty && !full"
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            size="sm"
            :aria-label="addLabel"
            :data-testid="`${testid}-add`"
            @click="emit('add')"
            >Add</UButton
          >
        </slot>
        <UDropdownMenu v-if="clearable && !empty" :items="menu" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Actions for ${title}`"
            :data-testid="`${testid}-menu`"
          />
        </UDropdownMenu>
      </div>
    </template>

    <div
      v-if="empty"
      class="flex flex-col items-center justify-center gap-3 py-6 text-center"
      :data-testid="`${testid}-empty`"
    >
      <UIcon :name="icon" class="size-10 text-muted" />
      <p>{{ emptyMessage }}</p>
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-plus"
        :data-testid="`${testid}-add`"
        @click="emit('add')"
        >{{ addLabel }}</UButton
      >
    </div>
    <slot v-else />
  </AppCard>
</template>
