<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  title: string
  icon: string
  // Tints the header icon (a token class such as `text-warning`).
  iconClass?: string
  to?: RouteLocationRaw
  loading: boolean
  error: boolean
  empty: boolean
  emptyText: string
  // Matches in total, shown when the widget lists fewer rows than that.
  total?: number
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <!-- Grid neighbors stretch to the same height; no built-in prop lets the body grow, so :ui does it,
       letting the empty state sit in the middle of the card instead of hugging the header. -->
  <UCard
    :ui="{ root: 'flex flex-col', body: 'flex flex-1 flex-col' }"
    data-testid="dashboard-widget"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex min-w-0 items-center gap-2 font-semibold text-highlighted">
          <UIcon :name="icon" class="size-5 shrink-0" :class="iconClass ?? 'text-muted'" />
          <span class="truncate">{{ title }}</span>
          <UBadge
            v-if="total"
            color="neutral"
            variant="subtle"
            data-testid="dashboard-widget-total"
            >{{ total }}</UBadge
          >
        </h3>
        <UButton
          v-if="to"
          :to="to"
          color="neutral"
          variant="link"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
          >View all</UButton
        >
      </div>
    </template>

    <div v-if="loading" class="space-y-2">
      <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
    </div>
    <!-- Laid out like the empty state, but it names the widget: several can fail at once. -->
    <div
      v-else-if="error"
      class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center"
      data-testid="dashboard-widget-error"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-8 text-error" />
      <p class="text-sm text-muted">{{ title }} couldn't load.</p>
      <UButton color="neutral" variant="subtle" size="sm" @click="$emit('retry')">Retry</UButton>
    </div>
    <!-- Same centered icon + text as the empty states on /listings and /companies. -->
    <div
      v-else-if="empty"
      class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center"
      data-testid="dashboard-widget-empty"
    >
      <UIcon :name="icon" class="size-8 text-muted" />
      <p class="text-sm text-muted">{{ emptyText }}</p>
    </div>
    <slot v-else />
  </UCard>
</template>
