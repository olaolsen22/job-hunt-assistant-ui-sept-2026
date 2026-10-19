<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { DASHBOARD_WIDGETS } from '~/constants/dashboard'
import type { DashboardLayout, DashboardWidgetKind } from '~/composables/useDashboardLayout'

definePageMeta({ title: 'Dashboard' })

const { layout, loading, error, refresh } = useDashboardLayout()
const editing = ref(false)

// Hidden widgets are left out of the v-for, so they are never mounted and never send their queries.
const shown = computed(() => (layout.value ?? []).filter((w) => w.isShown))

const SPAN_CLASS = { full: 'sm:col-span-2 xl:col-span-3', 2: 'sm:col-span-2' }
const spanClass = (kind: DashboardWidgetKind) => {
  const span = DASHBOARD_WIDGETS[kind].span
  return span ? SPAN_CLASS[span] : ''
}

const onSaved = (saved: DashboardLayout) => {
  layout.value = saved
  editing.value = false
}

const health = useFetch<string>('/api/health', { responseType: 'text' })
const healthState = computed<'checking' | 'healthy' | 'databaseDown' | 'unreachable'>(() => {
  if (health.status.value === 'idle' || health.status.value === 'pending') return 'checking'
  if (health.data.value === 'Healthy') return 'healthy'
  // 503 = API up, database down. Anything else means the API itself is unreachable.
  return health.error.value?.statusCode === 503 ? 'databaseDown' : 'unreachable'
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <DashboardApiHealth :state="healthState" @recheck="health.refresh()" />
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-layout-dashboard"
        :disabled="!layout"
        data-testid="dashboard-edit"
        @click="editing = true"
        >Edit dashboard</UButton
      >
    </div>

    <!-- Widgets would fail one by one, so say why once, above them. -->
    <UAlert
      v-if="healthState === 'databaseDown' || healthState === 'unreachable'"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="
        healthState === 'unreachable'
          ? 'The API can\'t be reached, so the widgets may not load.'
          : 'The API can\'t reach its database, so the widgets may not load.'
      "
      data-testid="api-health-alert"
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :description="ERROR_MESSAGES.generic"
      :actions="[{ label: 'Retry', color: 'neutral', variant: 'subtle', onClick: () => refresh() }]"
      data-testid="dashboard-layout-error"
    />

    <div
      v-else-if="loading"
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      data-testid="dashboard-layout-loading"
    >
      <USkeleton class="h-32 sm:col-span-2 xl:col-span-3" />
      <USkeleton v-for="i in 3" :key="i" class="h-32" />
    </div>

    <div
      v-else-if="shown.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      data-testid="dashboard-empty"
    >
      <UIcon name="i-lucide-layout-dashboard" class="size-10 text-muted" />
      <p class="text-sm text-muted">All widgets are hidden.</p>
      <UButton color="neutral" variant="subtle" @click="editing = true">Edit dashboard</UButton>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <!-- A grid wrapper per widget: it stretches the card to the row height (the empty state centers
           in it) and carries the column span, which a widget root with a leading comment couldn't take. -->
      <div v-for="w in shown" :key="w.widget" class="grid" :class="spanClass(w.widget)">
        <component :is="DASHBOARD_WIDGETS[w.widget].component" />
      </div>
    </div>

    <DashboardEditor v-if="layout" v-model:open="editing" :layout="layout" @saved="onSaved" />
  </div>
</template>
