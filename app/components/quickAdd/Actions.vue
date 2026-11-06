<script setup lang="ts">
// With rows to save, Save stays in reach on phones instead of a long scroll down, as a band matching
// the import's sticky top bar. Add row sits beside Save to keep the band short.
defineProps<{
  pendingCount: number
  savedCount: number
  failedCount: number
  importing: boolean
  unsavedWork: boolean
  saving: boolean
  processing: boolean
}>()
defineEmits<{ addRow: []; back: []; save: [] }>()
</script>

<template>
  <div
    class="flex items-end gap-2 sm:items-center"
    :class="
      pendingCount
        ? 'sticky bottom-0 z-10 -mx-4 border-t border-default bg-default px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0'
        : ''
    "
    data-testid="quick-add-actions"
  >
    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="ghost"
      class="shrink-0 justify-center"
      data-testid="quick-add-add-row"
      :disabled="processing || saving"
      @click="$emit('addRow')"
      >Add row</UButton
    >
    <div
      class="flex min-w-0 flex-1 flex-col-reverse gap-2 sm:ml-auto sm:flex-none sm:flex-row sm:items-center"
    >
      <!-- No Done/Cancel: a leave action named by where it goes can't be mistaken for saving. -->
      <UButton
        v-if="savedCount && !unsavedWork"
        to="/listings"
        class="justify-center"
        data-testid="quick-add-view-listings"
        >View listings</UButton
      >
      <template v-else>
        <!-- An import's only exit is the top bar, so Save stands alone here. -->
        <UButton
          v-if="!importing"
          color="neutral"
          variant="ghost"
          class="justify-center"
          data-testid="quick-add-back"
          @click="$emit('back')"
          >Back to listings</UButton
        >
        <!-- Not type="submit": with no submit button, Enter in a row field can't save every row. -->
        <UButton
          :loading="saving"
          :disabled="!pendingCount || processing"
          class="justify-center"
          data-testid="quick-add-save"
          @click="$emit('save')"
          >Save {{ pendingCount || '' }} {{ pendingCount === 1 ? 'listing' : 'listings' }}</UButton
        >
      </template>
      <!-- Last in the DOM so it sits on top in the reversed phone stack, first from sm up. -->
      <p
        v-if="savedCount"
        class="flex items-center justify-center gap-3 text-sm text-muted sm:order-first"
        data-testid="quick-add-status"
      >
        <span class="flex items-center gap-1">
          <UIcon name="i-lucide-circle-check" class="size-4 text-success" />
          {{ savedCount }} saved
        </span>
        <span v-if="failedCount" class="flex items-center gap-1">
          <UIcon name="i-lucide-circle-alert" class="size-4 text-error" />
          {{ failedCount }} {{ failedCount === 1 ? 'needs' : 'need' }} fixing
        </span>
      </p>
    </div>
  </div>
</template>
