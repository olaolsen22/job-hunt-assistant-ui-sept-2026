<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// One menu per profile row (entry, skill, language, reference), so the CV reads without a pencil
// and a trash can on every line.
const {
  name,
  removeLabel = 'Delete',
  refine = false
} = defineProps<{
  name: string
  removeLabel?: 'Delete' | 'Remove'
  // Adds "Refine bullets with AI", for rows that have bullets.
  refine?: boolean
  testid: string
}>()
const emit = defineEmits<{ edit: []; remove: []; refine: [] }>()

const items = computed<DropdownMenuItem[]>(() => [
  { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit') },
  ...(refine
    ? [
        {
          label: 'Refine bullets with AI',
          icon: 'i-lucide-sparkles',
          onSelect: () => emit('refine')
        }
      ]
    : []),
  {
    label: removeLabel,
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => emit('remove')
  }
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-ellipsis-vertical"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="`Actions for ${name}`"
      class="shrink-0"
      :data-testid="testid"
    />
  </UDropdownMenu>
</template>
