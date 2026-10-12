<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { ListingDetail } from '~/composables/useListing'

// The listing's way into its tailored CV: tailor one, or edit and copy the saved draft, preview its
// latest PDF and apply with it.
const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()
const { data: draft, status, error } = useTailoredCvDraftQuery(listing.id)
const copy = useCopyTailoredCv()
const editorPath = computed(() => `/listings/${listing.id}/cv`)
const pdf = computed(() => latestCvDocument(listing.documents))
const canApply = computed(() => listing.status === 'SAVED')

const pdfOpen = ref(false)
const applyOpen = ref(false)
const openApply = () => {
  pdfOpen.value = false
  applyOpen.value = true
}
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
    <div v-else-if="draft" class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
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
        v-if="pdf"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3"
        data-testid="tailored-cv-card-pdf"
      >
        <p class="flex min-w-0 items-center gap-2 text-sm">
          <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
          <span class="truncate">{{ pdf.fileName }}</span>
          <span class="shrink-0 text-muted">{{ formatDateTime(pdf.createdAt) }}</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-eye"
            color="neutral"
            variant="subtle"
            data-testid="tailored-cv-card-preview"
            @click="pdfOpen = true"
            >Preview</UButton
          >
          <UButton
            v-if="canApply"
            icon="i-lucide-send"
            data-testid="tailored-cv-card-apply"
            @click="applyOpen = true"
            >Apply with this CV</UButton
          >
        </div>
      </div>
    </div>
    <div
      v-else
      class="flex flex-col items-center gap-3 py-4 text-center"
      data-testid="tailored-cv-card-empty"
    >
      <UIcon name="i-lucide-file-pen-line" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        No tailored CV yet. Start from your profile, let AI pick what fits this listing, then make a
        PDF to apply with.
      </p>
      <UButton :to="editorPath" icon="i-lucide-sparkles" data-testid="tailored-cv-card-create"
        >Tailor CV</UButton
      >
    </div>

    <LazyListingsTailoredCvPdfModal
      v-if="pdf"
      v-model:open="pdfOpen"
      :document-id="pdf.id"
      :file-name="pdf.fileName"
      :applicable="canApply"
      @apply="openApply"
    />
    <LazyListingsApplyModal
      v-if="pdf && canApply"
      v-model:open="applyOpen"
      :listing="listing"
      :cv-document-id="pdf.id"
      @changed="emit('changed')"
    />
  </AppCard>
</template>
