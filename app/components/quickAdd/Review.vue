<script setup lang="ts">
import type { QuickAddRow, QuickAddRows } from '~/composables/useQuickAddRows'

// What's been saved: rows the API flagged, to look at first, then the rest. An import's done state
// lists them itself, hence `hideAdded`.
const { rows } = defineProps<{ rows: QuickAddRows; processing: boolean; hideAdded: boolean }>()

const { flagged, added, deleting } = rows
const { success: toastSuccess } = useAppToast()
const addedOpen = ref(false)

const toRemove = ref<QuickAddRow>()
const confirmOpen = ref(false)
const askRemove = (row: QuickAddRow) => {
  toRemove.value = row
  confirmOpen.value = true
}
const removeSaved = async (row: QuickAddRow) => {
  if (await rows.deleteSaved(row)) toastSuccess('Listing removed')
  confirmOpen.value = false
}

const compareRow = ref<QuickAddRow>()
const compareId = ref(0)
const compareOpen = ref(false)
const openCompare = (row: QuickAddRow) => {
  compareRow.value = row
  compareId.value = row.duplicates![0]!.id
  compareOpen.value = true
}
const onCompareKeep = () => {
  compareOpen.value = false
  rows.keepBoth(compareRow.value!)
  toastSuccess('Kept both listings')
}
// The compare modal confirms in its own footer. Removing the new row unmounts it; removing an
// existing match shows the next one, or closes once none are left.
const onCompareRemove = async (side: 'new' | 'existing') => {
  const row = compareRow.value!
  if (side === 'new') return removeSaved(row)
  if (!(await rows.deleteMatch(row, compareId.value))) return
  if (row.duplicates) compareId.value = row.duplicates[0]!.id
  else compareOpen.value = false
  toastSuccess('Existing listing removed')
}
</script>

<template>
  <section v-if="flagged.length" class="space-y-3" data-testid="quick-add-review">
    <div>
      <h2 class="font-semibold text-highlighted">Needs a look ({{ flagged.length }})</h2>
      <p class="text-sm text-muted">Saved, but may match a listing you already have.</p>
    </div>
    <UCard v-for="row in flagged" :key="row.key" data-testid="quick-add-row-saved">
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-circle-check" class="mt-0.5 size-5 shrink-0 text-success" />
        <div class="min-w-0 flex-1 space-y-1">
          <NuxtLink
            :to="`/listings/${row.saved.id}`"
            class="font-medium text-highlighted hover:underline"
            >{{ row.saved.title }}</NuxtLink
          >
          <p class="text-sm text-muted">{{ row.companyName }} · {{ row.jobRoleName }}</p>
          <!-- The API's cleaned-up URL, which can differ from what was typed. -->
          <ULink
            v-if="row.saved.url"
            :to="row.saved.url"
            target="_blank"
            class="block truncate text-sm"
            >{{ row.saved.url }}</ULink
          >
        </div>
      </div>

      <ListingsPossibleDuplicates
        v-if="row.duplicates"
        :matches="row.duplicates"
        :disabled="processing"
        testid-prefix="quick-add-row"
        class="mt-3"
        @compare="openCompare(row)"
        @keep="rows.keepBoth(row)"
        @remove="askRemove(row)"
      />

      <UAlert
        v-if="row.previousAttempts"
        color="neutral"
        variant="subtle"
        icon="i-lucide-history"
        title="Applied to this URL before"
        class="mt-3"
        data-testid="quick-add-row-previous-attempts"
      >
        <template #description>
          <ul class="space-y-1">
            <li
              v-for="attempt in row.previousAttempts"
              :key="attempt.id"
              class="flex flex-wrap items-center gap-x-2"
            >
              <NuxtLink
                :to="`/listings/${attempt.id}`"
                target="_blank"
                class="font-medium hover:underline"
                >{{ attempt.title }}</NuxtLink
              >
              <ListingsStatusBadge :status="attempt.status" />
            </li>
          </ul>
          <UButton
            color="neutral"
            variant="subtle"
            class="mt-3"
            data-testid="quick-add-row-got-it"
            :disabled="processing"
            @click="rows.acknowledgeAttempts(row)"
            >Got it</UButton
          >
        </template>
      </UAlert>
    </UCard>
  </section>

  <UCollapsible v-if="added.length && !hideAdded" v-model:open="addedOpen">
    <UButton
      color="neutral"
      variant="subtle"
      icon="i-lucide-circle-check"
      :trailing-icon="addedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      block
      data-testid="quick-add-added-toggle"
      >{{ added.length }} {{ added.length === 1 ? 'listing' : 'listings' }} added</UButton
    >
    <template #content>
      <UCard class="mt-2" data-testid="quick-add-added">
        <ul class="divide-y divide-default">
          <li v-for="row in added" :key="row.key" class="min-w-0 py-2 first:pt-0 last:pb-0">
            <NuxtLink
              :to="`/listings/${row.saved.id}`"
              class="block truncate font-medium text-highlighted hover:underline"
              >{{ row.saved.title }}</NuxtLink
            >
            <p class="truncate text-sm text-muted">{{ row.companyName }} · {{ row.jobRoleName }}</p>
          </li>
        </ul>
      </UCard>
    </template>
  </UCollapsible>

  <ListingsCompareModal
    v-if="compareRow?.saved && compareRow.duplicates"
    v-model:open="compareOpen"
    v-model:match-id="compareId"
    :listing="compareRow.saved"
    :matches="compareRow.duplicates"
    :loading="deleting"
    @keep="onCompareKeep"
    @remove="onCompareRemove"
  />

  <AppConfirmModal
    v-model:open="confirmOpen"
    title="Remove this listing?"
    :description="toRemove?.saved?.title"
    confirm-label="Remove"
    :loading="deleting"
    @confirm="removeSaved(toRemove!)"
  />
</template>
