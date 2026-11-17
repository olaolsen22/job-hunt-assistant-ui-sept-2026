<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Cover letter' })

const route = useRoute()
const id = Number(route.params.id)
useBackLink({ to: `/listings/${id}`, label: 'Listing' })

// The draft request starts alongside the listing's; only the listing is waited for.
const listingQuery = useListing(id)
const editor = useCoverLetterDraft(id)
const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await listingQuery
const { letter, dirty, candidate, reviewing } = editor
const notify = useAppToast()

useListingTitle(listing, 'Cover letter')

watch(editor.query.status, () => editor.init(), { immediate: true })

const loadError = computed(
  () => (!listing.value && listingError.value) || editor.query.error.value || editor.initError.value
)
const busy = computed(
  () =>
    editor.generating.value ||
    editor.previewing.value ||
    editor.generatingPdf.value ||
    // Save swaps in the API's normalized copy, which would drop text typed meanwhile.
    editor.saving.value
)
const hasBody = computed(() => !!letter.value && hasCoverLetterBody(letter.value))

// One dialog for every way to a new letter; ⋮ Paste a letter opens it on its paste tab.
const sourceOpen = ref(false)
const sourcePaste = ref(false)
const openSource = (paste = false) => {
  sourcePaste.value = paste
  sourceOpen.value = true
}
const detailsOpen = ref(false)

// The paragraph list: reorder, remove, and "Start writing" focuses the new first paragraph.
const paragraphsEl = useTemplateRef<HTMLElement>('paragraphs')
const moveParagraph = (from: number, to: number) => {
  const paragraphs = letter.value!.paragraphs
  paragraphs.splice(to, 0, ...paragraphs.splice(from, 1))
}
// One tap removes a whole paragraph, so Undo puts it back where it was.
const removeParagraph = (i: number) => {
  const paragraphs = letter.value!.paragraphs
  const [removed] = paragraphs.splice(i, 1)
  if (!removed?.trim()) return
  notify.undoable('Paragraph removed', () => paragraphs.splice(i, 0, removed), {
    icon: 'i-lucide-undo-2'
  })
}
const addParagraph = async () => {
  letter.value!.paragraphs.push('')
  await nextTick()
  const all = paragraphsEl.value?.querySelectorAll('textarea')
  all?.[all.length - 1]?.focus()
}

// While a new letter waits, the card shows it, with the owner's own a tab away when it has text.
const SOURCE_BADGE = { builtin: 'Built-in AI', own: 'Your own AI', text: 'Pasted' } as const
const reviewTab = ref<'new' | 'mine'>('new')
watch(candidate, () => (reviewTab.value = 'new'))
const REVIEW_TABS = [
  { label: 'New letter', value: 'new' },
  { label: 'Current letter', value: 'mine' }
]
// A whole (possibly charged) AI letter goes in one tap, so Undo brings it back.
const discardNew = () => {
  const undo = editor.discardCandidate()
  if (!undo) return
  notify.undoable('New letter discarded', undo, {
    icon: 'i-lucide-undo-2'
  })
}

// The PDF to preview and apply with: the one just generated, else the listing's newest unsent
// cover letter. It's current when created after the last save and nothing is edited since.
const {
  confirmOpen: deletePdfOpen,
  target: pdfToDelete,
  deleting: deletingPdf,
  ask: askDeletePdf,
  confirm: deletePdf,
  isDeleted
} = useDeleteDocument(() => refreshListing())
const pdf = computed(
  () =>
    (editor.generated.value && !isDeleted(editor.generated.value.id)
      ? editor.generated.value
      : undefined) ??
    (listing.value &&
      latestUnsentDocument(
        listing.value.documents.filter((d) => !isDeleted(d.id)),
        'COVER_LETTER'
      ))
)
const pdfCurrent = computed(
  () =>
    !!pdf.value &&
    !!editor.draft.value &&
    !dirty.value &&
    Date.parse(pdf.value.createdAt) >= Date.parse(editor.draft.value.updatedAt)
)
const saveStatus = computed(() => {
  if (dirty.value) return editor.pristine.value ? 'Not saved yet' : 'Unsaved changes'
  if (!pdf.value) return 'Saved · no PDF yet'
  return pdfCurrent.value ? 'Saved · PDF is up to date' : 'Saved · PDF is older than this letter'
})

