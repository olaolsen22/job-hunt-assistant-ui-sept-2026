<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { DASHBOARD_WIDGETS } from '~/constants/dashboard'
import type { DashboardLayout } from '~/composables/useDashboardLayout'

definePageMeta({ title: 'Dashboard' })

const { layout, loading, error, refresh } = useDashboardLayout()
const editing = ref(false)

// Hidden widgets are left out of the v-for, so they are never mounted and never send their queries.
const shown = computed(() => (layout.value ?? []).filter((w) => w.isShown))

const onSaved = (saved: DashboardLayout) => {
  layout.value = saved
  editing.value = false
}
</script>

<template>
  <div class="space-y-6">
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
      class="grid gap-4 lg:grid-cols-2"
      data-testid="dashboard-layout-loading"
    >
      <USkeleton class="h-32 lg:col-span-2" />
      <USkeleton v-for="i in 4" :key="i" class="h-32" />
    </div>

    <DashboardEditor
      v-else-if="editing"
      :layout="layout!"
      @saved="onSaved"
      @cancel="editing = false"
    />

    <div
      v-else-if="shown.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      data-testid="dashboard-empty"
    >
      <UIcon name="i-lucide-layout-dashboard" class="size-10 text-muted" />
      <p class="text-sm text-muted">All widgets are hidden.</p>
      <UButton color="neutral" variant="subtle" @click="editing = true">Edit dashboard</UButton>
    </div>

    <template v-else>
      <div class="flex justify-end">
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-layout-dashboard"
          data-testid="dashboard-edit"
          @click="editing = true"
          >Edit dashboard</UButton
        >
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- A grid wrapper per widget: it stretches the card to the row height (the empty state centers
             in it) and carries the full-row span, which a widget root with a leading comment couldn't take. -->
        <div
          v-for="w in shown"
          :key="w.widget"
          class="grid"
          :class="{ 'lg:col-span-2': DASHBOARD_WIDGETS[w.widget].wide }"
        >
          <component :is="DASHBOARD_WIDGETS[w.widget].component" />
        </div>
      </div>
    </template>

    <DashboardApiHealth />
  </div>
</template>
