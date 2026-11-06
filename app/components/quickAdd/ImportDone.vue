<script setup lang="ts">
// An import with nothing left to save: what happened, and the way on.
defineProps<{
  reviewed: boolean
  summary: string
  nextImportId: number | null
  marking: boolean
}>()
defineEmits<{ markReviewed: []; next: [] }>()
</script>

<template>
  <UCard data-testid="quick-add-import-done">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div class="flex items-start gap-3" role="status">
        <UIcon
          :name="reviewed ? 'i-lucide-circle-check' : 'i-lucide-check-check'"
          class="mt-0.5 size-5 shrink-0"
          :class="reviewed ? 'text-success' : 'text-muted'"
        />
        <div>
          <h2 class="font-semibold text-highlighted">
            {{
              !reviewed ? 'Nothing left to save' : nextImportId ? 'Import done' : 'All caught up'
            }}
          </h2>
          <p class="text-sm text-muted">{{ summary }}</p>
        </div>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row-reverse md:shrink-0">
        <!-- Nothing left to process, so no save will mark this one reviewed. -->
        <UButton
          v-if="!reviewed"
          icon="i-lucide-check"
          :loading="marking"
          class="justify-center"
          data-testid="quick-add-import-reviewed"
          @click="$emit('markReviewed')"
          >Mark import reviewed</UButton
        >
        <UButton
          v-if="nextImportId"
          trailing-icon="i-lucide-arrow-right"
          :variant="reviewed ? 'solid' : 'outline'"
          :color="reviewed ? 'primary' : 'neutral'"
          class="justify-center"
          data-testid="quick-add-done-next"
          @click="$emit('next')"
          >Next import</UButton
        >
        <UButton
          to="/listings"
          :variant="reviewed && !nextImportId ? 'solid' : 'outline'"
          :color="reviewed && !nextImportId ? 'primary' : 'neutral'"
          class="justify-center"
          >View listings</UButton
        >
      </div>
    </div>
  </UCard>
</template>
