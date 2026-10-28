<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CvProfileList, TailoredCv, TailoredCvSectionKey } from '~/utils/tailoredCv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { VueDraggable } from 'vue-draggable-plus'
import { LANGUAGE_OPTIONS, PROFICIENCY_OPTIONS, projectKindLabel } from '~/constants/listing'

definePageMeta({ title: 'Tailored CV' })

const SECTION_ORDER_OPTIONS = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Developer', value: 'DEVELOPER' }
]
const SECTION_ORDER_HINTS = {
  STANDARD: 'Standard order; skills on one line in the order shown; technologies not printed.',
  DEVELOPER:
    'Links under the contact lines, skills and projects moved up, skills grouped by category, technologies under entries.'
} as const

// The owner's categories (edited on the skills page); a deleted one shows as uncategorized.
const { items: categoryItems, known: knownCategory } = useSkillCategories()
const moveSkill = (from: number, to: number) => {
  const skills = cv.value!.skills
  skills.splice(to, 0, ...skills.splice(from, 1))
}

const TEMPLATE_OPTIONS = [
  { label: 'Detailed', value: 'DETAILED' },
  { label: 'Concise', value: 'CONCISE' }
]
const TEMPLATE_HINTS = {
  DETAILED: 'Full bullets or paragraphs with the context behind each role.',
  CONCISE: 'Shorter bullets, aiming for a tighter, shorter CV.'
} as const

const CONTENT_STYLE_OPTIONS = [
  { label: 'Bullets', value: 'BULLETS' },
  { label: 'Paragraphs', value: 'PARAGRAPH' }
]
type ContentStyle = 'BULLETS' | 'PARAGRAPH'

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
// Technologies only print in the developer layout, so the hint follows the chosen one.
const technologiesHint = computed(() =>
  cv.value?.sectionOrder === 'DEVELOPER'
    ? 'Printed under this entry in the PDF.'
    : 'Only printed with the Developer PDF layout.'
)
// The headings are English whatever the draft is written in, so the page names its language.
const languageLabel = computed(
  () => LANGUAGE_OPTIONS.find((option) => option.value === cv.value?.language)?.label
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

// Concise always prints bullets; the stored choice and paragraphs stay for switching back.
const entryStyle = computed<ContentStyle>(() =>
  cv.value?.template === 'CONCISE' ? 'BULLETS' : (cv.value?.contentStyle ?? 'BULLETS')
)
// Switching template rewrites nothing by itself; the entries follow it after the next whole-CV run.
const templateChanged = computed(
  () =>
    !!cv.value && !!state.writtenTemplate.value && cv.value.template !== state.writtenTemplate.value
)

const dates = (start?: string | null, end?: string | null, open?: string) =>
  formatMonthRange(start, end, open, 'en-GB')
const experienceName = (e: { title: string; employer: string }) =>
  [e.title, e.employer].filter(Boolean).join(' at ')

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

// Removing is instant, with Undo right after; later, the section's Add menu (or Reset to profile)
// brings a profile item back.
const removeItem = (list: CvProfileList, index: number, name: string) => {
  const [item] = (cv.value![list] as unknown[]).splice(index, 1)
  toast.add({
    title: name.trim() ? `Removed ${name} from this CV` : 'Removed from this CV',
    icon: 'i-lucide-trash-2',
    actions: [
      {
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          const items = cv.value![list] as unknown[]
          items.splice(Math.min(index, items.length), 0, item)
        }
      }
    ]
  })
}

