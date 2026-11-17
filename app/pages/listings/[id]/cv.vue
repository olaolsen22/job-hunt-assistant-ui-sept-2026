<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CvEditorAi, TailoredCvSectionKey } from '~/utils/tailoredCv'
import type { CvSuggestionView } from '~/utils/tailoredCvDiff'
import type { TailoredCvSuggestion } from '~/composables/useTailoredCvDraft'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'

definePageMeta({ title: 'Tailored CV' })

const route = useRoute()
const id = Number(route.params.id)
useBackLink({ to: `/listings/${id}`, label: 'Listing' })

// The listing and draft requests start together; only the listing is waited for.
const listingQuery = useListing(id)
const state = useTailoredCvDraft(id)
const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await listingQuery
const {
  cv,
  dirty,
  suggestions,
  reviewing,
  sectionErrors,
  sectionDetails,
  analyzing,
  analyzingKey,
  progress
} = state
const { copy } = useCopyTailoredCv()

useListingTitle(listing, 'Tailored CV')
const { refresh: refreshUsage } = useLlmUsage(false)

// Builds the candidate once it's ready: the saved draft, or the profile as is. AI only runs when the
// owner asks.
watch(
  [state.source, state.query.status],
  () => {
    if (!cv.value) state.init()
  },
  { immediate: true }
)
// Loaded up front, so "Copy prompt" is a direct write (browsers can refuse one after an await).
onMounted(() => state.loadPrompt())

