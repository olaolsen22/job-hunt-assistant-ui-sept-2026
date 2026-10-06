<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { DASHBOARD_WIDGETS } from '~/constants/dashboard'
import type { DashboardLayout, DashboardWidgetKind } from '~/composables/useDashboardLayout'

const props = defineProps<{ layout: DashboardLayout }>()
const emit = defineEmits<{ saved: [layout: DashboardLayout]; cancel: [] }>()

const SAVE_LAYOUT = graphql(`
  mutation SaveDashboardLayout($input: SaveDashboardLayoutInput!) {
    saveDashboardLayout(input: $input) {
      layout {
        widget
        isShown
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

// Edits happen on a copy, so Cancel is just dropping it and the dashboard only changes after a save.
const draft = ref(props.layout.map((w) => ({ ...w })))
const saving = ref(false)
const errorMessage = ref('')

const move = (index: number, by: -1 | 1) => {
  const [item] = draft.value.splice(index, 1)
  draft.value.splice(index + by, 0, item!)
}

// The API has no reset and no default-order field. The server's default is the enum's declaration order,
// which DASHBOARD_WIDGETS mirrors, so a reset is just that order with everything shown. Still a draft until Save.
const resetToDefault = () => {
  draft.value = (Object.keys(DASHBOARD_WIDGETS) as DashboardWidgetKind[]).map((widget) => ({
    widget,
    isShown: true
  }))
}

const save = async () => {
  saving.value = true
  errorMessage.value = ''
  try {
    const { saveDashboardLayout } = await gql(SAVE_LAYOUT, { input: { widgets: draft.value } })
    if (saveDashboardLayout.errors?.length || !saveDashboardLayout.layout) {
      errorMessage.value = saveDashboardLayout.errors?.[0]?.message ?? ERROR_MESSAGES.generic
      return
    }
    emit('saved', saveDashboardLayout.layout)
  } catch {
    errorMessage.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard data-testid="dashboard-editor">
    <template #header>
      <h2 class="font-semibold text-highlighted">Edit dashboard</h2>
      <p class="text-sm text-muted">Choose what to show and in what order.</p>
    </template>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :description="errorMessage"
      class="mb-4"
      data-testid="dashboard-editor-error"
    />

    <ul class="divide-y divide-default">
      <li
        v-for="(w, i) in draft"
        :key="w.widget"
        class="flex items-center gap-3 py-3"
        data-testid="dashboard-editor-row"
      >
        <UIcon
          :name="DASHBOARD_WIDGETS[w.widget].icon"
          class="size-5 shrink-0 text-muted"
          :class="{ 'opacity-60': !w.isShown }"
        />
        <span class="min-w-0 flex-1 truncate" :class="{ 'opacity-60': !w.isShown }">{{
          DASHBOARD_WIDGETS[w.widget].label
        }}</span>
        <USwitch
          v-model="w.isShown"
          :disabled="saving"
          :aria-label="`Show ${DASHBOARD_WIDGETS[w.widget].label}`"
          data-testid="dashboard-editor-shown"
        />
        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="ghost"
          :disabled="saving || i === 0"
          :aria-label="`Move ${DASHBOARD_WIDGETS[w.widget].label} up`"
          data-testid="dashboard-editor-up"
          @click="move(i, -1)"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          :disabled="saving || i === draft.length - 1"
          :aria-label="`Move ${DASHBOARD_WIDGETS[w.widget].label} down`"
          data-testid="dashboard-editor-down"
          @click="move(i, 1)"
        />
      </li>
    </ul>

    <template #footer>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          :disabled="saving"
          class="justify-center sm:mr-auto"
          data-testid="dashboard-editor-reset"
          @click="resetToDefault"
          >Reset to default</UButton
        >
        <UButton
          color="neutral"
          variant="subtle"
          :disabled="saving"
          class="justify-center"
          data-testid="dashboard-editor-cancel"
          @click="emit('cancel')"
          >Cancel</UButton
        >
        <UButton
          :loading="saving"
          class="justify-center"
          data-testid="dashboard-editor-save"
          @click="save"
          >Save</UButton
        >
      </div>
    </template>
  </UCard>
</template>
