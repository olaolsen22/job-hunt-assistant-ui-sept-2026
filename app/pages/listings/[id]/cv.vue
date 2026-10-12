<script setup lang="ts">
import type { TailoredCvSectionKey } from '~/utils/tailoredCv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { CEFR_LEVELS, LANGUAGE_OPTIONS } from '~/constants/listing'

definePageMeta({ title: 'Tailored CV' })

const route = useRoute()
const id = Number(route.params.id)

const {
  listing,
  loading: listingLoading,
  error: listingError,
  refresh: refreshListing
} = await useListing(id)
const { profile, error: profileError } = useProfile()
const state = useTailoredCvDraft(id, profile)
const { cv, dirty, suggestions, sectionErrors, analyzing, analyzingKey, progress } = state
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
// Loaded up front, so "Copy prompt to clipboard" is a direct write (browsers can refuse one after an await).
onMounted(() => state.loadPrompt())

// A failed refresh after generating keeps the listing it already has, so it isn't a load error.
const loadError = computed(
  () => (!listing.value && listingError.value) || profileError.value || state.query.error.value
)
const busy = computed(() => analyzing.value || !!analyzingKey.value || state.previewing.value)

// Open PDF stays available when only the documents refresh fails, and retrying that never regenerates.
const refreshFailed = ref(false)
const refreshDocuments = async () => {
  await refreshListing()
  refreshFailed.value = !!listingError.value
}
const generatePdf = async () => {
  refreshFailed.value = false
  if (await state.generate()) await refreshDocuments()
}
const canGenerate = computed(
  () => !!state.draft.value && !dirty.value && !busy.value && !state.saving.value
)

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

const suggestionsFor = (match: (key: TailoredCvSectionKey) => boolean) =>
  suggestions.value
    .filter((s) => match(s.key))
    .map((s) => ({
      ...s,
      current: cvSectionText(s.key, cv.value && getCvSection(cv.value, s.key)),
      suggested: cvSectionText(s.key, s.value)
    }))

const dates = (start?: string | null, end?: string | null, open?: string) =>
  formatMonthRange(start, end, open, 'en-GB')

