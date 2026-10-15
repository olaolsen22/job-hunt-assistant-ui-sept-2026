<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type { CoverLetterSource } from '~/components/listings/CoverLetterModal.vue'

definePageMeta({ title: 'Cover letter' })

const DELETE_DOCUMENT = graphql(`
  mutation DeleteDocument($input: DeleteDocumentInput!) {
    deleteDocument(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

// The API prints line 1 as the street and line 2 as postcode and town, splitting one line at a comma.
const ADDRESS_HELP = 'Street and number on line 1, postcode and town on line 2.'

const route = useRoute()
const id = Number(route.params.id)

const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await useListing(id)
const editor = useCoverLetterDraft(id)
const { letter, dirty } = editor

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

// The header is prefilled and rarely changed, so it starts closed once a letter is saved.
const headerOpen = ref(false)
watch(
  () => !!letter.value,
  (ready) => {
    if (ready) headerOpen.value = !editor.draft.value
  },
  { immediate: true }
)

const sourceOpen = ref(false)
const source = ref<CoverLetterSource>('ai')
const openSource = (value: CoverLetterSource) => {
  source.value = value
  sourceOpen.value = true
}
const sourceItems: DropdownMenuItem[] = [
  { label: 'Generate with AI', icon: 'i-lucide-sparkles', onSelect: () => openSource('ai') },
  { label: 'Use an external chat', icon: 'i-lucide-bot', onSelect: () => openSource('json') },
  {
    label: 'Paste my own letter',
    icon: 'i-lucide-clipboard-paste',
    onSelect: () => openSource('text')
  }
]

const moveParagraph = (from: number, to: number) => {
  const paragraphs = letter.value!.paragraphs
  paragraphs.splice(to, 0, ...paragraphs.splice(from, 1))
}

const saveStatus = computed(() =>
  dirty.value ? (editor.pristine.value ? 'Not saved yet' : 'Unsaved changes') : 'Saved'
)

// The PDF to preview: the one just generated, else the listing's newest unsent cover letter.
const deletedPdfIds = ref<number[]>([])
const pdf = computed(
  () =>
    (editor.generated.value && !deletedPdfIds.value.includes(editor.generated.value.id)
      ? editor.generated.value
      : undefined) ??
    (listing.value &&
      latestUnsentDocument(
        listing.value.documents.filter((d) => !deletedPdfIds.value.includes(d.id)),
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
const pdfOpen = ref(false)
const generatePdf = async () => {
  if (!(await editor.generatePdf())) return
  pdfOpen.value = true
  await refreshListing()
}

const deletePdfOpen = ref(false)
const pdfToDelete = ref<{ id: number; fileName: string } | null>(null)
const selectPdfForDeletion = () => {
  if (!pdf.value || pdf.value.sentAt) return
  pdfToDelete.value = { id: pdf.value.id, fileName: pdf.value.fileName }
  deletePdfOpen.value = true
}
const { run: runDeleteDocument, loading: deletingPdf } = useMutation(refreshListing)
const toast = useToast()
const deletePdf = async () => {
  const target = pdfToDelete.value
  if (!target) return
  const ok = await runDeleteDocument(async () => {
    const { deleteDocument } = await gql(DELETE_DOCUMENT, { input: { id: target.id } })
    return deleteDocument.errors
  })
  deletePdfOpen.value = false
  pdfToDelete.value = null
  if (ok) {
    deletedPdfIds.value = [...deletedPdfIds.value, target.id]
    toast.add({ title: 'PDF deleted', color: 'success', icon: 'i-lucide-check' })
  }
  await refreshListing()
}

// Leaving with unsaved work asks first; closing or reloading the tab gets the browser's own warning.
const leaveOpen = ref(false)
const leaveTo = ref('')
let leaving = false
const unsaved = () => dirty.value && !editor.pristine.value
onBeforeRouteLeave((to) => {
  if (leaving || !unsaved()) return true
  leaveTo.value = to.fullPath
  leaveOpen.value = true
  return false
})
const leave = () => {
  leaving = true
  leaveOpen.value = false
  navigateTo(leaveTo.value)
}
const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  if (unsaved()) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6">
      <div class="space-y-2">
        <UButton
          :to="`/listings/${id}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="self-start"
          >Back to listing</UButton
        >
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
        <USkeleton class="h-20 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>

      <template v-else>
        <AppCard>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-muted">
              Write the body yourself, or get one from AI or your own earlier letter, then save.
            </p>
            <UDropdownMenu :items="sourceItems" :content="{ align: 'end' }" :disabled="busy">
              <UButton
                icon="i-lucide-pen-line"
                trailing-icon="i-lucide-chevron-down"
                class="justify-center"
                :loading="editor.generating.value || editor.previewing.value"
                data-testid="cover-letter-source"
                >Write the body</UButton
              >
            </UDropdownMenu>
          </div>
        </AppCard>

        <UAlert
          v-if="editor.candidateLoaded.value"
          color="info"
          variant="subtle"
          icon="i-lucide-file-check"
          title="Letter loaded. Not saved yet."
          description="Review it, then save. Discard brings back what you had."
          :actions="[
            {
              label: 'Discard',
              color: 'neutral',
              variant: 'outline',
              onClick: editor.discard
            }
          ]"
          data-testid="cover-letter-loaded"
        />

        <fieldset :disabled="busy" class="min-w-0 space-y-4 sm:space-y-6">
          <AppCard title="Letter" data-testid="cover-letter-body">
            <div class="space-y-4">
              <UFormField label="Greeting" help="Leave empty for Norwegian letters.">
                <UInput
                  v-model="letter.greeting"
                  placeholder="Dear Hiring Manager,"
                  class="w-full"
                  data-testid="cover-letter-greeting"
                />
              </UFormField>
              <fieldset class="space-y-3">
                <legend class="mb-2 text-sm font-medium">Paragraphs</legend>
                <div
                  v-if="!letter.paragraphs.length"
                  class="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted"
                  data-testid="cover-letter-no-paragraphs"
                >
                  <UIcon name="i-lucide-text" class="size-6" />
                  No paragraphs yet. Add one, or use Write the body.
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
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      :aria-label="`Remove paragraph ${i + 1}`"
                      @click="letter.paragraphs.splice(i, 1)"
                    />
                  </div>
                </div>
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  data-testid="cover-letter-add-paragraph"
                  @click="letter.paragraphs.push('')"
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
            </div>
          </AppCard>

          <AppCard title="Notes for the AI">
            <UFormField
              label="Notes"
              help="Only used when generating. Never printed in the letter."
            >
              <UTextarea
                v-model="letter.brief"
                :rows="3"
                :maxrows="10"
                :maxlength="2000"
                autoresize
                class="w-full"
                placeholder="What to stress for this job, a person you spoke to, things to leave out…"
                data-testid="cover-letter-brief"
              />
              <template #hint>{{ letter.brief.length }}/2000</template>
            </UFormField>
          </AppCard>

          <AppCard>
            <UCollapsible v-model:open="headerOpen">
              <UButton
                color="neutral"
                variant="ghost"
                block
                class="justify-between"
                :trailing-icon="headerOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                data-testid="cover-letter-header-toggle"
              >
                <span class="font-semibold text-highlighted">Header details</span>
              </UButton>
              <template #content>
                <div class="space-y-4 pt-4" data-testid="cover-letter-header">
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField label="Full name">
                      <UInput v-model="letter.fullName" class="w-full" autocomplete="name" />
                    </UFormField>
                    <UFormField label="Language">
                      <USelect
                        v-model="letter.language"
                        :items="[...LANGUAGE_OPTIONS]"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Email">
                      <UInput
                        v-model="letter.email"
                        type="email"
                        class="w-full"
                        autocomplete="email"
                      />
                    </UFormField>
                    <UFormField label="Phone">
                      <UInput v-model="letter.phone" type="tel" class="w-full" autocomplete="tel" />
                    </UFormField>
                    <UFormField label="Address" :help="ADDRESS_HELP" class="sm:col-span-2">
                      <UTextarea
                        v-model="letter.address"
                        :rows="2"
                        autoresize
                        placeholder="Storgata 1&#10;0155 Oslo"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Date">
                      <UInput v-model="letter.date" type="date" class="w-full" />
                    </UFormField>
                    <UFormField label="Organization">
                      <UInput v-model="letter.organization" class="w-full" />
                    </UFormField>
                    <UFormField label="Recipient" class="sm:col-span-2">
                      <UInput v-model="letter.recipientName" class="w-full" />
                    </UFormField>
                    <UFormField
                      label="Recipient address"
                      :help="ADDRESS_HELP"
                      class="sm:col-span-2"
                    >
                      <UTextarea
                        v-model="letter.recipientAddress"
                        :rows="2"
                        autoresize
                        placeholder="Kongens gate 2&#10;7011 Trondheim"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Subject" class="sm:col-span-2">
                      <UInput v-model="letter.subject" class="w-full" />
                    </UFormField>
                  </div>
                  <UButton
                    icon="i-lucide-rotate-ccw"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    :loading="editor.resettingHeader.value"
                    data-testid="cover-letter-reset-header"
                    @click="editor.resetHeader()"
                    >Reset header from profile</UButton
                  >
                </div>
              </template>
            </UCollapsible>
          </AppCard>

          <div
            v-if="pdf"
            class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default p-3"
            data-testid="cover-letter-latest-pdf"
          >
            <p class="flex min-w-0 items-center gap-2 text-sm">
              <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
              <span class="truncate">{{ pdf.fileName }}</span>
              <span class="shrink-0 text-muted"
                >{{ formatDateTime(pdf.createdAt)
                }}{{ pdfCurrent ? '' : ' · older than the letter' }}</span
              >
            </p>
            <div class="flex gap-2">
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="subtle"
                size="sm"
                @click="pdfOpen = true"
                >Preview</UButton
              >
              <UButton
                v-if="!pdf.sentAt"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                aria-label="Delete unsent PDF"
                data-testid="cover-letter-delete-pdf"
                @click="selectPdfForDeletion"
              />
            </div>
          </div>

          <!-- Sticky so Save stays in reach on a long letter; same bar as the tailored CV editor. -->
          <div
            class="sticky bottom-0 z-10 grid grid-cols-2 items-center gap-3 rounded-md border border-default bg-default/90 p-3 backdrop-blur sm:flex sm:flex-wrap"
            data-testid="cover-letter-save-bar"
          >
            <span
              class="order-first col-span-2 inline-flex items-center gap-1.5 text-sm text-muted sm:order-none sm:col-auto sm:flex-1 sm:justify-end"
            >
              <UIcon
                :name="dirty ? 'i-lucide-circle-dot' : 'i-lucide-check'"
                :class="dirty && !editor.pristine.value ? 'text-warning' : ''"
              />
              <span data-testid="cover-letter-save-status">{{ saveStatus }}</span>
            </span>
            <UButton
              icon="i-lucide-save"
              color="neutral"
              variant="subtle"
              :loading="editor.saving.value && !editor.generatingPdf.value"
              :disabled="!dirty"
              class="w-full justify-center sm:w-auto"
              data-testid="cover-letter-save"
              @click="editor.save()"
              >Save letter</UButton
            >
            <UButton
              icon="i-lucide-file-down"
              :loading="editor.generatingPdf.value"
              :disabled="pdfCurrent || !letter.paragraphs.some((p) => p.trim())"
              :title="
                pdfCurrent
                  ? 'The latest PDF matches the saved letter'
                  : 'Each click creates a new PDF'
              "
              class="w-full justify-center sm:w-auto"
              data-testid="cover-letter-generate-pdf"
              @click="generatePdf"
              >{{ dirty ? 'Save and generate PDF' : 'Generate PDF' }}</UButton
            >
          </div>
        </fieldset>
      </template>
    </div>

    <ListingsCoverLetterModal v-model:open="sourceOpen" :editor="editor" :source="source" />

    <LazyListingsTailoredCvPdfModal
      v-if="pdf"
      v-model:open="pdfOpen"
      :document-id="pdf.id"
      :file-name="pdf.fileName"
    />

    <AppConfirmModal
      v-model:open="leaveOpen"
      title="Leave without saving?"
      description="Your cover letter has unsaved changes. They will be lost."
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
