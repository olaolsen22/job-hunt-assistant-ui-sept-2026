<script setup lang="ts">
defineProps<{ id: number; title: string; company: string }>()
</script>

<template>
  <!-- One link for the whole row: a touch-sized target with nothing clickable nested inside. -->
  <NuxtLink
    :to="`/listings/${id}`"
    class="-mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-2 hover:bg-elevated"
    data-testid="dashboard-row"
  >
    <div class="min-w-0 flex-1">
      <p class="truncate font-medium text-highlighted">{{ title }}</p>
      <p class="truncate text-sm text-muted">{{ company }}</p>
    </div>
    <div class="shrink-0 text-right text-sm text-muted"><slot /></div>
  </NuxtLink>
</template>
