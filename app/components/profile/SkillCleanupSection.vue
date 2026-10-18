<script setup lang="ts">
// One kind of suggestion in the cleanup review: a collapsible header with its count (and what is
// selected), so a long plan can be scanned section by section. `danger` frames the permanent ones.
const {
  title,
  count,
  summary = undefined,
  danger = false
} = defineProps<{
  title: string
  count: number
  summary?: string
  danger?: boolean
}>()
// Controlled by the modal as well, so "Fix N items first" can open a collapsed section.
const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <UCollapsible
    v-model:open="open"
    :unmount-on-hide="false"
    class="rounded-md"
    :class="{ 'border border-error/40 bg-error/5 p-2': danger }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="justify-between"
      trailing-icon="i-lucide-chevron-down"
      :ui="{ trailingIcon: open ? 'rotate-180 transition-transform' : 'transition-transform' }"
      data-testid="cleanup-section-toggle"
    >
      <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-left">
        <span class="flex items-center gap-1.5 font-medium" :class="{ 'text-error': danger }">
          <UIcon v-if="danger" name="i-lucide-trash-2" aria-hidden="true" />{{ title }}
        </span>
        <UBadge color="neutral" variant="subtle">{{ count }}</UBadge>
        <span v-if="summary" class="text-xs font-normal text-muted">{{ summary }}</span>
      </span>
    </UButton>
    <template #content>
      <div class="space-y-3 px-2 pt-2 pb-1"><slot /></div>
    </template>
  </UCollapsible>
</template>