const PROFILE_LISTS = ['experiences', 'educations', 'certifications', 'projects', 'skills'] as const
type ProfileListItem = TailoredCv[CvProfileList][number]
// Recomputed only when a list's items or the draft language change, not on every keystroke.
const missing = computed(() => {
  const draft = cv.value
  const source = profile.value
  if (!draft || !source) return undefined
  return Object.fromEntries(
    PROFILE_LISTS.map((list) => [list, missingFromProfile(draft, source, list)])
  ) as Record<CvProfileList, ProfileListItem[]>
})
const addItems = (list: CvProfileList): DropdownMenuItem[] => {
  const items = missing.value?.[list] ?? []
  if (!items.length)
    return [{ label: 'Everything from your profile is already here', disabled: true }]
  return items.map((item) => ({
    label: 'employer' in item ? experienceName(item) : 'school' in item ? item.school : item.name,
    onSelect: () => addFromProfile(cv.value!, profile.value!, list, item)
  }))
}
const emptyMessage = (list: CvProfileList, none: string) => {
  if (cv.value![list].length) return undefined
  return missing.value?.[list].length ? `${none} Use Add to bring it back from your profile.` : none
}

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
              <UBadge
                v-if="cv && languageLabel"
                color="neutral"
                variant="subtle"
                class="mt-1"
                data-testid="tailored-cv-language"
                >Written in {{ languageLabel }}</UBadge
              >
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
                <USelect
                  v-model="cv.template"
                  :items="TEMPLATE_OPTIONS"
                  :disabled="analyzing"
                  class="w-full"
                  data-testid="tailored-cv-template"
                />
              </UFormField>
              <UFormField
                label="Entry format"
                :description="
                  cv.template === 'CONCISE'
                    ? 'Concise CVs always use bullets. Your paragraph choice is kept if you switch back.'
                    : 'Experience, education, certifications and projects are all written as bullets or as paragraphs.'
                "
              >
                <USelect
                  :model-value="entryStyle"
                  :items="CONTENT_STYLE_OPTIONS"
                  :disabled="analyzing || cv.template === 'CONCISE'"
                  class="w-full"
                  data-testid="tailored-cv-content-style"
                  @update:model-value="setContentStyle($event as ContentStyle)"
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

            <ListingsTailoredCvSection
              title="Contact and headline"
              testid="tailored-cv-contact"
              :suggestions="suggestionsFor('headline')"
              suggestion-label="Headline"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
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
                  <UFieldGroup class="w-full">
                    <UInput v-model="cv.dateOfBirth" type="date" class="w-full" />
                    <UButton
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-x"
                      aria-label="Clear date of birth"
                      data-testid="cv-dob-clear"
                      :disabled="!cv.dateOfBirth"
                      @click="cv.dateOfBirth = ''"
                    />
                  </UFieldGroup>
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
              title="Summary"
              testid="tailored-cv-summary"
              analyzable
              :analyzing="analyzingKey === 'summary'"
              :disabled="busy"
              :error="sectionErrors.summary"
              :error-detail="sectionDetails.summary"
              :suggestions="suggestionsFor('summary')"
              @analyze="openAi('summary', 'the summary')"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
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
              title="Experience"
              testid="tailored-cv-experience"
              :empty-message="emptyMessage('experiences', 'No experience in this CV.')"
              :suggestions="suggestionsFor('experiences')"
              suggestion-label="All experience"
              :add-items="addItems('experiences')"
              add-label="Add experience from your profile"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(e, i) in cv.experiences"
                  :key="e.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="e.bullets"
                  v-model:paragraph="e.paragraph"
                  :content-style="entryStyle"
                  :title="e.title"
                  :subtitle="e.employer"
                  :dates="dates(e.startMonth, e.endMonth, 'Present')"
                  :location="e.location"
                  :technologies="e.technologies"
                  :analyzable="e.sourceEntryId != null"
                  :analyzing="analyzingKey === `experience:${e.sourceEntryId}`"
                  :disabled="busy"
                  :error="sectionErrors[`experience:${e.sourceEntryId!}`]"
                  :error-detail="sectionDetails[`experience:${e.sourceEntryId!}`]"
                  :suggestions="suggestionsFor(`experience:${e.sourceEntryId}`)"
                  @analyze="openAi(`experience:${e.sourceEntryId!}`, experienceName(e))"
                  @remove="removeItem('experiences', i, e.title)"
                  @accept="state.accept"
                  @dismiss="state.dismiss"
                >
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
                    <UFormField label="Technologies" :help="technologiesHint" class="sm:col-span-2"
                      ><ProfileNamesField
                        v-model="e.technologies"
                        lookup="skills"
                        placeholder="Add a technology"
                    /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Skills"
              testid="tailored-cv-skills"
              analyzable
              :analyzing="analyzingKey === 'skills'"
              :disabled="busy"
              :error="sectionErrors.skills"
              :error-detail="sectionDetails.skills"
              :empty-message="emptyMessage('skills', 'No skills in this CV.')"
              :suggestions="suggestionsFor('skills')"
              :add-items="addItems('skills')"
              add-label="Add a skill from your profile"
              @analyze="openAi('skills', 'skills')"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
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
                  <!-- Keyed without the index, so moving a skill keeps its row (and the focused
                     button) instead of remounting it. Phones: name and remove first, then the
                     category and order controls on their own line. -->
                  <li
                    v-for="(skill, i) in cv.skills"
                    :key="skill.sourceSkillId ?? skill.name"
                    class="flex flex-wrap items-center gap-x-1 gap-y-1"
                    data-testid="tailored-cv-skill"
                  >
                    <!-- Mouse only: the arrow buttons cover touch and keyboard, so no tab stop. -->
                    <span
                      class="drag-handle hidden shrink-0 cursor-grab touch-none p-1.5 text-muted sm:inline-flex"
                      aria-hidden="true"
                    >
                      <UIcon name="i-lucide-grip-vertical" class="size-4" />
                    </span>
                    <span class="min-w-0 flex-1 break-words">{{ skill.name }}</span>
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="sm:order-last"
                      :aria-label="`Remove ${skill.name}`"
                      @click="removeItem('skills', i, skill.name)"
                    />
                    <div class="flex w-full items-center gap-1 sm:w-auto">
                      <!-- Categories only group skills in the Developer layout. -->
                      <USelect
                        v-if="cv.sectionOrder === 'DEVELOPER'"
                        :model-value="knownCategory(skill.categoryId)"
                        :items="categoryItems"
                        size="sm"
                        :aria-label="`${skill.name} category`"
                        class="w-40 shrink-0"
                        @update:model-value="
                          (choice) => (skill.categoryId = fromCategoryChoice(choice))
                        "
                      />
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
                    </div>
                  </li>
                </VueDraggable>
                <p class="text-xs text-muted">
                  {{
                    cv.sectionOrder === 'DEVELOPER'
                      ? 'Categories and order apply to this CV only, not your profile.'
                      : 'The order applies to this CV only. Categories show with the Developer PDF layout.'
                  }}
                </p>
              </div>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Education"
              testid="tailored-cv-education"
              :empty-message="emptyMessage('educations', 'No education in this CV.')"
              :suggestions="suggestionsFor('educations')"
              suggestion-label="All education"
              :add-items="addItems('educations')"
              add-label="Add education from your profile"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(e, i) in cv.educations"
                  :key="e.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="e.bullets"
                  v-model:paragraph="e.paragraph"
                  :content-style="entryStyle"
                  :title="e.school"
                  :subtitle="[e.degree, e.field].filter(Boolean).join(', ')"
                  :dates="dates(e.startMonth, e.endMonth)"
                  :location="e.location"
                  :analyzable="e.sourceEntryId != null"
                  :analyzing="analyzingKey === `education:${e.sourceEntryId}`"
                  :disabled="busy"
                  :error="sectionErrors[`education:${e.sourceEntryId!}`]"
                  :error-detail="sectionDetails[`education:${e.sourceEntryId!}`]"
                  :suggestions="suggestionsFor(`education:${e.sourceEntryId}`)"
                  @analyze="openAi(`education:${e.sourceEntryId!}`, e.school)"
                  @remove="removeItem('educations', i, e.school)"
                  @accept="state.accept"
                  @dismiss="state.dismiss"
                >
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
                    <UFormField label="End" help="Empty means ongoing."
                      ><AppMonthField v-model="e.endMonth"
                    /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Certifications"
              testid="tailored-cv-certifications"
              :empty-message="emptyMessage('certifications', 'No certifications in this CV.')"
              :suggestions="suggestionsFor('certifications')"
              suggestion-label="All certifications"
              :add-items="addItems('certifications')"
              add-label="Add a certification from your profile"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(c, i) in cv.certifications"
                  :key="c.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="c.bullets"
                  v-model:paragraph="c.paragraph"
                  :content-style="entryStyle"
                  :title="c.name"
                  :subtitle="c.issuer"
                  :dates="dates(c.issuedMonth, c.expiresMonth)"
                  @remove="removeItem('certifications', i, c.name)"
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
              title="Projects"
              testid="tailored-cv-projects"
              :empty-message="emptyMessage('projects', 'No projects in this CV.')"
              :suggestions="suggestionsFor('projects')"
              suggestion-label="All projects"
              :add-items="addItems('projects')"
              add-label="Add a project from your profile"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
              <ul class="divide-y divide-default">
                <ListingsTailoredCvEntry
                  v-for="(p, i) in cv.projects"
                  :key="p.sourceEntryId ?? `new-${i}`"
                  v-model:bullets="p.bullets"
                  v-model:paragraph="p.paragraph"
                  :content-style="entryStyle"
                  :title="p.name"
                  :subtitle="p.url"
                  :dates="dates(p.startMonth, p.endMonth)"
                  :location="p.location"
                  :badge="projectKindLabel(p.kind)"
                  :technologies="p.technologies"
                  :analyzable="p.sourceEntryId != null"
                  :analyzing="analyzingKey === `project:${p.sourceEntryId}`"
                  :disabled="busy"
                  :error="sectionErrors[`project:${p.sourceEntryId!}`]"
                  :error-detail="sectionDetails[`project:${p.sourceEntryId!}`]"
                  :suggestions="suggestionsFor(`project:${p.sourceEntryId}`)"
                  @analyze="openAi(`project:${p.sourceEntryId!}`, p.name)"
                  @remove="removeItem('projects', i, p.name)"
                  @accept="state.accept"
                  @dismiss="state.dismiss"
                >
                  <template #fields>
                    <UFormField label="Name" class="sm:col-span-2"
                      ><UInput v-model="p.name" class="w-full"
                    /></UFormField>
                    <UFormField label="Type"
                      ><ProfileProjectKindSelect v-model="p.kind"
                    /></UFormField>
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
                    <UFormField label="End" help="Empty means ongoing."
                      ><AppMonthField v-model="p.endMonth"
                    /></UFormField>
                    <UFormField label="Technologies" :help="technologiesHint" class="sm:col-span-2"
                      ><ProfileNamesField
                        v-model="p.technologies"
                        lookup="skills"
                        placeholder="Add a technology"
                    /></UFormField>
                  </template>
                </ListingsTailoredCvEntry>
              </ul>
            </ListingsTailoredCvSection>

            <ListingsTailoredCvSection
              title="Languages"
              testid="tailored-cv-languages"
              :empty-message="cv.languages.length ? undefined : 'No languages in this CV.'"
              :suggestions="suggestionsFor('languages')"
              @accept="state.accept"
              @dismiss="state.dismiss"
            >
              <div class="space-y-3">
                <!-- Phones: name and remove, then both levels side by side; one row from md. -->
                <div
                  v-for="(l, i) in cv.languages"
                  :key="i"
                  class="flex flex-wrap items-end gap-2"
                  data-testid="tailored-cv-language-row"
                >
                  <UFormField label="Language" class="min-w-0 flex-1">
                    <UInput v-model="l.name" class="w-full" />
                  </UFormField>
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    class="mb-1 md:order-last"
                    :aria-label="`Remove language ${i + 1}`"
                    @click="cv.languages.splice(i, 1)"
                  />
                  <div class="grid w-full grid-cols-2 gap-2 md:w-72">
                    <UFormField label="Spoken">
                      <USelect
                        :model-value="l.spoken ?? undefined"
                        :items="[...PROFICIENCY_OPTIONS]"
                        placeholder="Choose"
                        class="w-full"
                        @update:model-value="l.spoken = $event"
                      />
                    </UFormField>
                    <UFormField label="Written">
                      <USelect
                        :model-value="l.written ?? undefined"
                        :items="[...PROFICIENCY_OPTIONS]"
                        placeholder="Choose"
                        class="w-full"
                        @update:model-value="l.written = $event"
                      />
                    </UFormField>
                  </div>
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

            <AppCard title="PDF" data-testid="tailored-cv-pdf">
              <UFormField
                label="PDF layout"
                :description="SECTION_ORDER_HINTS[cv.sectionOrder]"
                help="Only changes the PDF, not the text you edit."
              >
                <USelect
                  v-model="cv.sectionOrder"
                  :items="SECTION_ORDER_OPTIONS"
                  :disabled="analyzing"
                  class="w-full sm:w-56"
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
        confirm-label="Reset to profile"
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
