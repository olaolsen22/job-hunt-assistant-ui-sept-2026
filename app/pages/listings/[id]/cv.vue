<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CvContentStyle, CvEditorAi, TailoredCvSectionKey } from '~/utils/tailoredCv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import {
  CONTENT_STYLE_DESCRIPTION,
  CONTENT_STYLE_OPTIONS,
  SECTION_ORDER_HINTS,
  SECTION_ORDER_OPTIONS,
  TEMPLATE_HINTS,
  TEMPLATE_OPTIONS
} from '~/constants/cv'

definePageMeta({ title: 'Tailored CV' })

const route = useRoute()
const id = Number(route.params.id)

// The listing, profile and draft requests start together; only the listing is waited for.
const listingQuery = useListing(id)
const { profile, error: profileError } = useProfile()
const state = useTailoredCvDraft(
  id,
  profile,
  computed(() => listingQuery.listing.value?.postingLanguage)
)
const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await listingQuery
const { cv, dirty, suggestions, sectionErrors, sectionDetails, analyzing, analyzingKey, progress } =
  state
const copy = useCopyTailoredCv()
const { refresh: refreshUsage } = useLlmUsage(false)

// Builds the candidate once the draft and profile are in: the saved draft, or the profile as is.
// AI only runs when the owner asks.
watch(
  [profile, state.query.status],
  () => {
    if (!cv.value) state.init()
  },
  { immediate: true }
)
// Loaded up front, so "Copy prompt" is a direct write (browsers can refuse one after an await).
onMounted(() => state.loadPrompt())

// A failed refresh after generating keeps the listing it already has, so it isn't a load error.
const loadError = computed(
  () => (!listing.value && listingError.value) || profileError.value || state.query.error.value
)
const busy = computed(() => analyzing.value || !!analyzingKey.value || state.previewing.value)

// A failed delete refetches (the PDF may be gone or sent already); a deleted one drops the
// just-generated copy too.
const {
  confirmOpen: deletePdfOpen,
  target: pdfToDelete,
  deleting: deletingPdf,
  ask: askDeletePdf,
  confirm: deletePdf,
  isDeleted
} = useDeleteDocument(async (deletedId) => {
  if (deletedId === null) return refreshListing()
  if (state.generated.value?.id === deletedId) state.generated.value = undefined
  await refreshDocuments()
})
// The PDF to preview and apply with: the one just generated, else the listing's newest unsent CV.
// It's current when created after the last save and nothing is edited since, so Generate has
// nothing new to make (server timestamps on both sides).
const pdf = computed(
  () =>
    (state.generated.value && !isDeleted(state.generated.value.id)
      ? state.generated.value
      : undefined) ??
    (listing.value &&
      latestUnsentDocument(
        listing.value.documents.filter((document) => !isDeleted(document.id)),
        'CV'
      ))
)
const pdfCurrent = computed(
  () =>
    !!pdf.value &&
    !!state.draft.value &&
    !dirty.value &&
    Date.parse(pdf.value.createdAt) >= Date.parse(state.draft.value.updatedAt)
)
const canApply = computed(() => listing.value?.status === 'SAVED')

// The preview still works when only the documents refresh fails, and retrying that never regenerates.
const pdfOpen = ref(false)
const refreshFailed = ref(false)
const refreshDocuments = async () => {
  await refreshListing()
  refreshFailed.value = !!listingError.value
}
const toast = useToast()
const generatePdf = async () => {
  refreshFailed.value = false
  if (!(await state.generate())) return
  pdfOpen.value = true
  await refreshDocuments()
}
const generateLabel = computed(() =>
  state.generatePhase.value === 'saving'
    ? 'Saving and generating…'
    : state.generating.value
      ? 'Generating PDF…'
      : dirty.value || !state.draft.value
        ? 'Save and generate PDF'
        : 'Generate PDF'
)

