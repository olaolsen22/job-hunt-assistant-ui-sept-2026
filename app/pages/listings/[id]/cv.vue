<script setup lang="ts">
import { SUCCESS_TOAST_DURATION } from '~/constants/ui'
import type { TailoredCvSectionKey } from '~/utils/tailoredCv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { VueDraggable } from 'vue-draggable-plus'
import { PROFICIENCY_OPTIONS } from '~/constants/listing'

definePageMeta({ title: 'Tailored CV' })

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

const SECTION_ORDER_OPTIONS = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Developer', value: 'DEVELOPER' }
]
const SECTION_ORDER_HINTS = {
  STANDARD:
    'Standard order; skills print on one line, in the order shown. Only changes the generated PDF, not the text you edit.',
  DEVELOPER:
    'Links under the contact lines; skills and projects moved up, and skills grouped by category. Only changes the generated PDF, not the text you edit.'
} as const

// The owner's categories (edited on the skills page); a deleted one shows as uncategorized.
const { items: categoryItems, known: knownCategory } = useSkillCategories()
const moveSkill = (from: number, to: number) => {
  const skills = cv.value!.skills
  skills.splice(to, 0, ...skills.splice(from, 1))
}

const CONTENT_STYLE_OPTIONS = [
  { label: 'Bullets', value: 'BULLETS' },
  { label: 'Paragraphs', value: 'PARAGRAPH' }
]
type ContentStyle = 'BULLETS' | 'PARAGRAPH'

const route = useRoute()
const id = Number(route.params.id)

const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await useListing(id)
const { profile, error: profileError } = useProfile()
const state = useTailoredCvDraft(
  id,
  profile,
  computed(() => listing.value?.postingLanguage)
)
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