const pdfOpen = ref(false)
const generatePdf = async () => {
  if (!(await editor.generatePdf())) return
  pdfOpen.value = true
  await refreshListing()
}
// One PDF button whose label follows the state, like the tailored CV's.
const pdfLabel = computed(() =>
  editor.generatingPdf.value
    ? 'Creating PDF…'
    : dirty.value || !editor.draft.value
      ? 'Save and create PDF'
      : pdfCurrent.value
        ? 'Open PDF'
        : 'Create PDF'
)
const pdfAction = () => (pdfCurrent.value ? (pdfOpen.value = true) : generatePdf())

// Applying from the PDF preview: the Apply dialog preselects this letter's newest unsent PDF, and
// gets the newest unsent CV too, then returns to the listing, refreshed so it shows Applied.
const canApply = computed(() => listing.value?.status === 'SAVED')
const cvPdf = computed(() => listing.value && latestUnsentDocument(listing.value.documents, 'CV'))
const applyOpen = ref(false)
const openApply = () => {
  pdfOpen.value = false
  applyOpen.value = true
}
const onApplied = async () => {
  await refreshListing()
  await navigateTo(`/listings/${id}`)
}

// Plain-text copies for application forms without a PDF upload; they follow unsaved edits.
const { copy } = useCopyAsText('cover letter')
const copyText = async (includeHeader: boolean) => {
  if (letter.value && (await copy(coverLetterToText(letter.value, includeHeader))))
    notify.success(includeHeader ? 'Letter copied with header' : 'Letter text copied', {
      icon: 'i-lucide-copy'
    })
}
const moreItems = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Paste a letter…',
    icon: 'i-lucide-clipboard-paste',
    disabled: busy.value,
    onSelect: () => openSource(true)
  },
  {
    label: 'Copy letter text',
    icon: 'i-lucide-copy',
    disabled: !hasBody.value,
    onSelect: () => copyText(false)
  },
  {
    label: 'Copy with header',
    icon: 'i-lucide-copy-plus',
    disabled: !hasBody.value,
    onSelect: () => copyText(true)
  }
])

// Leaving with unsaved work or a new letter not used yet asks first.
const { open: leaveOpen, leave } = useLeaveConfirm(
  () => (dirty.value && !editor.pristine.value) || reviewing.value
)
const leaveDescription = computed(() =>
  reviewing.value
    ? `The new letter${dirty.value && !editor.pristine.value ? ' and your unsaved changes' : ''} will be discarded.`
    : 'Your cover letter has unsaved changes. They will be lost.'
)
</script>

