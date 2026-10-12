<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// The listing's way into its tailored CV: create one, or edit and copy the saved draft.
const { listingId } = defineProps<{ listingId: number }>()
const { data: draft, status, error } = useTailoredCvDraftQuery(listingId)
const copy = useCopyTailoredCv()
const editorPath = computed(() => `/listings/${listingId}/cv`)
</script>

<template>
  <AppCard title="Tailored CV" data-testid="tailored-cv-card">
    <template v-if="draft" #actions>
      <UBadge color="success" variant="subtle" icon="i-lucide-check" data-testid="tailored-cv-saved"
        >Draft saved</UBadge
      >
    </template>

    <UAlert v-if="error" color="error" variant="subtle" :description="ERROR_MESSAGES.generic" />
    <USkeleton v-else-if="status === 'idle' || status === 'pending'" class="h-16 w-full" />
    <div v-else-if="draft" class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted">
        Updated {{ formatDateTime(draft.updatedAt) }}. Editing the profile doesn't change it.
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="subtle"
          data-testid="tailored-cv-card-copy"
          @click="copy(tailoredCvFromContent(draft.content))"
          >Copy as text</UButton
        >
        <UButton
          :to="editorPath"
          icon="i-lucide-pencil"
          color="neutral"
          variant="subtle"
          data-testid="tailored-cv-card-edit"
          >Edit</UButton
        >
      </div>
    </div>
    <div
      v-else
      class="flex flex-col items-center gap-3 py-4 text-center"
      data-testid="tailored-cv-card-empty"
    >
      <UIcon name="i-lucide-file-pen-line" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        No tailored CV yet. AI picks what in your profile fits this listing; you review it before
        saving.
      </p>
      <UButton :to="editorPath" icon="i-lucide-sparkles" data-testid="tailored-cv-card-create"
        >Create draft</UButton
      >
    </div>
  </AppCard>
</template>
