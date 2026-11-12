<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { DASHBOARD_WIDGETS } from '~/constants/dashboard'
import type { DashboardLayout, DashboardWidgetKind } from '~/composables/useDashboardLayout'

const props = defineProps<{ layout: DashboardLayout }>()
const emit = defineEmits<{ saved: [layout: DashboardLayout] }>()
const open = defineModel<boolean>('open', { required: true })

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

const { success: toastSuccess } = useAppToast()

// Edits happen on a copy, so closing just drops it and the dashboard only changes after a save.
const copy = () => props.layout.map((w) => ({ ...w }))
const draft = ref(copy())
const saving = ref(false)
const errorMessage = ref('')

// Every opening starts from the saved layout, whatever was left in the draft last time.
watch(open, (isOpen) => {
  if (!isOpen) return
  draft.value = copy()
  errorMessage.value = ''
})

const changed = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.layout))

// The API has no reset and no default-order field. The server's default is the enum's declaration order,
// which DASHBOARD_WIDGETS mirrors, so a reset is just that order with everything shown. Still a draft until Save.
const resetToDefault = () => {
  draft.value = (Object.keys(DASHBOARD_WIDGETS) as DashboardWidgetKind[]).map((widget) => ({
    widget,
    isShown: true
  }))
}

// The keyboard and screen-reader way to reorder; dragging needs a pointer.
const moveId = (widget: DashboardWidgetKind, dir: 'up' | 'down') =>
  `dashboard-move-${widget}-${dir}`
const move = async (index: number, dir: 'up' | 'down') => {
  const to = dir === 'up' ? index - 1 : index + 1
  const list = [...draft.value]
  const [row] = list.splice(index, 1)
  list.splice(to, 0, row!)
  draft.value = list
  // Moving a row re-inserts its DOM node, which drops focus. Put it back on the same button, or on the
  // other arrow once the row reaches an end and this one is disabled.
  await nextTick()
  const atEnd = dir === 'up' ? to === 0 : to === list.length - 1
  document
    .getElementById(moveId(row!.widget, atEnd ? (dir === 'up' ? 'down' : 'up') : dir))
    ?.focus()
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
    toastSuccess('Dashboard saved')
  } catch {
    errorMessage.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Edit dashboard"
    description="Choose what to show and in what order. Changes apply when you save."
    :dismissible="!saving"
  >
    <template #body>
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage"
        role="alert"
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
          v-for="(w, i) in draft"
          :key="w.widget"
          class="flex items-center gap-2 py-2"
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
          <UButton
            :id="moveId(w.widget, 'up')"
            icon="i-lucide-arrow-up"
            color="neutral"
            variant="ghost"
            :disabled="saving || i === 0"
            :aria-label="`Move ${DASHBOARD_WIDGETS[w.widget].label} up`"
            data-testid="dashboard-editor-up"
            @click="move(i, 'up')"
          />
          <UButton
            :id="moveId(w.widget, 'down')"
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            :disabled="saving || i === draft.length - 1"
            :aria-label="`Move ${DASHBOARD_WIDGETS[w.widget].label} down`"
            data-testid="dashboard-editor-down"
            @click="move(i, 'down')"
          />
          <USwitch
            v-model="w.isShown"
            :disabled="saving"
            :aria-label="`Show ${DASHBOARD_WIDGETS[w.widget].label}`"
            class="ml-1"
            data-testid="dashboard-editor-shown"
          />
        </li>
      </VueDraggable>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
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
          @click="open = false"
          >Cancel</UButton
        >
        <UButton
          :loading="saving"
          :disabled="!changed"
          class="justify-center"
          data-testid="dashboard-editor-save"
          @click="save"
          >Save</UButton
        >
      </div>
    </template>
  </USlideover>
</template>