// A failed refresh after generating keeps the listing it already has, so it isn't a load error.
// A saved draft doesn't need the profile prefill to open; a new CV starts from it.
const loadError = computed(
  () =>
    (!listing.value && listingError.value) ||
    state.query.error.value ||
    (!state.draft.value && state.sourceQuery.error.value)
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
const notify = useAppToast()
const generatePdf = async () => {
  refreshFailed.value = false
  if (!(await state.generate())) return
  pdfOpen.value = true
  await refreshDocuments()
}
// One PDF button whose label follows the state: it saves and creates, creates, or opens the
// current one without making another.
const pdfLabel = computed(() =>
  state.generatePhase.value === 'saving'
    ? 'Saving and creating…'
    : state.generating.value
      ? 'Creating PDF…'
      : dirty.value || !state.draft.value
        ? 'Save and create PDF'
        : pdfCurrent.value
          ? 'Open PDF'
          : 'Create PDF'
)
const pdfAction = () => (pdfCurrent.value ? (pdfOpen.value = true) : generatePdf())

const saveStatus = computed(() => {
  if (dirty.value) return state.pristine.value ? 'Not saved yet' : 'Unsaved changes'
  if (!pdf.value) return 'Saved · no PDF yet'
  return pdfCurrent.value ? 'Saved · PDF is up to date' : 'Saved · PDF is older than this draft'
})

const resetOpen = ref(false)
const {
  reset: replaceDraft,
  resetting: replacing,
  error: replaceError
} = useResetTailoredCvDraft(id)
// Both the reset and a language switch rebuild the editor from the profile, saving nothing.
// Counts rebuilds, so an Undo of discarded AI changes never brings back ones written for the old CV.
let rebuilds = 0
const rebuild = async (success: { title: string; description?: string }, language?: Language) => {
  const error = await state.reset(language)
  if (!error) rebuilds++
  resetOpen.value = languageOpen.value = false
  if (error) notify.error(error)
  else notify.success(success.title, { ...success, icon: 'i-lucide-rotate-ccw' })
}
const resetToProfile = () =>
  rebuild({
    title: 'CV reset to your profile',
    description: 'Remove what you don’t need, then save.'
  })
// Nothing to lose on an untouched first draft, so it resets or switches without asking.
const nothingToLose = () => state.pristine.value && !suggestions.value.length
const requestReset = () => {
  if (nothingToLose()) resetToProfile()
  else resetOpen.value = true
}

// The settings panel keeps its pick until the rebuild succeeds, so a cancelled or failed switch has
// nothing to undo.
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
// Occasional actions; the disabled reset item says why instead of a tooltip.
const copyText = async () => {
  if (cv.value && (await copy(cv.value)))
    notify.success('CV copied as text', { icon: 'i-lucide-copy' })
}
const moreItems = computed<DropdownMenuItem[]>(() => [
  { label: 'Copy as text', icon: 'i-lucide-copy', onSelect: copyText },
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

const pendingLabel = computed(() => {
  const n = suggestions.value.length
  return `${n} AI ${n === 1 ? 'change' : 'changes'}`
})
const acceptAll = () => suggestions.value.map((s) => s.key).forEach(state.accept)
// A whole (possibly charged) AI run goes in one tap, so Undo brings it back.
// Undo keeps whatever is pending by then (a run finished since wins for its keys) and does nothing
// once the CV was rebuilt.
const dismissAll = () => {
  const before = [...suggestions.value]
  const label = pendingLabel.value
  const at = rebuilds
  suggestions.value = []
  notify.undoable(
    `${label} discarded`,
    () => {
      if (at !== rebuilds) return
      const now = suggestions.value
      suggestions.value = [...before.filter((b) => !now.some((s) => s.key === b.key)), ...now]
    },
    { icon: 'i-lucide-undo-2' }
  )
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

// A suggestion stands in for its card's content (as a diff where one helps), except the headline,
// which shares the Contact card, and whole lists, whose entries stay visible.
const WHOLE_LISTS = new Set(['experiences', 'educations', 'certifications', 'projects'])
const ENTRY_LIST_OF: Record<string, string> = {
  experience: 'experiences',
  education: 'educations',
  project: 'projects'
}
// One pending suggestion as a card shows it. An added entry has no entry of its own yet, so it shows
// as a diff of new bullets on its list's card, like a new order (just the names, numbered).
const view = (s: TailoredCvSuggestion): CvSuggestionView => {
  const current = cv.value && getCvSection(cv.value, s.key)
  const base = { key: s.key, removal: s.value == null, review: true }
  if (s.kind === 'order') {
    const entries = (current ?? []) as { sourceEntryId?: number | null }[]
    const names = (list: unknown[]) => list.map((e, i) => `${i + 1}. ${cvEntryName(e)}`).join('\n')
    const byId = (id: number) => entries.find((e) => e.sourceEntryId === id)
    return {
      ...base,
      label: 'New order',
      current: names(entries),
      // An added entry not accepted yet isn't in the list, so the order skips it.
      suggested: names((s.value as number[]).map(byId).filter(Boolean)),
      replaces: false
    }
  }
  if (s.kind === 'add') {
    const empty = { ...(s.value as object), bullets: [], technologies: [], paragraph: null }
    return {
      ...base,
      label: `New entry: ${cvEntryName(s.value)}`,
      current: '',
      suggested: cvSectionText(s.key, s.value, entryStyle.value),
      replaces: false,
      diff: suggestionDiff(s.key, empty, s.value, entryStyle.value)
    }
  }
  return {
    ...base,
    current: cvSectionText(s.key, current, entryStyle.value),
    suggested: cvSectionText(s.key, s.value, entryStyle.value),
    replaces: s.key !== 'headline' && !WHOLE_LISTS.has(s.key),
    diff: suggestionDiff(s.key, current, s.value, entryStyle.value)
  }
}
// Entry keys hold the profile entry id, so an entry without one matches no suggestion. A list's card
// also takes its added entries.
const suggestionsFor = (key: string): CvSuggestionView[] =>
  suggestions.value
    .filter(
      (s) => s.key === key || (s.kind === 'add' && ENTRY_LIST_OF[s.key.split(':')[0]!] === key)
    )
    .map(view)
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

const entryStyle = computed(() => cv.value?.contentStyle ?? 'BULLETS')
// Switching template rewrites nothing by itself; the entries follow it after the next whole-CV run.
const templateChanged = computed(
  () =>
    !!cv.value && !!state.writtenTemplate.value && cv.value.template !== state.writtenTemplate.value
)

// Leaving with unsaved work or unreviewed AI changes asks first. Analysis counts too: between its
// section requests no AI call is in flight for the layout's guard to see.
const { open: leaveOpen, leave } = useLeaveConfirm(
  () => dirty.value || analyzing.value || reviewing.value
)
const leaveDescription = computed(() =>
  reviewing.value
    ? `${pendingLabel.value} not yet reviewed${dirty.value ? ' and your unsaved changes' : ''} will be discarded.`
    : 'Your tailored CV has unsaved changes. They will be lost.'
)
</script>
<template>
  <div>
    <div class="flex justify-center" :inert="analyzing" :aria-busy="analyzing">
      <!-- Bottom padding keeps the last card clear of the sticky bar. -->
      <!-- Two columns from 2xl (see CvContentEditor's `columns`), so the cap lifts there. -->
      <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6 2xl:max-w-none">
        <div class="space-y-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-xl font-semibold text-highlighted">Tailored CV</h1>
              <p
                v-if="listing"
                class="break-words text-sm text-muted"
                data-testid="tailored-cv-listing"
              >
                {{ listing.title }} · {{ listing.company.name }}
              </p>
            </div>
            <div v-if="cv" class="flex w-full items-center gap-2 sm:w-auto">
              <!-- Quiet while changes wait, so the review stays the next step. -->
              <UButton
                icon="i-lucide-sparkles"
                :color="reviewing ? 'neutral' : 'primary'"
                :variant="reviewing ? 'outline' : 'solid'"
                class="flex-1 justify-center sm:flex-none"
                :loading="analyzing"
                :disabled="busy"
                data-testid="tailored-cv-optimize"
                @click="openAi()"
                >Tailor CV with AI</UButton
              >
              <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
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
          <USkeleton class="h-16 w-full" />
          <USkeleton class="h-40 w-full" />
          <USkeleton class="h-64 w-full" />
        </div>

        <template v-else>
          <!-- A native disabled fieldset turns off every field and button inside while whole-CV
             analysis runs, so edits can't race it while the page stays readable. -->
          <fieldset :disabled="analyzing" class="min-w-0 space-y-4 sm:space-y-6">
            <CvContentEditor
              v-model:cv="cv"
              :source="state.source.value"
              :disabled="busy"
              :ai="editorAi"
              skills-modal
              columns
            >
              <template #aside-start>
                <ListingsTailoredCvSettings
                  v-model:cv="cv"
                  :disabled="busy"
                  :resetting="state.resetting.value"
                  @rebuild="requestLanguage"
                >
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
                  <CvPdfLatestRow
                    v-if="pdf"
                    :pdf="pdf"
                    :current="pdfCurrent"
                    older-than="draft"
                    testid-prefix="tailored-cv"
                    class="mt-3 border-t border-default pt-3"
                    @preview="pdfOpen = true"
                    @delete="askDeletePdf(pdf)"
                  />
                </ListingsTailoredCvSettings>
              </template>
            </CvContentEditor>

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
                    ? 'The saved draft was missing. Creating the PDF saves it again.'
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

            <!-- While AI changes wait, the bar steps through them and saving waits. -->
            <ListingsTailoredCvReviewBar
              v-if="reviewing"
              :count="suggestions.length"
              @accept-all="acceptAll"
              @discard-all="dismissAll"
            />
            <!-- The same two buttons in every state; only their labels and enabled state change. -->
            <AppSaveBar
              v-else
              :status="saveStatus"
              status-testid="tailored-cv-save-status"
              :changed="dirty"
              :warn="dirty && !state.pristine.value"
              data-testid="tailored-cv-save-bar"
            >
              <UButton
                icon="i-lucide-save"
                color="neutral"
                variant="outline"
                :loading="state.saving.value && !state.generating.value"
                :disabled="!dirty || busy || state.generating.value"
                class="w-full justify-center sm:w-auto"
                data-testid="tailored-cv-save"
                @click="state.save()"
                >Save draft</UButton
              >
              <UButton
                :icon="pdfCurrent ? 'i-lucide-eye' : 'i-lucide-file-down'"
                :loading="state.generating.value"
                :disabled="busy || (state.saving.value && !state.generating.value)"
                class="w-full justify-center sm:w-auto"
                data-testid="tailored-cv-generate"
                @click="pdfAction"
                >{{ pdfLabel }}</UButton
              >
            </AppSaveBar>
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
        :title="`Rebuild in ${languageName(pendingLanguage)}?`"
        :description="`Your edits${suggestions.length ? ` and ${pendingLabel} not yet reviewed` : ''} are replaced with your profile in ${languageName(pendingLanguage)}. The saved draft and PDFs stay as they are until you save.`"
        :confirm-label="`Rebuild in ${languageName(pendingLanguage)}`"
        :loading="state.resetting.value"
        @confirm="switchLanguage"
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
