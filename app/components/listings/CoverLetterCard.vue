<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { ListingDetail } from '~/composables/useListing'

// The listing's way into its cover letter: write one, or edit and copy the saved letter and preview
// its latest PDF. The Record application modal offers that PDF.
const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

const { data: draft, status, error, refresh } = useCoverLetterDraftQuery(listing.id)
const editorPath = computed(() => `/listings/${listing.id}/cover-letter`)
const {
  confirmOpen: deleteOpen,
  deleting,
  ask: askDelete,
  confirm: deletePdf,
  isDeleted
} = useDeleteDocument(() => emit('changed'))
const pdf = computed(() =>
  latestUnsentDocument(
    listing.documents.filter((d) => !isDeleted(d.id)),
    'COVER_LETTER'
  )
)
const pdfStale = computed(
  () =>
    !!pdf.value &&
    !!draft.value &&
    Date.parse(pdf.value.createdAt) < Date.parse(draft.value.updatedAt)
)

// Confirms with a toast, like the editor's ⋮ copy.
const notify = useAppToast()
const { copy: copyText } = useCopyAsText('cover letter')
const copy = async () => {
  if (
    draft.value &&
    (await copyText(coverLetterToText(coverLetterFromContent(draft.value.content))))
  )
    notify.success('Letter copied as text', { icon: 'i-lucide-copy' })
}

const pdfOpen = ref(false)
</script>

<template>
  <AppCard title="Cover letter" data-testid="cover-letter-card">
    <template v-if="draft" #actions>
      <UBadge color="success" variant="subtle" icon="i-lucide-check">Letter saved</UBadge>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :description="ERROR_MESSAGES.generic"
      :actions="[
        { label: 'Retry', color: 'neutral', variant: 'outline', onClick: () => refresh() }
      ]"
    />
    <USkeleton v-else-if="status === 'idle' || status === 'pending'" class="h-16 w-full" />
    <!-- Split at xl like the tailored CV card: the sidebar leaves too little width before that. -->
    <div v-else-if="draft" class="grid gap-6" :class="{ 'xl:grid-cols-2': pdf }">
      <section class="min-w-0 space-y-4" aria-label="Saved letter">
        <div class="space-y-1">
          <h3 class="font-medium text-highlighted">Saved letter</h3>
          <p class="text-sm text-muted">Updated {{ formatDateTime(draft.updatedAt) }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            :to="editorPath"
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            data-testid="cover-letter-card-edit"
            >Edit letter</UButton
          >
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            data-testid="cover-letter-card-copy"
            @click="copy"
            >Copy as text</UButton
          >
        </div>
      </section>
      <section
        v-if="pdf"
        class="min-w-0 space-y-4 rounded-lg border border-default bg-elevated/50 p-4"
        aria-label="Latest PDF"
        data-testid="cover-letter-card-pdf"
      >
        <div class="space-y-1">
          <h3 class="flex items-center gap-2 font-medium text-highlighted">
            <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
            Latest PDF
          </h3>
          <p class="break-words text-sm">{{ pdf.fileName }}</p>
          <p class="text-sm text-muted">
            Created {{ formatDateTime(pdf.createdAt)
            }}{{ pdfStale ? ' · older than the letter' : '' }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton icon="i-lucide-eye" color="neutral" variant="subtle" @click="pdfOpen = true"
            >Preview PDF</UButton
          >
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            class="ml-auto"
            aria-label="Delete unsent cover letter PDF"
            data-testid="cover-letter-card-delete-pdf"
            @click="askDelete(pdf)"
            >Delete PDF</UButton
          >
        </div>
      </section>
    </div>
    <div
      v-else
      class="flex flex-col items-center gap-3 py-4 text-center"
      data-testid="cover-letter-card-empty"
    >
      <UIcon name="i-lucide-mail" class="size-8 text-muted" />
      <p class="max-w-lg text-sm text-muted">
        No cover letter yet. Write one for this listing, then generate a PDF.
      </p>
      <UButton :to="editorPath" icon="i-lucide-pen-line" data-testid="cover-letter-card-create"
        >Write cover letter</UButton
      >
    </div>

    <LazyListingsTailoredCvPdfModal
      v-if="pdf"
      v-model:open="pdfOpen"
      :url="`/api/documents/${pdf.id}`"
      :file-name="pdf.fileName"
    />
    <AppConfirmModal
      v-model:open="deleteOpen"
      title="Delete this PDF?"
      :description="pdf?.fileName"
      confirm-label="Delete PDF"
      :loading="deleting"
      @confirm="deletePdf"
    />
  </AppCard>
</template>