// Describes the draft only; the PDF state is a suffix once it matches.
const saveStatus = computed(() => {
  if (dirty.value) return state.pristine.value ? 'Not saved yet' : 'Unsaved changes'
  return pdfCurrent.value ? 'Draft saved · PDF is up to date' : 'Draft saved'
})

const resetOpen = ref(false)
const {
  reset: replaceDraft,
  resetting: replacing,
  error: replaceError
} = useResetTailoredCvDraft(id)
// Both the reset and a language switch rebuild the editor from the profile, saving nothing.
const rebuild = async (success: { title: string; description?: string }, language?: Language) => {
  const error = await state.reset(language)
  resetOpen.value = languageOpen.value = false
  if (error) toast.add({ title: error, color: 'error' })
  else toast.add({ ...success, icon: 'i-lucide-rotate-ccw' })
}
const resetToProfile = () =>
  rebuild({ title: 'CV reset to your profile. Remove what you don’t need, then save.' })
// Nothing to lose on an untouched first draft, so it resets or switches without asking.
const nothingToLose = () => state.pristine.value && !suggestions.value.length
const requestReset = () => {
  if (nothingToLose()) resetToProfile()
  else resetOpen.value = true
}

// The select keeps showing the current language until the rebuild succeeds, so a cancelled or
// failed switch has nothing to undo.
const languageOpen = ref(false)
const pendingLanguage = ref<Language>('ENGLISH')
const languageName = (value: Language) =>
  LANGUAGE_OPTIONS.find((option) => option.value === value)!.label
const switchLanguage = () =>
  rebuild(
    {
      title: `CV rebuilt in ${languageName(pendingLanguage.value)}`,
      description:
        'Run AI again to tailor it to this listing. Nothing is saved until you click Save.'
    },
    pendingLanguage.value
  )
const requestLanguage = (language: Language) => {
  if (language === cv.value?.language) return
  pendingLanguage.value = language
  if (nothingToLose()) switchLanguage()
  else languageOpen.value = true
}
// A menu keeps the header narrow on phones; the disabled item says why instead of a tooltip.
const moreItems = computed<DropdownMenuItem[]>(() => [
  {
    label: state.matchesProfile.value ? 'Matches your profile' : 'Reset to profile…',
    icon: 'i-lucide-rotate-ccw',
    color: 'error',
    disabled: busy.value || state.resetting.value || state.matchesProfile.value,
    onSelect: requestReset
  }
])

// Applying from here returns to the listing, refreshed so it shows Applied.
const applyOpen = ref(false)
const openApply = () => {
  pdfOpen.value = false
  applyOpen.value = true
}
const onApplied = async () => {
  await refreshListing()
  await navigateTo(`/listings/${id}`)
}

