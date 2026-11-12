<script setup lang="ts">
// A titled overview section: a card, or on phones a collapsed row with its item count so the
// page stays short. The content is the same either way.
const {
  title,
  count = undefined,
  collapsible = false
} = defineProps<{
  title: string
  count?: number
  collapsible?: boolean
}>()

const open = ref(false)
</script>

<template>
  <UCollapsible
    v-if="collapsible"
    v-model:open="open"
    class="rounded-lg bg-default ring ring-default"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      size="lg"
      class="justify-between"
      trailing-icon="i-lucide-chevron-down"
      :ui="{ trailingIcon: open ? 'rotate-180 transition-transform' : 'transition-transform' }"
    >
      <span class="flex items-center gap-2 font-semibold">
        {{ title }}
        <UBadge v-if="count !== undefined" color="neutral" variant="subtle">{{ count }}</UBadge>
      </span>
    </UButton>
    <template #content>
      <div class="px-4 pt-1 pb-4"><slot /></div>
    </template>
  </UCollapsible>
  <AppCard v-else :title="title"><slot /></AppCard>
</template>
