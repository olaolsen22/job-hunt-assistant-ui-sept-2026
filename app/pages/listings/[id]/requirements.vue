<script setup lang="ts">
definePageMeta({ title: 'Requirements' })
const id = Number(useRoute().params.id)
useBackLink({ to: `/listings/${id}`, label: 'Listing' })
const listingQuery = useListing(id)
const {
  profile,
  loading: profileLoading,
  error: profileError,
  refresh: refreshProfile
} = useProfile()
const editor = useRequirementMap(id, profile)
const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await listingQuery

useListingTitle(listing, 'Requirements')
const {
  needs,
  dirty,
  initialized,
  candidateLoaded,
  submitted,
  issues,
  countIssue,
  error,
  saving,
  deleting
} = editor
const aiOpen = ref(false)
const deleteOpen = ref(false)
const busy = computed(
  () => saving.value || deleting.value || editor.generating.value || editor.previewing.value
)
const loadError = computed(
  () => listingError.value || editor.query.error.value || profileError.value
)
const ready = computed(
  () =>
    !!listing.value &&
    !!profile.value &&
    initialized.value &&
    !loadError.value &&
    !profileLoading.value
)
const retry = () => Promise.all([refreshListing(), editor.query.refresh(), refreshProfile()])
const { open: leaveOpen, leave } = useLeaveConfirm(() => dirty.value)
const save = async () => {
  if (await editor.save()) return
  await nextTick()
  const first = issues.value.findIndex(Boolean)
  document
    .querySelector<HTMLElement>(`[data-testid="requirement-text-${Math.max(0, first)}"]`)
    ?.focus()
  document
    .querySelector<HTMLElement>(`[data-testid="requirement-need-${Math.max(0, first)}"]`)
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
const remove = async () => {
  if (!(await editor.remove())) return
  deleteOpen.value = false
  await navigateTo(`/listings/${id}`)
}
</script>
<template>
  <div class="mx-auto w-full max-w-4xl space-y-4 pb-4 sm:space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold text-highlighted">Requirements</h1>
      <p v-if="listing" class="text-sm text-muted break-words">
        {{ listing.title }} · {{ listing.company.name }}
      </p>
    </header>
    <UAlert
      v-if="loadError"
      color="error"
      title="Couldn’t load the requirements editor"
      :description="genericError(loadError)"
      :actions="[{ label: 'Retry', onClick: retry }]"
    />
    <USkeleton
      v-else-if="
        listingLoading ||
        profileLoading ||
        editor.query.status.value === 'pending' ||
        editor.query.status.value === 'idle'
      "
      class="h-32 w-full"
    />
    <UAlert v-else-if="!listing || !profile" color="error" title="Listing or profile not found" />
    <template v-else-if="ready">
      <div data-testid="requirements-ready" class="space-y-4 sm:space-y-6">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-sparkles"
            :disabled="busy"
            data-testid="requirement-ai-open"
            @click="aiOpen = true"
            >Map with AI</UButton
          >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="busy || needs.length >= 30"
            @click="needs.push(newRequirementNeed())"
            >Add requirement</UButton
          >
          <span class="text-sm text-muted">{{ needs.length }} / 30 requirements</span>
        </div>
        <p v-if="needs.length >= 30" class="text-sm text-muted">
          A map can contain at most 30 requirements.
        </p>
        <UAlert
          v-if="candidateLoaded"
          title="Unsaved candidate — review before saving"
          color="info"
          icon="i-lucide-info"
          description="The API may have removed unknown evidence, changed unsupported matches to gaps, shortened text or limited the map to 30 needs. This may differ from the AI reply. Unsaved work is lost on reload."
        >
          <template #actions
            ><UButton
              color="neutral"
              variant="outline"
              :disabled="busy"
              data-testid="requirement-discard"
              @click="editor.discard"
              >Discard candidate</UButton
            ></template
          >
        </UAlert>
        <p
          v-if="
            editor.query.data.value &&
            requirementMapStale(editor.query.data.value.updatedAt, listing!.updatedAt)
          "
          class="text-sm text-muted"
        >
          This map may be out of date because the listing changed.
        </p>
        <div
          v-if="!needs.length"
          class="space-y-2 rounded-lg border border-default p-6 text-center"
        >
          <UIcon name="i-lucide-list-checks" class="size-8 text-muted" />
          <p class="text-sm text-muted">
            No requirements yet. Map with AI or add a requirement by hand, then review and save.
          </p>
        </div>
        <fieldset :disabled="busy" class="min-w-0 space-y-4">
          <ListingsRequirementNeedRow
            v-for="(_, index) in needs"
            :key="index"
            v-model="needs[index]!"
            :index="index"
            :profile="profile!"
            :issue="submitted ? issues[index] : ''"
            @remove="needs.splice(index, 1)"
          />
        </fieldset>
        <AppSaveBar
          :status="dirty ? 'Unsaved changes' : editor.query.data.value ? 'Saved' : 'Not saved yet'"
          status-testid="requirements-status"
          :changed="dirty"
          :warn="dirty"
        >
          <template #above>
            <UAlert
              v-if="error || (submitted && countIssue)"
              color="error"
              :title="error || countIssue"
              data-testid="requirements-save-error"
            />
          </template>
          <UButton
            :loading="saving"
            :disabled="busy || !dirty"
            class="w-full justify-center sm:w-auto"
            data-testid="requirements-save"
            @click="save"
            >Save requirements</UButton
          >
          <UButton
            v-if="editor.query.data.value"
            color="error"
            variant="ghost"
            :disabled="busy"
            class="w-full justify-center sm:w-auto"
            data-testid="requirements-delete"
            @click="deleteOpen = true"
            >Delete map</UButton
          >
        </AppSaveBar>
        <ListingsRequirementMapAiModal v-model:open="aiOpen" :editor="editor" />
      </div>
    </template>
    <AppConfirmModal
      v-model:open="deleteOpen"
      title="Delete requirement map?"
      description="This deletes the saved map and discards any unsaved edits."
      confirm-label="Delete map"
      color="error"
      :loading="deleting"
      @confirm="remove"
    />
    <AppConfirmModal
      v-model:open="leaveOpen"
      title="Leave without saving?"
      description="Your unsaved requirements will be lost."
      confirm-label="Leave"
      @confirm="leave"
    />
  </div>
</template>