// Pending AI suggestions in page order.
const pendingLabel = computed(() => {
  const n = suggestions.value.length
  return `${n} ${n === 1 ? 'suggestion' : 'suggestions'}`
})
const acceptAll = () => suggestions.value.map((s) => s.key).forEach(state.accept)
const dismissAll = () => suggestions.value.map((s) => s.key).forEach(state.dismiss)
// Next goes to the first suggestion below the middle of the screen, wrapping to the top, so it
// keeps its place as suggestions are accepted or dismissed.
const showNextSuggestion = () => {
  const items = [
    ...document.querySelectorAll<HTMLElement>('[data-testid="tailored-cv-suggestion"]')
  ]
  const middle = window.innerHeight / 2
  const next = items.find((item) => item.getBoundingClientRect().top > middle) ?? items[0]
  next?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// One AI choice modal for the whole CV (no scope) or a section. While a possibly charged run
// waits for its confirm, the modal keeps that run's scope, so the retry repeats it.
const aiOpen = ref(false)
const aiScope = ref<TailoredCvSectionKey>()
const aiScopeLabel = ref('')
const openAi = (scope?: TailoredCvSectionKey, label = 'your CV') => {
  if (!state.needsConfirm.value) {
    aiScope.value = scope
    aiScopeLabel.value = label
  }
  aiOpen.value = true
}
// Runs on the page, so progress and suggestions show live. When the API's safeguards stop it
// (a possibly charged run, the daily limit), the modal reopens with the retry or limit link.
const runBuiltIn = async () => {
  if (aiScope.value) await state.analyzeSection(aiScope.value)
  else await state.analyzeAll()
  refreshUsage()
  if (state.safetyCode.value) aiOpen.value = true
}

// Entry keys hold the profile entry id, so an entry without one matches no suggestion.
const suggestionsFor = (key: string) =>
  suggestions.value
    .filter((s) => s.key === key)
    .map((s) => ({
      ...s,
      current: cvSectionText(s.key, cv.value && getCvSection(cv.value, s.key), entryStyle.value),
      suggested: cvSectionText(s.key, s.value, entryStyle.value)
    }))
// What the shared editor's cards and entries get from this page: suggestions and AI runs.
const review = (key: TailoredCvSectionKey) => ({
  suggestions: suggestionsFor(key),
  onAccept: state.accept,
  onDismiss: state.dismiss
})
const editorAi: CvEditorAi = {
  review,
  section: (key) => ({
    ...review(key),
    analyzing: analyzingKey.value === key,
    disabled: busy.value,
    error: sectionErrors.value[key],
    errorDetail: sectionDetails.value[key]
  }),
  analyze: (key, label) => openAi(key, label)
}

const entryStyle = computed(() => (cv.value ? cvEntryStyle(cv.value) : 'BULLETS'))
// Switching template rewrites nothing by itself; the entries follow it after the next whole-CV run.
const templateChanged = computed(
  () =>
    !!cv.value && !!state.writtenTemplate.value && cv.value.template !== state.writtenTemplate.value
)

// Leaving with unsaved work asks first. Analysis counts too: between its section requests no AI
// call is in flight for the layout's guard to see.
const { open: leaveOpen, leave } = useLeaveConfirm(() => dirty.value || analyzing.value)
</script>

<template>
  <div>
    <div class="flex justify-center" :inert="analyzing" :aria-busy="analyzing">
      <!-- Bottom padding keeps the last card clear of the sticky save bar. -->
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
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-xl font-semibold text-highlighted">Tailored CV</h1>
              <p
                v-if="listing"
                class="break-words text-sm text-muted"
                data-testid="tailored-cv-listing"
              >
                {{ listing.title }} · {{ listing.company.name }}
              </p>
              <div v-if="cv" class="mt-2 flex flex-col gap-x-3 gap-y-1 sm:flex-row sm:items-center">
                <UFormField
                  label="CV language"
                  orientation="horizontal"
                  class="gap-2"
                  data-testid="tailored-cv-language-field"
                >
                  <USelect
                    :model-value="cv.language"
                    :items="[...LANGUAGE_OPTIONS]"
                    :disabled="busy || state.resetting.value"
                    class="w-40"
                    @update:model-value="requestLanguage($event as Language)"
                  />
                </UFormField>
                <p class="text-xs text-muted">Section headings in the PDF stay in English.</p>
              </div>
            </div>
            <UDropdownMenu v-if="cv" :items="moreItems" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :loading="state.resetting.value"
                aria-label="More CV actions"
                data-testid="tailored-cv-more"
              />
            </UDropdownMenu>
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
          data-testid="tailored-cv-not-found"
        />
        <UAlert v-else-if="loadError" color="error" data-testid="tailored-cv-load-error">
          <template #description>
            {{ ERROR_MESSAGES.generic }}
            <template v-if="state.query.error.value">
              The saved draft can’t be opened. Resetting replaces it with a fresh copy of your
              profile.
            </template>
            <span
              class="mt-1 block text-xs break-words"
              data-testid="tailored-cv-load-error-detail"
              >{{ replaceError || errorDetail(loadError) }}</span
            >
          </template>
          <template v-if="state.query.error.value" #actions>
            <!-- The saved draft itself won't load, so the only way out is replacing it. -->
            <UButton
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              :loading="replacing"
              data-testid="tailored-cv-load-error-reset"
              @click="replaceDraft"
              >Reset to profile</UButton
            >
          </template>
        </UAlert>

        <div v-else-if="!cv" class="space-y-4" data-testid="tailored-cv-loading">
          <USkeleton class="h-28 w-full" />
          <USkeleton class="h-40 w-full" />
          <USkeleton class="h-64 w-full" />
        </div>

        <template v-else>
          <AppCard>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-muted">
                Prefilled from your profile. Tailor the whole CV to this listing with AI, or one
                section or entry at a time. Edits here change this CV only, not your profile.
              </p>
              <UButton
                icon="i-lucide-sparkles"
                class="shrink-0 justify-center"
                :loading="analyzing"
                :disabled="busy"
                data-testid="tailored-cv-optimize"
                @click="openAi()"
                >Tailor CV with AI</UButton
              >
            </div>
            <UAlert
              v-if="templateChanged && !analyzing"
              color="warning"
              variant="subtle"
              icon="i-lucide-sparkles"
              title="CV style changed. Tailor the CV again to rewrite entries in this style."
              :actions="[
                {
                  label: 'Tailor CV with AI',
                  color: 'neutral',
                  variant: 'outline',
                  onClick: () => openAi()
                }
              ]"
              class="mt-3"
              data-testid="tailored-cv-template-changed"
            />
            <div class="mt-3 grid gap-3 border-t border-default pt-3 md:grid-cols-2">
              <UFormField label="CV style" :description="TEMPLATE_HINTS[cv.template]">
                <URadioGroup
                  v-model="cv.template"
                  :items="TEMPLATE_OPTIONS"
                  orientation="horizontal"
                  :disabled="analyzing"
                  data-testid="tailored-cv-template"
                />
              </UFormField>
              <UFormField
                label="Entry format"
                :description="CONTENT_STYLE_DESCRIPTION[cv.template]"
              >
                <URadioGroup
                  :model-value="entryStyle"
                  :items="CONTENT_STYLE_OPTIONS"
                  orientation="horizontal"
                  :disabled="analyzing || cv.template === 'CONCISE'"
                  data-testid="tailored-cv-content-style"
                  @update:model-value="setCvContentStyle(cv, $event as CvContentStyle)"
                />
              </UFormField>
            </div>
          </AppCard>

          <!-- A native disabled fieldset turns off every field and button inside while whole-CV
             analysis runs, so edits can't race it while the page stays readable. -->
          <fieldset :disabled="analyzing" class="min-w-0 space-y-4 sm:space-y-6">
            <UAlert
              v-if="suggestions.length"
              color="primary"
              variant="subtle"
              icon="i-lucide-sparkles"
              :title="`${pendingLabel} to review`"
              :actions="[
                { label: 'Accept all', color: 'neutral', variant: 'outline', onClick: acceptAll },
                { label: 'Dismiss all', color: 'neutral', variant: 'ghost', onClick: dismissAll },
                {
                  label: 'Next',
                  icon: 'i-lucide-arrow-down',
                  color: 'neutral',
                  variant: 'ghost',
                  onClick: showNextSuggestion
                }
              ]"
              data-testid="tailored-cv-suggestions"
            />

            <CvContentEditor v-model:cv="cv" :profile="profile" :disabled="busy" :ai="editorAi" />

            <AppCard title="PDF" data-testid="tailored-cv-pdf">
              <UFormField
                label="PDF layout"
                :description="SECTION_ORDER_HINTS[cv.sectionOrder]"
                help="Only changes the PDF, not the text you edit."
              >
                <URadioGroup
                  v-model="cv.sectionOrder"
                  :items="SECTION_ORDER_OPTIONS"
                  orientation="horizontal"
                  :disabled="analyzing"
                  data-testid="tailored-cv-section-order"
                />
              </UFormField>
              <div
                v-if="pdf"
                class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3"
                data-testid="tailored-cv-latest-pdf"
              >
                <p class="flex min-w-0 items-center gap-2 text-sm">
                  <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
                  <span class="truncate">{{ pdf.fileName }}</span>
                  <span class="shrink-0 text-muted"
                    >{{ formatDateTime(pdf.createdAt)
                    }}{{ pdfCurrent ? '' : ' · older than the draft' }}</span
                  >
                </p>
                <div class="flex items-center gap-1">
                  <UButton
                    icon="i-lucide-eye"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    data-testid="tailored-cv-latest-pdf-preview"
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
                    data-testid="tailored-cv-delete-pdf"
                    @click="askDeletePdf(pdf)"
                  />
                </div>
              </div>
            </AppCard>

            <div v-if="refreshFailed || state.generateError.value" class="space-y-2">
              <UAlert
                v-if="refreshFailed"
                color="warning"
                description="The PDF action succeeded, but the listing's documents could not be refreshed."
                :actions="[
                  {
                    label: 'Retry refresh',
                    color: 'neutral',
                    variant: 'outline',
                    onClick: refreshDocuments
                  }
                ]"
                data-testid="tailored-cv-refresh-failed"
              />
              <UAlert
                v-if="state.generateError.value"
                color="error"
                :description="
                  state.generateError.value.kind === 'draft'
                    ? 'The saved draft was missing. Generate PDF saves it again.'
                    : state.generateError.value.kind === 'listing'
                      ? 'This listing is no longer available.'
                      : state.generateError.value.message
                "
                :actions="
                  state.generateError.value.kind === 'listing'
                    ? [
                        {
                          label: 'Back to listings',
                          to: '/listings',
                          color: 'neutral',
                          variant: 'outline'
                        }
                      ]
                    : []
                "
                data-testid="tailored-cv-generate-error"
              >
                <template v-if="state.generateError.value.detail" #description>
                  {{ state.generateError.value.message }}
                  <span class="mt-1 block text-xs break-words">{{
                    state.generateError.value.detail
                  }}</span>
                </template>
              </UAlert>
            </div>

            <!-- Sticky so the next step stays in reach on long drafts; translucent like the dashboard
             header. On phones the status takes its own line above equal buttons. Generate saves
             first; once the PDF matches the draft, the next step is applying with it. -->
            <div
              class="sticky bottom-0 z-10 grid grid-cols-2 items-center gap-3 rounded-md border border-default bg-default/90 p-3 backdrop-blur sm:flex sm:flex-wrap"
              data-testid="tailored-cv-save-bar"
            >
              <span
                class="order-first col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted sm:order-none sm:col-auto sm:flex-1 sm:justify-end"
              >
                <span class="inline-flex items-center gap-1.5">
                  <UIcon
                    :name="dirty ? 'i-lucide-circle-dot' : 'i-lucide-check'"
                    :class="dirty && !state.pristine.value ? 'text-warning' : ''"
                  />
                  <span data-testid="tailored-cv-save-status">{{ saveStatus }}</span>
                </span>
                <!-- Also a way back to the suggestions from wherever the owner has scrolled. -->
                <UButton
                  v-if="suggestions.length"
                  icon="i-lucide-sparkles"
                  variant="subtle"
                  size="xs"
                  data-testid="tailored-cv-pending"
                  @click="showNextSuggestion"
                  >{{ pendingLabel }} to review</UButton
                >
              </span>
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="subtle"
                class="w-full justify-center sm:order-first sm:w-auto"
                :class="!dirty && !(pdfCurrent && pdf) ? 'col-span-2 sm:col-auto' : ''"
                data-testid="tailored-cv-copy"
                @click="copy(cv)"
                >Copy as text</UButton
              >
              <template v-if="pdfCurrent && pdf">
                <UButton
                  icon="i-lucide-eye"
                  :color="canApply ? 'neutral' : 'primary'"
                  :variant="canApply ? 'subtle' : 'solid'"
                  class="w-full justify-center sm:w-auto"
                  data-testid="tailored-cv-preview-pdf"
                  @click="pdfOpen = true"
                  >Preview PDF</UButton
                >
                <UButton
                  v-if="canApply"
                  icon="i-lucide-check"
                  class="col-span-2 w-full justify-center sm:col-auto sm:w-auto"
                  data-testid="tailored-cv-apply"
                  @click="openApply"
                  >Record with this CV</UButton
                >
              </template>
              <template v-else>
                <UButton
                  v-if="dirty"
                  icon="i-lucide-save"
                  color="neutral"
                  variant="subtle"
                  :loading="state.saving.value && !state.generating.value"
                  :disabled="busy || state.generating.value"
                  class="w-full justify-center sm:w-auto"
                  data-testid="tailored-cv-save"
                  @click="state.save()"
                  >Save draft</UButton
                >
                <UButton
                  icon="i-lucide-file-down"
                  :loading="state.generating.value"
                  :disabled="busy || state.saving.value"
                  class="col-span-2 w-full justify-center sm:col-auto sm:w-auto"
                  data-testid="tailored-cv-generate"
                  @click="generatePdf"
                  >{{ generateLabel }}</UButton
                >
              </template>
            </div>
          </fieldset>
        </template>
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
        v-if="listing && canApply"
        v-model:open="applyOpen"
        :listing="listing"
        :cv-document-id="pdf?.id"
        @changed="onApplied"
      />

      <ListingsTailoredCvAiModal
        v-model:open="aiOpen"
        :ai="state"
        :scope="aiScope"
        :scope-label="aiScopeLabel"
        @analyze="runBuiltIn"
      />

      <AppConfirmModal
        v-model:open="resetOpen"
        title="Reset to your profile?"
        :description="`Your edits${suggestions.length ? ` and ${pendingLabel} not yet reviewed` : ''} are replaced with your current profile. The saved draft and PDFs stay as they are until you save.`"
        confirm-label="Reset to profile"
        @confirm="resetToProfile"
      />

      <AppConfirmModal
        v-model:open="languageOpen"
        :title="`Regenerate in ${languageName(pendingLanguage)}?`"
        :description="`Your edits${suggestions.length ? ` and ${pendingLabel} not yet reviewed` : ''} are replaced with your profile in ${languageName(pendingLanguage)}. The saved draft and PDFs stay as they are until you save.`"
        confirm-label="Regenerate"
        :loading="state.resetting.value"
        @confirm="switchLanguage"
      />

      <AppConfirmModal
        v-model:open="leaveOpen"
        title="Leave without saving?"
        description="Your tailored CV has unsaved changes. They will be lost."
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
    <div
      v-if="analyzing"
      class="fixed inset-0 z-50 grid place-items-center bg-default/50 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      data-testid="tailored-cv-analysis-overlay"
    >
      <div
        class="w-full max-w-sm space-y-3 rounded-lg border border-default bg-default p-4 shadow-lg"
      >
        <div class="flex items-center gap-3" data-testid="tailored-cv-progress">
          <UIcon name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin text-primary" />
          <div>
            <p class="font-medium text-highlighted">{{ progress?.label ?? 'Analyzing your CV' }}</p>
            <p v-if="progress" class="text-sm text-muted">
              Step {{ progress.step }} of {{ progress.total }} · Nothing is saved yet
            </p>
          </div>
        </div>
        <UProgress v-if="progress" :model-value="progress.step" :max="progress.total" size="sm" />
      </div>
    </div>
  </div>
</template>
