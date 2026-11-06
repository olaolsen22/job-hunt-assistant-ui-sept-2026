<script setup lang="ts">
// Keyed by URL so moving to the next import remounts the page (import id is read once at setup).
definePageMeta({ title: 'Quick add listings', key: (route) => route.fullPath })

const route = useRoute()
const importId = Number(route.query.import) || null

const form = useTemplateRef('form')
const rows = useQuickAddRows(() => form.value?.validate({ silent: true }))
const { state, pending, savedCount, failedCount, unsaved, pastedCount, saving, saveError } = rows
// An import goes straight to its rows: the paste and AI steps never show there.
const paste = useQuickAddPaste(rows, !!importId)
const { open: pasteOpen, addedDirectly, collectedMode, prepared, processing } = paste
const { hasUnsavedWork, checkError } = paste
const runStatus = paste.batchRun.status
const imports = useQuickAddImport(importId, rows, paste)
const { info: importInfo, error: importError, reviewed: importReviewed } = imports
const { loading: importLoading, done: importDone, nextImportId } = imports

const onSave = async () => {
  if (processing.value || saving.value) return
  if (!(await rows.save())) return
  if (!hasUnsavedWork.value) await imports.markReviewed()
  // A lone, unflagged listing has nothing left to review here, so open it. Not for an import: its
  // done state leads on to the next one.
  const [only] = state.rows
  if (!importId && state.rows.length === 1 && only?.saved && !isFlaggedRow(only)) {
    await navigateTo(`/listings/${only.saved.id}`)
  }
}

const leaveOpen = ref(false)
const leaveDestination = ref('/listings')
const leaveReason = ref<'leave' | 'edit' | 'restart'>('leave')
let allowRouteLeave = false
const requestLeave = (destination: string) => {
  if (allowRouteLeave || !hasUnsavedWork.value) return true
  leaveDestination.value = destination
  leaveReason.value = 'leave'
  leaveOpen.value = true
  return false
}
onBeforeRouteLeave((to) => requestLeave(to.fullPath))
const onBack = () => {
  const destination = importId ? '/listings/imports' : '/listings'
  if (requestLeave(destination)) return navigateTo(destination)
}
const onNextImport = () => {
  const destination = `/listings/quick-add?import=${nextImportId.value}`
  if (requestLeave(destination)) return navigateTo(destination)
}
const requestEditCollected = () => {
  if (!hasUnsavedWork.value) return paste.editCollected()
  leaveReason.value = 'edit'
  leaveOpen.value = true
}
const restartCollected = () => {
  leaveReason.value = 'restart'
  leaveOpen.value = true
}
const confirmDiscard = async () => {
  leaveOpen.value = false
  if (leaveReason.value === 'edit' || leaveReason.value === 'restart') {
    paste.editCollected()
    return
  }
  paste.batchRun.invalidate()
  allowRouteLeave = true
  try {
    await navigateAfterConfirm(leaveDestination.value)
  } finally {
    allowRouteLeave = false
  }
}
</script>