<template>
  <div class="flex justify-center">
    <!-- Two columns from 2xl, so the cap lifts there (the layout caps this route at 80rem). -->
    <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6 2xl:max-w-none">
      <div class="space-y-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-xl font-semibold text-highlighted">Cover letter</h1>
            <p
              v-if="listing"
              class="break-words text-sm text-muted"
              data-testid="cover-letter-listing"
            >
              {{ listing.title }} · {{ listing.company.name }}
            </p>
          </div>
          <div v-if="letter" class="flex w-full items-center gap-2 sm:w-auto">
            <!-- Quiet while a new letter waits, so the review stays the next step. -->
            <UButton
              icon="i-lucide-sparkles"
              :color="reviewing ? 'neutral' : 'primary'"
              :variant="reviewing ? 'outline' : 'solid'"
              class="flex-1 justify-center sm:flex-none"
              :loading="editor.generating.value"
              :disabled="busy"
              data-testid="cover-letter-source"
              @click="openSource()"
              >Write with AI</UButton
            >
            <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                aria-label="More letter actions"
                data-testid="cover-letter-more"
              />
            </UDropdownMenu>
          </div>
        </div>
      </div>

      <UAlert
        v-if="!listingLoading && !listing && !listingError"
        color="error"
        title="Listing not found"
        description="It may have been deleted."
        :actions="[
          { label: 'Back to listings', to: '/listings', color: 'neutral', variant: 'outline' }
        ]"
      />
      <UAlert v-else-if="loadError" color="error" data-testid="cover-letter-load-error">
        <template #description>
          {{ ERROR_MESSAGES.generic }}
          <span class="mt-1 block break-words text-xs">{{
            typeof loadError === 'string' ? loadError : errorDetail(loadError)
          }}</span>
        </template>
      </UAlert>

      <div v-else-if="!letter" class="space-y-4" data-testid="cover-letter-loading">
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-80 w-full" />
      </div>

      <fieldset v-else :disabled="busy" class="min-w-0 space-y-4 sm:space-y-6">
        <!-- From 2xl the details sit beside the letter. They come first in the DOM (and on narrow
             screens) because they're short; grid placement puts the letter on the left. -->
        <div class="grid gap-4 sm:gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:items-start">
          <ListingsCoverLetterDetails
            v-model:letter="letter"
            v-model:open="detailsOpen"
            :disabled="busy"
            :resetting="editor.resettingHeader.value"
            class="2xl:col-start-2 2xl:row-start-1"
            @reset-header="editor.resetHeader()"
          >
            <CvPdfLatestRow
              v-if="pdf"
              :pdf="pdf"
              :current="pdfCurrent"
              older-than="letter"
              testid-prefix="cover-letter"
              class="mt-3 border-t border-default pt-3"
              @preview="pdfOpen = true"
              @delete="askDeletePdf(pdf)"
            />
          </ListingsCoverLetterDetails>

          <AppCard
            v-if="candidate"
            title="Review new letter"
            class="2xl:col-start-1 2xl:row-start-1"
            data-testid="cover-letter-review"
          >
            <template #actions>
              <UBadge color="info" variant="subtle" data-testid="cover-letter-review-source">{{
                SOURCE_BADGE[candidate.source]
              }}</UBadge>
            </template>
            <div class="space-y-4">
              <UTabs
                v-if="hasBody"
                v-model="reviewTab"
                :items="REVIEW_TABS"
                :content="false"
                data-testid="cover-letter-review-tabs"
              />
              <ListingsCoverLetterText
                :letter="reviewTab === 'mine' && hasBody ? letter : candidate.letter"
                :name="letter.fullName"
              />
            </div>
          </AppCard>

          <AppCard
            v-else
            title="Letter"
            class="2xl:col-start-1 2xl:row-start-1"
            data-testid="cover-letter-body"
          >
            <div class="space-y-4">
              <UFormField label="Subject">
                <UInput
                  v-model="letter.subject"
                  class="w-full"
                  data-testid="cover-letter-subject"
                />
              </UFormField>
              <UFormField label="Greeting" help="Leave empty for Norwegian letters.">
                <UInput
                  v-model="letter.greeting"
                  placeholder="Dear Hiring Manager,"
                  class="w-full"
                  data-testid="cover-letter-greeting"
                />
              </UFormField>
              <fieldset ref="paragraphs" class="space-y-3">
                <legend class="mb-2 text-sm font-medium">Paragraphs</legend>
                <div
                  v-if="!letter.paragraphs.length"
                  class="flex flex-col items-center gap-3 py-4 text-center"
                  data-testid="cover-letter-no-paragraphs"
                >
                  <UIcon name="i-lucide-mail" class="size-8 text-muted" />
                  <p class="max-w-sm text-sm text-muted">
                    No letter text yet. Write it yourself, paste one you have, or use Write with AI.
                  </p>
                  <div class="flex flex-wrap justify-center gap-2">
                    <UButton
                      icon="i-lucide-pen-line"
                      color="neutral"
                      variant="subtle"
                      data-testid="cover-letter-start"
                      @click="addParagraph"
                      >Start writing</UButton
                    >
                    <UButton
                      icon="i-lucide-clipboard-paste"
                      color="neutral"
                      variant="subtle"
                      data-testid="cover-letter-start-paste"
                      @click="openSource(true)"
                      >Paste a letter</UButton
                    >
                  </div>
                </div>
                <div
                  v-for="(_, i) in letter.paragraphs"
                  :key="i"
                  class="flex items-start gap-2"
                  data-testid="cover-letter-paragraph"
                >
                  <UTextarea
                    v-model="letter.paragraphs[i]"
                    :rows="3"
                    :maxrows="14"
                    autoresize
                    class="flex-1"
                    :aria-label="`Paragraph ${i + 1}`"
                  />
                  <div class="flex shrink-0 flex-col">
                    <UButton
                      icon="i-lucide-arrow-up"
                      color="neutral"
                      variant="ghost"
                      :disabled="i === 0"
                      :aria-label="`Move paragraph ${i + 1} up`"
                      @click="moveParagraph(i, i - 1)"
                    />
                    <UButton
                      icon="i-lucide-arrow-down"
                      color="neutral"
                      variant="ghost"
                      :disabled="i === letter.paragraphs.length - 1"
                      :aria-label="`Move paragraph ${i + 1} down`"
                      @click="moveParagraph(i, i + 1)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="neutral"
                      variant="ghost"
                      :aria-label="`Remove paragraph ${i + 1}`"
                      @click="removeParagraph(i)"
                    />
                  </div>
                </div>
                <UButton
                  v-if="letter.paragraphs.length"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  data-testid="cover-letter-add-paragraph"
                  @click="addParagraph"
                  >Add paragraph</UButton
                >
              </fieldset>
              <UFormField label="Closing">
                <UInput
                  v-model="letter.closing"
                  placeholder="Kind regards,"
                  class="w-full"
                  data-testid="cover-letter-closing"
                />
              </UFormField>
              <p class="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span data-testid="cover-letter-signed"
                  >Signed {{ letter.fullName.trim() || '—' }}</span
                >
                <UButton
                  variant="link"
                  color="primary"
                  size="sm"
                  class="p-0"
                  data-testid="cover-letter-signed-edit"
                  @click="detailsOpen = true"
                  >{{ letter.fullName.trim() ? 'Edit details' : 'Add your name' }}</UButton
                >
              </p>
            </div>
          </AppCard>
        </div>

        <UAlert
          v-if="editor.pdfError.value"
          color="error"
          :description="editor.pdfError.value"
          data-testid="cover-letter-pdf-error"
        />

        <ListingsCoverLetterReviewBar
          v-if="candidate"
          @use="editor.acceptCandidate()"
          @discard="discardNew"
        />
        <!-- Hidden on an untouched empty letter, where it would cover the empty state's buttons
             and offer nothing to do. -->
        <AppSaveBar
          v-else-if="hasBody || !editor.pristine.value"
          :status="saveStatus"
          status-testid="cover-letter-save-status"
          :changed="dirty"
          :warn="dirty && !editor.pristine.value"
          data-testid="cover-letter-save-bar"
        >
          <UButton
            icon="i-lucide-save"
            color="neutral"
            variant="outline"
            :loading="
              editor.saving.value && !editor.generatingPdf.value && !editor.generating.value
            "
            :disabled="!dirty"
            class="w-full justify-center sm:w-auto"
            data-testid="cover-letter-save"
            @click="editor.save()"
            >Save draft</UButton
          >
          <UButton
            :icon="pdfCurrent ? 'i-lucide-eye' : 'i-lucide-file-down'"
            :loading="editor.generatingPdf.value"
            :disabled="!hasBody"
            :title="hasBody ? undefined : 'Add some letter text first'"
            class="w-full justify-center sm:w-auto"
            data-testid="cover-letter-generate-pdf"
            @click="pdfAction"
            >{{ pdfLabel }}</UButton
          >
        </AppSaveBar>
      </fieldset>
    </div>

    <ListingsCoverLetterModal
      v-if="letter"
      v-model:open="sourceOpen"
      :editor="editor"
      :listing-id="id"
      :paste="sourcePaste"
    />

    <LazyListingsTailoredCvPdfModal
      v-if="pdf"
      v-model:open="pdfOpen"
      :url="`/api/documents/${pdf.id}`"
      :file-name="pdf.fileName"
      :applicable="canApply"
      @apply="openApply"
    />

    <LazyListingsApplyModal
      v-if="listing && canApply"
      v-model:open="applyOpen"
      :listing="listing"
      :cv-document-id="cvPdf?.id"
      @changed="onApplied"
    />

    <AppConfirmModal
      v-model:open="leaveOpen"
      title="Leave without saving?"
      :description="leaveDescription"
      confirm-label="Leave"
      @confirm="leave"
    />

    <AppConfirmModal
      v-model:open="deletePdfOpen"
      title="Delete this PDF?"
      :description="pdfToDelete?.fileName"
      confirm-label="Delete PDF"
      :loading="deletingPdf"
      @confirm="deletePdf"
    />
  </div>
</template>
