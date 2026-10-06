<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
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

    <!-- Drag starts from the grip only, so the switch stays clickable and touch scrolling still works. -->
    <VueDraggable
      v-model="draft"
      tag="ul"
      handle=".drag-handle"
      ghost-class="opacity-50"
      :animation="150"
      :disabled="saving"
      class="divide-y divide-default"
    >
      <li
        v-for="w in draft"
        :key="w.widget"
        class="flex items-center gap-3 py-3"
        data-testid="dashboard-editor-row"
      >
        <UButton
          icon="i-lucide-grip-vertical"
          color="neutral"
          variant="ghost"
          :disabled="saving"
          :aria-label="`Drag ${DASHBOARD_WIDGETS[w.widget].label} to reorder`"
          class="drag-handle cursor-grab touch-none"
          data-testid="dashboard-editor-handle"
        />
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
      </li>
    </VueDraggable>

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