// The PDF to preview and apply with: the one just generated, else the listing's newest unsent CV.
// It's current when created after the last save and nothing is edited since, so Generate has
// nothing new to make (server timestamps on both sides).
const deletedPdfIds = ref<number[]>([])
const pdf = computed(
  () =>
    (state.generated.value && !deletedPdfIds.value.includes(state.generated.value.id)
      ? state.generated.value
      : undefined) ??
    (listing.value &&
      latestUnsentDocument(
        listing.value.documents.filter((document) => !deletedPdfIds.value.includes(document.id)),
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
  if (!ok) {
    await refreshListing()
    return
  }
  deletedPdfIds.value = [...deletedPdfIds.value, target.id]
  if (state.generated.value?.id === target.id) state.generated.value = undefined
  toast.add({
    title: 'PDF deleted',
    color: 'success',
    duration: SUCCESS_TOAST_DURATION,
    icon: 'i-lucide-check'
  })
  await refreshDocuments()
}
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
const resetToProfile = async () => {
  const error = await state.reset()
  resetOpen.value = false
  if (error) toast.add({ title: error, color: 'error' })
  else
    toast.add({
      title: 'CV reset to your profile. Remove what you don’t need, then save.',
      icon: 'i-lucide-rotate-ccw'
    })
}
// Nothing to lose on an untouched first draft, so it resets without asking.
const requestReset = () => {
  if (state.pristine.value && !suggestions.value.length) resetToProfile()
  else resetOpen.value = true
}

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

// Pending AI suggestions in page order; Next walks through them and wraps around.
const pendingLabel = computed(() => {
  const n = suggestions.value.length
  return `${n} ${n === 1 ? 'suggestion' : 'suggestions'}`
})
const acceptAll = () => suggestions.value.map((s) => s.key).forEach(state.accept)
const dismissAll = () => suggestions.value.map((s) => s.key).forEach(state.dismiss)
let nextSuggestion = 0
const showNextSuggestion = () => {
  const items = document.querySelectorAll('[data-testid="tailored-cv-suggestion"]')
  if (!items.length) return
  nextSuggestion %= items.length
  items[nextSuggestion]!.scrollIntoView({ behavior: 'smooth', block: 'center' })
  nextSuggestion++
}

// One AI choice modal for the whole CV (no scope) or a section.
const aiOpen = ref(false)
const aiScope = ref<TailoredCvSectionKey>()
const aiScopeLabel = ref('')
const openAi = (scope?: TailoredCvSectionKey, label = 'your CV') => {
  aiScope.value = scope
  aiScopeLabel.value = label
  aiOpen.value = true
}
const runBuiltIn = async () => {
  if (aiScope.value) await state.analyzeSection(aiScope.value)
  else await state.analyzeAll()
  refreshUsage()
}
// The last run may have been billed without a result; only this explicit choice repeats it.
const {
  needsConfirm: aiNeedsConfirm,
  safetyCode: aiErrorCode,
  safetyMessage: aiErrorMessage
} = state
const retryConfirmed = () => {
  state.confirmRetry()
  void runBuiltIn()
}

const suggestionsFor = (match: (key: TailoredCvSectionKey) => boolean) =>
  suggestions.value
    .filter((s) => match(s.key))
    .map((s) => ({
      ...s,
      current: cvSectionText(
        s.key,
        cv.value && getCvSection(cv.value, s.key),
        cv.value?.contentStyle
      ),
      suggested: cvSectionText(s.key, s.value, cv.value?.contentStyle)
    }))

const dates = (start?: string | null, end?: string | null, open?: string) =>
  formatMonthRange(start, end, open, 'en-GB')

// One format for the whole CV. Entries with no paragraph yet start from their bullets joined;
// bullets stay in the draft either way, since they carry the source ids.
const setContentStyle = (style: ContentStyle) => {
  const draft = cv.value!
  draft.contentStyle = style
  if (style !== 'PARAGRAPH') return
  for (const e of [
    ...draft.experiences,
    ...draft.educations,
    ...draft.certifications,
    ...draft.projects
  ]) {
    if (!e.paragraph?.trim()) e.paragraph = e.bullets.map((b) => b.text).join(' ')
  }
}

const addLanguage = () => cv.value!.languages.push({ name: '', spoken: null, written: null })

// Leaving with unsaved work asks first; closing or reloading the tab gets the browser's own warning.
const leaveOpen = ref(false)
const leaveTo = ref('')
let leaving = false
const unsaved = () => dirty.value || analyzing.value
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
            </div>
            <UButton
              v-if="cv"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              :disabled="busy || analyzing || state.resetting.value || state.matchesProfile.value"
              :loading="state.resetting.value"
              :title="state.matchesProfile.value ? 'Already matches your profile' : undefined"
              data-testid="tailored-cv-reset"
              @click="requestReset"
              >Reset to profile</UButton
            >
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
              >Replace with profile CV</UButton
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
                Prefilled from your profile. Let AI tailor the whole CV to this listing, or use the
                AI button on a section.
              </p>
              <UButton
                icon="i-lucide-sparkles"
                class="justify-center"
                :loading="analyzing"
                :disabled="busy"
                data-testid="tailored-cv-optimize"
                @click="openAi()"
                >Whole CV</UButton
              >
            </div>
            <UFormField
              label="PDF layout"
              :description="SECTION_ORDER_HINTS[cv.sectionOrder]"
              class="mt-3 border-t border-default pt-3"
            >
              <USelect
                v-model="cv.sectionOrder"
                :items="SECTION_ORDER_OPTIONS"
                :disabled="analyzing"
                class="w-full sm:w-56"
                data-testid="tailored-cv-section-order"
              />
            </UFormField>
            <UFormField
              label="Entry format"
              description="Experience, education, certifications and projects are all written as bullets or as paragraphs."
              class="mt-3"
            >
              <USelect
                :model-value="cv.contentStyle"
                :items="CONTENT_STYLE_OPTIONS"
                :disabled="analyzing"
                class="w-full sm:w-56"
                data-testid="tailored-cv-content-style"
                @update:model-value="setContentStyle($event as ContentStyle)"
              />
            </UFormField>
            <AppAiRetryConfirm
              v-if="aiNeedsConfirm && !analyzing"
              :message="aiErrorMessage"
              class="mt-3"
              @retry="retryConfirmed"
            />
            <UAlert
              v-else-if="aiErrorCode && !analyzing"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="aiErrorMessage"
              class="mt-3"
              data-testid="tailored-cv-ai-error"
            >
              <template v-if="aiErrorCode === 'daily-limit-reached'" #actions>
                <AppAiLimitLink />
              </template>
            </UAlert>
            <div
              v-if="analyzing"
              class="mt-3 flex flex-wrap items-center gap-x-2 text-sm"
              role="status"
              aria-live="polite"
              data-testid="tailored-cv-progress"
            >
              <span class="font-medium text-highlighted">{{ progress?.label ?? 'Analyzing' }}</span>
              <span v-if="progress" class="text-muted"
                >Step {{ progress.step }} of {{ progress.total }} · Nothing is saved yet</span
              >
            </div>
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
                @click="selectPdfForDeletion"
              />
            </div>
          </AppCard>

          <!-- A native disabled fieldset turns off every field and button inside while whole-CV
             analysis runs, so edits can't race it while the page stays readable. -->
          <fieldset :disabled="analyzing" class="min-w-0 space-y-4 sm:space-y-6">
            <UAlert
              v-if="suggestions.length"
              color="info"
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

            <ListingsTailoredCvSection
              title="Kontaktinformasjon og overskrift (Contact and headline)"
              testid="tailored-cv-contact"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'headline')"
                  :key="s.key"
                  label="Headline"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <div class="grid gap-3 sm:grid-cols-2">
                <UFormField label="Full name">
                  <UInput v-model="cv.fullName" class="w-full" autocomplete="name" />
                </UFormField>
                <UFormField label="Headline">
                  <UInput v-model="cv.headline" class="w-full" data-testid="tailored-cv-headline" />
                </UFormField>
                <UFormField label="Email">
                  <UInput v-model="cv.email" type="email" class="w-full" autocomplete="email" />
                </UFormField>
                <UFormField label="Phone">
                  <UInput v-model="cv.phone" type="tel" class="w-full" autocomplete="tel" />
                </UFormField>
                <UFormField label="Address" class="sm:col-span-2">
                  <UInput v-model="cv.address" class="w-full" autocomplete="street-address" />
                </UFormField>
                <UFormField label="Date of birth">
                  <UInput v-model="cv.dateOfBirth" type="date" class="w-full" />
                </UFormField>
                <UFormField label="References" class="self-end">
                  <USwitch v-model="cv.referencesOnRequest" label="Available on request" />
                </UFormField>
              </div>
              <fieldset class="mt-4 space-y-2">
                <legend class="mb-2 text-sm font-medium">Links</legend>
                <div
                  v-for="(link, i) in cv.links"
                  :key="i"
                  class="flex flex-col gap-2 sm:flex-row sm:items-start"
                >
                  <UInput
                    v-model="link.label"
                    placeholder="Label"
                    class="sm:w-40"
                    :aria-label="`Link ${i + 1} label`"
                  />
                  <div class="flex flex-1 gap-2">
                    <UInput
                      v-model="link.url"
                      type="url"
                      placeholder="https://"
                      class="flex-1"
                      :aria-label="`Link ${i + 1} URL`"
                    />
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      :aria-label="`Remove link ${i + 1}`"
                      @click="cv.links.splice(i, 1)"
                    />
                  </div>
                </div>
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  @click="cv.links.push({ label: '', url: '' })"
                  >Add link</UButton
                >
              </fieldset>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Sammendrag (Summary)"
              testid="tailored-cv-summary"
              analyzable
              :analyzing="analyzingKey === 'summary'"
              :disabled="busy"
              :error="sectionErrors.summary"
              :error-detail="sectionDetails.summary"
              @analyze="openAi('summary', 'the summary')"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'summary')"
                  :key="s.key"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <UTextarea
                v-model="cv.summary"
                :rows="4"
                autoresize
                class="w-full"
                aria-label="Summary"
                data-testid="tailored-cv-summary-input"
              />
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Arbeidserfaring (Experience)"
              testid="tailored-cv-experience"
              :empty-message="cv.experiences.length ? undefined : 'No experience in this CV.'"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'experiences')"
                  :key="s.key"
                  label="All experience"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(e, i) in cv.experiences"
                  :key="e.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="e.bullets"
                  v-model:paragraph="e.paragraph"
                  :content-style="cv.contentStyle"
                  :title="e.title"
                  :subtitle="e.employer"
                  :dates="dates(e.startMonth, e.endMonth, 'Present')"
                  :location="e.location"
                  :analyzable="e.sourceEntryId != null"
                  :analyzing="analyzingKey === `experience:${e.sourceEntryId}`"
                  :disabled="busy"
                  @analyze="openAi(`experience:${e.sourceEntryId!}`, e.title)"
                  @remove="cv.experiences.splice(i, 1)"
                >
                  <UAlert
                    v-if="sectionErrors[`experience:${e.sourceEntryId!}`]"
                    color="error"
                    variant="subtle"
                    icon="i-lucide-circle-alert"
                    :title="sectionErrors[`experience:${e.sourceEntryId!}`]"
                    :description="sectionDetails[`experience:${e.sourceEntryId!}`]"
                    :ui="{ description: 'text-xs break-words' }"
                    data-testid="tailored-cv-entry-error"
                  />
                  <ListingsTailoredCvSuggestion
                    v-for="s in suggestionsFor((k) => k === `experience:${e.sourceEntryId}`)"
                    :key="s.key"
                    :current="s.current"
                    :suggested="s.suggested"
                    @accept="state.accept(s.key)"
                    @dismiss="state.dismiss(s.key)"
                  />
                  <template #fields>
                    <UFormField label="Title"
                      ><UInput v-model="e.title" class="w-full"
                    /></UFormField>
                    <UFormField label="Employer"
                      ><UInput v-model="e.employer" class="w-full"
                    /></UFormField>
                    <UFormField label="Location" class="sm:col-span-2"
                      ><UInput
                        :model-value="e.location ?? undefined"
                        class="w-full"
                        @update:model-value="e.location = $event"
                    /></UFormField>
                    <UFormField label="Start"><AppMonthField v-model="e.startMonth" /></UFormField>
                    <UFormField label="End" help="Empty means present."
                      ><AppMonthField v-model="e.endMonth"
                    /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Ferdigheter (Skills)"
              testid="tailored-cv-skills"
              analyzable
              :analyzing="analyzingKey === 'skills'"
              :disabled="busy"
              :error="sectionErrors.skills"
              :error-detail="sectionDetails.skills"
              :empty-message="cv.skills.length ? undefined : 'No skills in this CV.'"
              @analyze="openAi('skills', 'skills')"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'skills')"
                  :key="s.key"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <div class="space-y-2">
                <VueDraggable
                  v-model="cv.skills"
                  tag="ul"
                  handle=".drag-handle"
                  ghost-class="opacity-50"
                  :animation="150"
                  :disabled="analyzing"
                  class="space-y-1"
                  data-testid="tailored-cv-skill-list"
                >
                  <li
                    v-for="(skill, i) in cv.skills"
                    :key="`${skill.sourceSkillId ?? skill.name}-${i}`"
                    class="flex flex-wrap items-center gap-x-1 gap-y-1"
                    data-testid="tailored-cv-skill"
                  >
                    <UButton
                      icon="i-lucide-grip-vertical"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="`Drag ${skill.name} to reorder`"
                      class="drag-handle shrink-0 cursor-grab touch-none"
                    />
                    <span class="min-w-24 flex-1 truncate">{{ skill.name }}</span>
                    <USelect
                      :model-value="knownCategory(skill.categoryId)"
                      :items="categoryItems"
                      size="sm"
                      :aria-label="`${skill.name} category`"
                      class="w-40 shrink-0"
                      @update:model-value="
                        (choice) => (skill.categoryId = fromCategoryChoice(choice))
                      "
                    />
                    <!-- Dragging is awkward on touch and unusable by keyboard, so the order has buttons too. -->
                    <UButton
                      icon="i-lucide-chevron-up"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :disabled="i === 0"
                      :aria-label="`Move ${skill.name} earlier`"
                      @click="moveSkill(i, i - 1)"
                    />
                    <UButton
                      icon="i-lucide-chevron-down"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :disabled="i === cv.skills.length - 1"
                      :aria-label="`Move ${skill.name} later`"
                      @click="moveSkill(i, i + 1)"
                    />
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="`Remove ${skill.name}`"
                      @click="cv.skills.splice(i, 1)"
                    />
                  </li>
                </VueDraggable>
                <p class="text-xs text-muted">
                  Categories and order apply to this CV only, not your profile.
                </p>
              </div>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Utdanning (Education)"
              testid="tailored-cv-education"
              :empty-message="cv.educations.length ? undefined : 'No education in this CV.'"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'educations')"
                  :key="s.key"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(e, i) in cv.educations"
                  :key="e.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="e.bullets"
                  v-model:paragraph="e.paragraph"
                  :content-style="cv.contentStyle"
                  :title="e.school"
                  :subtitle="[e.degree, e.field].filter(Boolean).join(', ')"
                  :dates="dates(e.startMonth, e.endMonth)"
                  :location="e.location"
                  :analyzable="e.sourceEntryId != null"
                  :analyzing="analyzingKey === `education:${e.sourceEntryId}`"
                  :disabled="busy"
                  @analyze="openAi(`education:${e.sourceEntryId!}`, e.school)"
                  @remove="cv.educations.splice(i, 1)"
                >
                  <UAlert
                    v-if="sectionErrors[`education:${e.sourceEntryId!}`]"
                    color="error"
                    variant="subtle"
                    icon="i-lucide-circle-alert"
                    :title="sectionErrors[`education:${e.sourceEntryId!}`]"
                    :description="sectionDetails[`education:${e.sourceEntryId!}`]"
                    :ui="{ description: 'text-xs break-words' }"
                    data-testid="tailored-cv-entry-error"
                  />
                  <ListingsTailoredCvSuggestion
                    v-for="s in suggestionsFor((k) => k === `education:${e.sourceEntryId}`)"
                    :key="s.key"
                    :current="s.current"
                    :suggested="s.suggested"
                    @accept="state.accept(s.key)"
                    @dismiss="state.dismiss(s.key)"
                  />
                  <template #fields>
                    <UFormField label="School"
                      ><UInput v-model="e.school" class="w-full"
                    /></UFormField>
                    <UFormField label="Degree"
                      ><UInput
                        :model-value="e.degree ?? undefined"
                        class="w-full"
                        @update:model-value="e.degree = $event"
                    /></UFormField>
                    <UFormField label="Field" class="sm:col-span-2"
                      ><UInput
                        :model-value="e.field ?? undefined"
                        class="w-full"
                        @update:model-value="e.field = $event"
                    /></UFormField>
                    <UFormField label="Location" class="sm:col-span-2"
                      ><UInput
                        :model-value="e.location ?? undefined"
                        class="w-full"
                        @update:model-value="e.location = $event"
                    /></UFormField>
                    <UFormField label="Start"><AppMonthField v-model="e.startMonth" /></UFormField>
                    <UFormField label="End"><AppMonthField v-model="e.endMonth" /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Sertifiseringer (Certifications)"
              testid="tailored-cv-certifications"
              :empty-message="
                cv.certifications.length ? undefined : 'No certifications in this CV.'
              "
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'certifications')"
                  :key="s.key"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(c, i) in cv.certifications"
                  :key="c.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="c.bullets"
                  v-model:paragraph="c.paragraph"
                  :content-style="cv.contentStyle"
                  :title="c.name"
                  :subtitle="c.issuer"
                  :dates="dates(c.issuedMonth, c.expiresMonth)"
                  @remove="cv.certifications.splice(i, 1)"
                >
                  <template #fields>
                    <UFormField label="Name"><UInput v-model="c.name" class="w-full" /></UFormField>
                    <UFormField label="Issuer"
                      ><UInput
                        :model-value="c.issuer ?? undefined"
                        class="w-full"
                        @update:model-value="c.issuer = $event"
                    /></UFormField>
                    <UFormField label="Issued"
                      ><AppMonthField v-model="c.issuedMonth"
                    /></UFormField>
                    <UFormField label="Expires"
                      ><AppMonthField v-model="c.expiresMonth"
                    /></UFormField>
                    <UFormField label="URL" class="sm:col-span-2"
                      ><UInput
                        :model-value="c.url ?? undefined"
                        type="url"
                        class="w-full"
                        @update:model-value="c.url = $event"
                    /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Prosjekter (Projects)"
              testid="tailored-cv-projects"
              :empty-message="cv.projects.length ? undefined : 'No projects in this CV.'"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'projects')"
                  :key="s.key"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(p, i) in cv.projects"
                  :key="p.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="p.bullets"
                  v-model:paragraph="p.paragraph"
                  :content-style="cv.contentStyle"
                  :title="p.name"
                  :subtitle="p.url"
                  :dates="dates(p.startMonth, p.endMonth)"
                  :location="p.location"
                  @remove="cv.projects.splice(i, 1)"
                >
                  <template #fields>
                    <UFormField label="Name"><UInput v-model="p.name" class="w-full" /></UFormField>
                    <UFormField label="URL"
                      ><UInput
                        :model-value="p.url ?? undefined"
                        type="url"
                        class="w-full"
                        @update:model-value="p.url = $event"
                    /></UFormField>
                    <UFormField label="Location" class="sm:col-span-2"
                      ><UInput
                        :model-value="p.location ?? undefined"
                        class="w-full"
                        @update:model-value="p.location = $event"
                    /></UFormField>
                    <UFormField label="Start"><AppMonthField v-model="p.startMonth" /></UFormField>
                    <UFormField label="End"><AppMonthField v-model="p.endMonth" /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Språk (Languages)"
              testid="tailored-cv-languages"
              :empty-message="cv.languages.length ? undefined : 'No languages in this CV.'"
            >
              <template #suggestions>
                <ListingsTailoredCvSuggestion
                  v-for="s in suggestionsFor((k) => k === 'languages')"
                  :key="s.key"
                  :current="s.current"
                  :suggested="s.suggested"
                  @accept="state.accept(s.key)"
                  @dismiss="state.dismiss(s.key)"
                />
              </template>
              <div class="space-y-2">
                <div v-for="(l, i) in cv.languages" :key="i" class="flex items-center gap-2">
                  <UInput
                    v-model="l.name"
                    placeholder="Language"
                    class="min-w-0 flex-1"
                    :aria-label="`Language ${i + 1}`"
                  />
                  <USelect
                    :model-value="l.spoken ?? undefined"
                    :items="[...PROFICIENCY_OPTIONS]"
                    placeholder="Spoken"
                    class="w-32"
                    :aria-label="`Spoken level for language ${i + 1}`"
                    @update:model-value="l.spoken = $event"
                  />
                  <USelect
                    :model-value="l.written ?? undefined"
                    :items="[...PROFICIENCY_OPTIONS]"
                    placeholder="Written"
                    class="w-32"
                    :aria-label="`Written level for language ${i + 1}`"
                    @update:model-value="l.written = $event"
                  />
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    :aria-label="`Remove language ${i + 1}`"
                    @click="cv.languages.splice(i, 1)"
                  />
                </div>
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  @click="addLanguage"
                  >Add language</UButton
                >
              </div>
            </ListingsTailoredCvSection>

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
                <UBadge
                  v-if="suggestions.length"
                  color="warning"
                  variant="subtle"
                  data-testid="tailored-cv-pending"
                  >{{ pendingLabel }} to review</UBadge
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
        :document-id="pdf.id"
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
        confirm-label="Reset"
        @confirm="resetToProfile"
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
        class="flex items-center gap-3 rounded-lg border border-default bg-default p-4 shadow-lg"
      >
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" />
        <div>
          <p class="font-medium text-highlighted">{{ progress?.label ?? 'Analyzing your CV' }}</p>
          <p v-if="progress" class="text-sm text-muted">
            Step {{ progress.step }} of {{ progress.total }} · Nothing is saved yet
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