<template>
  <UForm
    ref="form"
    :state="state"
    :validate="rows.validate"
    class="space-y-4"
    data-testid="quick-add-form"
    @submit="onSave"
  >
    <!-- Standalone (home-screen) mode has no browser Back, and the bottom one is a long scroll away.
         In import mode this is the only exit, sticky on phones, so catching up never needs a scroll. -->
    <div
      class="flex items-center justify-between gap-2"
      :class="
        importId
          ? 'sticky top-0 z-10 -mx-4 border-b border-default bg-default px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0'
          : ''
      "
    >
      <UButton
        icon="i-lucide-arrow-left"
        :variant="importId ? 'outline' : 'ghost'"
        color="neutral"
        data-testid="quick-add-back-top"
        @click="onBack"
      >
        {{ importId ? 'Back to imports' : 'Back' }}
      </UButton>
      <!-- Hidden once done: the done state's primary button takes over. -->
      <UButton
        v-if="importId && nextImportId && !importDone"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="ghost"
        data-testid="quick-add-next-import"
        @click="onNextImport"
      >
        Skip to next
      </UButton>
    </div>

    <p v-if="collectedMode && !importId" class="text-sm text-muted" data-testid="quick-add-stages">
      Check duplicates → Add as rows → Review → Save
    </p>
    <UAlert
      v-if="importError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="importInfo ? 'This file couldn’t be imported' : 'Couldn’t open the import'"
      :description="importError"
      :actions="[
        { label: 'Back to imports', to: '/listings/imports', color: 'neutral', variant: 'outline' },
        ...(nextImportId
          ? [
              {
                label: 'Next import',
                to: `/listings/quick-add?import=${nextImportId}`,
                color: 'neutral' as const,
                variant: 'outline' as const
              }
            ]
          : [])
      ]"
      data-testid="quick-add-import-error"
    />
    <p v-else-if="importInfo" class="text-sm text-muted" data-testid="quick-add-import">
      From import: {{ importLabel(importInfo) }} · {{ importInfo.itemCount }}
      {{ importInfo.itemCount === 1 ? 'job' : 'jobs' }}
    </p>

    <div v-if="importLoading" class="space-y-3" data-testid="quick-add-import-loading">
      <USkeleton v-for="i in 2" :key="i" class="h-48 w-full" />
    </div>
    <UAlert
      v-else-if="importId && checkError"
      color="error"
      icon="i-lucide-circle-alert"
      :title="checkError"
      data-testid="quick-add-check-error"
    />

    <template v-if="importDone">
      <QuickAddImportDone
        :reviewed="importReviewed"
        :summary="imports.summary.value"
        :next-import-id="nextImportId"
        :marking="imports.marking.value"
        @mark-reviewed="imports.markReviewed()"
        @next="onNextImport"
      />
      <ListingsImportJobs :jobs="imports.jobs.value" />
    </template>

    <QuickAddPasteCard
      v-if="pasteOpen && !importDone"
      :paste="paste"
      :saving="saving"
      @edit="requestEditCollected"
    />

    <div
      v-else-if="!importDone && pastedCount"
      class="flex items-center justify-between gap-2"
      data-testid="quick-add-paste-summary"
    >
      <p class="text-sm text-muted">
        <template v-if="runStatus !== 'idle'">Prepared {{ pastedCount }} drafts.</template>
        <template v-else-if="addedDirectly"
          >Added {{ pastedCount }} collected {{ pastedCount === 1 ? 'job' : 'jobs' }}.</template
        >
        <template v-else
          >Pasted {{ pastedCount }} {{ pastedCount === 1 ? 'listing' : 'listings' }}.</template
        >
        {{ pending.length ? 'Check them below, then save.' : 'All saved.' }}
      </p>
      <UButton
        v-if="!importId"
        icon="i-lucide-clipboard-paste"
        color="neutral"
        variant="ghost"
        data-testid="quick-add-paste-more"
        :disabled="processing || saving"
        @click="collectedMode && prepared ? requestEditCollected() : (pasteOpen = true)"
        >Paste more</UButton
      >
    </div>

    <QuickAddRunStatus
      v-if="runStatus !== 'idle'"
      :paste="paste"
      :saving="saving"
      @edit="requestEditCollected"
      @restart="restartCollected"
    />

    <QuickAddReview :rows="rows" :processing="processing" :hide-added="importDone" />

    <h2
      v-if="savedCount && unsaved.length"
      class="font-semibold text-highlighted"
      data-testid="quick-add-unsaved"
    >
      Not saved ({{ unsaved.length }})
    </h2>

    <QuickAddRow
      v-for="row in unsaved"
      :key="row.key"
      :row="row"
      :processing="processing"
      @remove="rows.remove(row)"
    />

    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="saveError"
    />

    <QuickAddActions
      v-if="!importDone && (!importId || state.rows.length)"
      :pending-count="pending.length"
      :saved-count="savedCount"
      :failed-count="failedCount"
      :importing="!!importId"
      :unsaved-work="hasUnsavedWork"
      :saving="saving"
      :processing="processing"
      @add-row="rows.addEmpty()"
      @back="onBack"
      @save="form?.submit()"
    />

    <AppConfirmModal
      v-model:open="leaveOpen"
      :title="
        leaveReason !== 'leave'
          ? 'Reset collected jobs?'
          : processing
            ? 'Leave batch processing?'
            : pending.length
              ? `Leave ${pending.length} unsaved ${pending.length === 1 ? 'listing' : 'listings'}?`
              : 'Leave collected jobs?'
      "
      :description="
        leaveReason !== 'leave'
          ? 'Checked input, batch progress, and this run’s unsaved drafts will be reset. Earlier review rows and saved listings are kept.'
          : 'Unsaved listings, checked input, and batch progress will be lost. Saved listings are kept.'
      "
      :confirm-label="leaveReason === 'leave' ? 'Leave' : 'Reset'"
      @confirm="confirmDiscard"
    />
  </UForm>
</template>
