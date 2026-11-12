<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { ListingDetail } from '~/composables/useListing'

// The listing's way into its tailored CV: tailor one, or edit and copy the saved draft, preview its
// latest PDF and apply with it.
const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

const { data: draft, status, error } = useTailoredCvDraftQuery(listing.id)
const { copied, copy } = useCopyTailoredCv()
const { reset, resetting, error: resetError } = useResetTailoredCvDraft(listing.id)
const resetOpen = ref(false)
const editorPath = computed(() => `/listings/${listing.id}/cv`)
const {
  confirmOpen: deleteOpen,
  target: pdfToDelete,
  deleting,
  ask: confirmDeletePdf,
  confirm: deletePdf,
  isDeleted
} = useDeleteDocument(() => emit('changed'))
const pdf = computed(() =>
  latestUnsentDocument(
    listing.documents.filter((document) => !isDeleted(document.id)),
    'CV'
  )
)
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

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :description="`${ERROR_MESSAGES.generic} If it keeps failing, replace the saved draft with a fresh copy of your profile.`"
    >
      <template v-if="resetError" #description>
        {{ ERROR_MESSAGES.generic }}
        <span class="mt-1 block break-words text-xs" data-testid="tailored-cv-card-reset-error">{{
          resetError
        }}</span>
      </template>
      <template #actions>
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          :loading="resetting"
          data-testid="tailored-cv-card-reset"
          @click="resetOpen = true"
          >Reset to profile</UButton
        >
      </template>
    </UAlert>
    <USkeleton v-else-if="status === 'idle' || status === 'pending'" class="h-16 w-full" />
    <!-- Split at xl: the dashboard sidebar leaves too little card width at tablet sizes. -->
    <div v-else-if="draft" class="grid gap-6" :class="{ 'xl:grid-cols-2': pdf }">
      <section class="min-w-0 space-y-4" aria-label="Saved draft">
        <div class="space-y-1">
          <h3 class="font-medium text-highlighted">Saved draft</h3>
          <p class="text-sm text-muted">Updated {{ formatDateTime(draft.updatedAt) }}</p>
          <p class="text-sm text-muted">Editing your profile doesn't change this draft.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            :to="editorPath"
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            data-testid="tailored-cv-card-edit"
            >Edit CV</UButton
          >
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            color="neutral"
            variant="ghost"
            data-testid="tailored-cv-card-copy"
            @click="copy(tailoredCvFromContent(draft.content))"
            >{{ copied ? 'Copied' : 'Copy as text' }}</UButton
          >
        </div>
      </section>
      <section
        v-if="pdf"
        class="min-w-0 space-y-4 rounded-lg border border-default bg-elevated/50 p-4"
        aria-label="Latest PDF"
        data-testid="tailored-cv-card-pdf"
      >
        <div class="space-y-1">
          <h3 class="flex items-center gap-2 font-medium text-highlighted">
            <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
            Latest PDF
          </h3>
          <p class="break-words text-sm">{{ pdf.fileName }}</p>
          <p class="text-sm text-muted">Created {{ formatDateTime(pdf.createdAt) }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="canApply"
            icon="i-lucide-check"
            class="w-full justify-center sm:w-auto"
            data-testid="tailored-cv-card-apply"
            @click="applyOpen = true"
            >Record with this CV</UButton
          >
          <UButton
            icon="i-lucide-eye"
            color="neutral"
            variant="subtle"
            data-testid="tailored-cv-card-preview"
            @click="pdfOpen = true"
            >Preview PDF</UButton
          >
          <UButton
            v-if="!pdf.sentAt"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            class="ml-auto"
            data-testid="tailored-cv-card-delete-pdf"
            @click="confirmDeletePdf(pdf)"
            >Delete PDF</UButton
          >
        </div>
      </section>
    </div>
    <div
      v-else
      class="flex flex-col items-center gap-3 py-4 text-center"
      data-testid="tailored-cv-card-empty"
    >
      <UIcon name="i-lucide-file-pen-line" class="size-8 text-muted" />
      <p class="max-w-lg text-sm text-muted">
        No tailored CV yet. Start from your profile, review it for this listing, then generate a
        PDF.
      </p>
      <UButton :to="editorPath" icon="i-lucide-file-pen-line" data-testid="tailored-cv-card-create"
        >Tailor CV</UButton
      >
    </div>

    <LazyListingsTailoredCvPdfModal
      v-if="pdf"
      v-model:open="pdfOpen"
      :url="`/api/documents/${pdf.id}`"
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
    <AppConfirmModal
      v-model:open="resetOpen"
      title="Reset to your profile?"
      description="The saved draft for this listing is replaced with a fresh copy of your profile. Generated PDFs are kept."
      confirm-label="Reset to profile"
      :loading="resetting"
      @confirm="reset().then(() => (resetOpen = false))"
    />
    <AppConfirmModal
      v-model:open="deleteOpen"
      title="Delete this PDF?"
      :description="pdfToDelete?.fileName"
      confirm-label="Delete PDF"
      :loading="deleting"
      @confirm="deletePdf"
    />
  </AppCard>
</template>