// The API rejects an unknown language, so only the ones not already listed can be added.
const addLanguage = () => {
  const used = new Set(cv.value!.languages.map((l) => l.language))
  const next = LANGUAGE_OPTIONS.find((o) => !used.has(o.value))
  if (next) cv.value!.languages.push({ language: next.value, level: null })
}

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
  <div class="flex justify-center">
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
        <div>
          <h1 class="text-xl font-semibold text-highlighted">Tailored CV</h1>
          <p
            v-if="listing"
            class="break-words text-sm text-muted"
            data-testid="tailored-cv-listing"
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
        data-testid="tailored-cv-not-found"
      />
      <UAlert
        v-else-if="loadError"
        color="error"
        :description="ERROR_MESSAGES.generic"
        data-testid="tailored-cv-load-error"
      />

      <div v-else-if="!cv" class="space-y-4" data-testid="tailored-cv-loading">
        <USkeleton class="h-28 w-full" />
        <USkeleton class="h-40 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>

      <template v-else>
        <AppCard>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-muted">
              Prefilled from your profile. Let AI pick what fits this listing, or edit it yourself.
            </p>
            <UButton
              icon="i-lucide-sparkles"
              class="justify-center"
              :disabled="busy"
              data-testid="tailored-cv-optimize"
              @click="openAi()"
              >Optimize with AI</UButton
            >
          </div>
        </AppCard>

        <ListingsTailoredCvSection title="Contact and headline" testid="tailored-cv-contact">
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
            <UFormField label="Location" class="sm:col-span-2">
              <UInput v-model="cv.location" class="w-full" />
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
          title="Experience"
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
              :title="e.title"
              :subtitle="e.employer"
              :dates="dates(e.startMonth, e.endMonth, 'Present')"
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
                <UFormField label="Title"><UInput v-model="e.title" class="w-full" /></UFormField>
                <UFormField label="Employer"
                  ><UInput v-model="e.employer" class="w-full"
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
          title="Skills"
          testid="tailored-cv-skills"
          analyzable
          :analyzing="analyzingKey === 'skills'"
          :disabled="busy"
          :error="sectionErrors.skills"
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
            <div class="flex flex-wrap gap-2" data-testid="tailored-cv-skill-list">
              <UBadge
                v-for="(skill, i) in cv.skills"
                :key="`${skill.sourceSkillId ?? skill.name}-${i}`"
                color="neutral"
                variant="subtle"
                size="lg"
                class="gap-1"
              >
                {{ skill.name }}
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="link"
                  size="xs"
                  class="p-0"
                  :aria-label="`Remove ${skill.name}`"
                  @click="cv.skills.splice(i, 1)"
                />
              </UBadge>
            </div>
          </div>
        </ListingsTailoredCvSection>

        <ListingsTailoredCvSection
          title="Education"
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
              :title="e.school"
              :subtitle="[e.degree, e.field].filter(Boolean).join(', ')"
              :dates="dates(e.startMonth, e.endMonth)"
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
                <UFormField label="School"><UInput v-model="e.school" class="w-full" /></UFormField>
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
                <UFormField label="Start"><AppMonthField v-model="e.startMonth" /></UFormField>
                <UFormField label="End"><AppMonthField v-model="e.endMonth" /></UFormField>
              </template>
            </ListingsTailoredCvEntry>
          </ul>
        </ListingsTailoredCvSection>

        <ListingsTailoredCvSection
          title="Certifications"
          testid="tailored-cv-certifications"
          :empty-message="cv.certifications.length ? undefined : 'No certifications in this CV.'"
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
                <UFormField label="Issued"><AppMonthField v-model="c.issuedMonth" /></UFormField>
                <UFormField label="Expires"><AppMonthField v-model="c.expiresMonth" /></UFormField>
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
              :title="p.name"
              :subtitle="p.url"
              :dates="dates(p.startMonth, p.endMonth)"
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
                <UFormField label="Start"><AppMonthField v-model="p.startMonth" /></UFormField>
                <UFormField label="End"><AppMonthField v-model="p.endMonth" /></UFormField>
              </template>
            </ListingsTailoredCvEntry>
          </ul>
        </ListingsTailoredCvSection>

        <ListingsTailoredCvSection
          title="Languages"
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
            <div v-for="(l, i) in cv.languages" :key="l.language" class="flex items-center gap-2">
              <span class="flex-1 text-sm">{{
                LANGUAGE_OPTIONS.find((o) => o.value === l.language)?.label ?? l.language
              }}</span>
              <USelect
                :model-value="l.level ?? undefined"
                :items="[...CEFR_LEVELS]"
                placeholder="Level"
                class="w-28"
                :aria-label="`Level for language ${i + 1}`"
                @update:model-value="l.level = $event"
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
              v-if="cv.languages.length < LANGUAGE_OPTIONS.length"
              icon="i-lucide-plus"
              color="neutral"
              variant="subtle"
              size="sm"
              @click="addLanguage"
              >Add language</UButton
            >
          </div>
        </ListingsTailoredCvSection>

        <!-- Sticky so Save stays in reach on long drafts; translucent like the dashboard header.
             On phones the status takes its own line above two equal buttons. -->
        <div class="space-y-2" data-testid="tailored-cv-pdf">
          <p v-if="state.draft.value" class="text-sm text-muted">
            {{
              dirty
                ? 'Save your changes to generate a PDF from them.'
                : 'Generate PDF uses the saved draft. Each time adds a new unsent PDF and keeps the earlier ones.'
            }}
          </p>
          <UAlert
            v-if="state.generated.value"
            color="success"
            icon="i-lucide-check"
            title="PDF created"
            :description="state.generated.value.fileName"
            :actions="[
              {
                label: 'Open PDF',
                to: `/api/documents/${state.generated.value.id}`,
                target: '_blank',
                icon: 'i-lucide-external-link',
                color: 'neutral',
                variant: 'outline'
              }
            ]"
            data-testid="tailored-cv-generated"
          />
          <UAlert
            v-if="refreshFailed"
            color="warning"
            description="The PDF was created, but the listing's documents could not be refreshed."
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
                ? 'The saved draft no longer exists. Save the draft first, then generate the PDF.'
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
          />
        </div>

        <div
          class="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-default bg-default/90 p-3 backdrop-blur"
          data-testid="tailored-cv-save-bar"
        >
          <span
            class="order-first w-full text-sm text-muted sm:order-none sm:w-auto sm:flex-1 sm:text-right"
            data-testid="tailored-cv-save-status"
            >{{ dirty ? 'Unsaved changes' : 'Saved' }}</span
          >
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="subtle"
            class="flex-1 justify-center sm:order-first sm:flex-none"
            data-testid="tailored-cv-copy"
            @click="copy(cv)"
            >Copy as text</UButton
          >
          <UButton
            v-if="state.draft.value"
            icon="i-lucide-file-down"
            :color="dirty ? 'neutral' : 'primary'"
            :variant="dirty ? 'subtle' : 'solid'"
            :loading="state.generating.value"
            :disabled="!canGenerate"
            class="flex-1 justify-center sm:flex-none"
            data-testid="tailored-cv-generate"
            @click="generatePdf"
            >{{ state.generating.value ? 'Generating PDF…' : 'Generate PDF' }}</UButton
          >
          <UButton
            icon="i-lucide-save"
            :loading="state.saving.value"
            :disabled="!dirty || busy"
            class="flex-1 justify-center sm:flex-none"
            data-testid="tailored-cv-save"
            @click="state.save()"
            >Save draft</UButton
          >
        </div>
      </template>
    </div>

    <!-- Whole-CV analysis takes one AI call per section; blocking the page keeps edits from racing it. -->
    <Teleport to="body">
      <div
        v-if="analyzing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-default/60 backdrop-blur-sm"
        data-testid="tailored-cv-overlay"
      >
        <div class="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
          <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
          <p class="font-medium text-highlighted">{{ progress?.label ?? 'Analyzing' }}</p>
          <p v-if="progress" class="text-sm text-muted">
            Step {{ progress.step }} of {{ progress.total }} · Nothing is saved yet
          </p>
        </div>
      </div>
    </Teleport>

    <ListingsTailoredCvAiModal
      v-model:open="aiOpen"
      :ai="state"
      :scope="aiScope"
      :scope-label="aiScopeLabel"
      @analyze="runBuiltIn"
    />

    <AppConfirmModal
      v-model:open="leaveOpen"
      title="Leave without saving?"
      description="Your tailored CV has unsaved changes. They will be lost."
      confirm-label="Leave"
      @confirm="leave"
    />
  </div>
</template>
