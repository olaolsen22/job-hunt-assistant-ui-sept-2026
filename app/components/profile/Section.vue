<script setup lang="ts">
// A profile card: title, rows in the default slot, and one centered empty state with the Add action.
// The header Add shows only when there is content, so an empty card has a single Add button.
// A section that isn't added to (the summary) fills `actions` itself instead.
defineProps<{
  title: string
  icon: string
  empty: boolean
  emptyMessage: string
  addLabel: string
  testid: string
}>()
const emit = defineEmits<{ add: [] }>()
</script>

<template>
  <AppCard :title="title" :data-testid="testid">
    <template #actions>
      <slot name="actions">
        <UButton
          v-if="!empty"
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
