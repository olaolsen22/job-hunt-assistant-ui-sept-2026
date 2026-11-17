<script setup lang="ts">
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import type { DropdownMenuItem } from '@nuxt/ui'
import { CV_APPLY_DESCRIPTION, projectKindLabel } from '~/constants/listing'
import type {
  CvEditorAi,
  CvEntry,
  CvEntryList,
  CvProfileList,
  TailoredCv
} from '~/utils/tailoredCv'

// The CV's content cards, shared by the tailored CV and CV template editors: contact, summary,
// entries, skills and languages, each edited in its own modal on a copy and applied to `cv`.
// `ai` adds the tailored page's suggestions and AI runs; without it the cards are plain editors.
const {
  source,
  disabled = false,
  ai = undefined,
  flagLanguage = '',
  skillsModal = false,
  columns = false
} = defineProps<{
  // The API's prefill in this CV's language: what the Add menus offer back.
  source: TailoredCv | null | undefined
  disabled?: boolean
  ai?: CvEditorAi
  // The language that `flagged` text is still in, for its badges ("Still in English").
  flagLanguage?: string
  // The tailored CV: the Skills card lists skills and an Edit modal reorders them, instead of
  // inline rows with every control.
  skillsModal?: boolean
  // The tailored CV: two columns from 2xl, with the `aside-start` slot (settings) atop the side one.
  // Without it the slot renders first, above the single column.
  columns?: boolean
}>()
const cv = defineModel<TailoredCv>('cv', { required: true })
// Content paths still in another language (a translated CV template). Each card shows a badge
// for its own; applying that card's edit clears them, since the owner has reviewed it.
const flagged = defineModel<string[]>('flagged', { default: () => [] })
const flagCounts = computed(() => cvFlagCounts(flagged.value))
const warning = (key: string) => {
  const count = flagCounts.value.get(key)
  if (!count) return undefined
  return count === 1 ? `Still in ${flagLanguage}` : `${count} parts still in ${flagLanguage}`
}
const clearFlags = (key: string) => {
  if (flagCounts.value.has(key)) flagged.value = clearCvFlags(flagged.value, key)
}

// Each card is written once and placed by the layout below (one column, or two on wide screens).
const [DefineContact, ContactCard] = createReusableTemplate()
const [DefineSummary, SummaryCard] = createReusableTemplate()
const [DefineExperience, ExperienceCard] = createReusableTemplate()
const [DefineSkills, SkillsCard] = createReusableTemplate()
const [DefineEducation, EducationCard] = createReusableTemplate()
const [DefineCertifications, CertificationsCard] = createReusableTemplate()
const [DefineProjects, ProjectsCard] = createReusableTemplate()
const [DefineLanguages, LanguagesCard] = createReusableTemplate()
// Opt-in for the tailored CV; the CV template editor keeps its single column.
const wide = useMediaQuery('(min-width: 1536px)')
const twoColumns = computed(() => columns && wide.value)

const notify = useAppToast()
const entryStyle = computed(() => cv.value.contentStyle)

const skillsOpen = ref(false)
const skillsOpened = useOpenedOnce(skillsOpen)
const groupsOpen = ref(false)
const groupsInput = computed(() => ({
  skillNames: cv.value.skills.map((s) => s.name),
  language: cv.value.language
}))
// Fills in the AI's groups for review; skills it left out keep theirs, and Undo restores them all.
const applyGroups = (groups: Map<string, string>) => {
  const skills = cv.value.skills
  const before = skills.map((s) => [s, s.group] as const)
  for (const skill of skills) skill.group = groups.get(skill.name) ?? skill.group
  clearFlags('skills')
  notify.undoable(
    'Groups suggested',
    () => before.forEach(([skill, group]) => (skill.group = group)),
    { description: 'Review them, then save.', icon: 'i-lucide-sparkles' }
  )
}

const dates = (start?: string | null, end?: string | null, open?: string) =>
  formatMonthRange(start, end, open, 'en-GB')
const experienceName = (e: { title: string; employer: string }) =>
  [e.title, e.employer].filter(Boolean).join(' at ')

// Each Edit opens a modal on a copy; Apply puts it back into the CV, and the page's save persists it.
// The modal covers the page, so the entry's index can't change while it's open.
const editedEntry = ref<{ list: CvEntryList; index: number; entry: CvEntry }>()
const entryOpen = ref(false)
const editEntry = (list: CvEntryList, index: number) => {
  editedEntry.value = { list, index, entry: cv.value[list][index]! }
  entryOpen.value = true
}
const applyEntry = (entry: CvEntry) => {
  const { list, index } = editedEntry.value!
  ;(cv.value[list] as CvEntry[])[index] = entry
  clearFlags(`${list}[${index}]`)
}

const contactOpen = ref(false)
const contactOpened = useOpenedOnce(contactOpen)
const languagesOpen = ref(false)
const languagesOpened = useOpenedOnce(languagesOpen)

const summaryOpen = ref(false)
const summaryDraft = ref('')
const editSummary = () => {
  summaryDraft.value = cv.value.summary
  summaryOpen.value = true
}
const applySummary = () => {
  cv.value.summary = summaryDraft.value
  summaryOpen.value = false
  clearFlags('summary')
}

// Read views: only what's filled in, one line per contact detail or language.
const contactLines = computed(() => {
  const c = cv.value
  return [
    [c.email, c.phone].filter(Boolean).join(' · '),
    c.address,
    c.dateOfBirth && `Born ${formatDate(c.dateOfBirth, 'en-GB')}`,
    c.referencesOnRequest && 'References available on request'
  ].filter((line): line is string => !!line)
})
const links = computed(() => cv.value.links.filter((l) => l.url.trim()))
const hasContact = computed(
  () =>
    !!(cv.value.fullName || cv.value.headline || contactLines.value.length || links.value.length)
)
const languageLine = (l: TailoredCv['languages'][number]) =>
  [
    l.name.trim() || 'Unnamed language',
    l.spoken && `Spoken: ${proficiencyLabel(l.spoken)}`,
    l.written && `Written: ${proficiencyLabel(l.written)}`
  ]
    .filter(Boolean)
    .join(' · ')

// Removing is instant, with Undo right after; later, the section's Add menu (or a reset to the
// profile) brings a profile item back.
const removeItem = (list: CvProfileList, index: number, name: string) => {
  const [item] = (cv.value[list] as unknown[]).splice(index, 1)
  // Undo puts the item back without its flags; it was looked at before removing.
  if (flagged.value.length) flagged.value = removeCvFlagItem(flagged.value, list, index)
  notify.undoable(
    name.trim() ? `Removed ${name} from this CV` : 'Removed from this CV',
    () => {
      const items = cv.value[list] as unknown[]
      items.splice(Math.min(index, items.length), 0, item)
    },
    { icon: 'i-lucide-trash-2' }
  )
}

const PROFILE_LISTS = ['experiences', 'educations', 'certifications', 'projects', 'skills'] as const
type ProfileListItem = TailoredCv[CvProfileList][number]
// Recomputed only when a list's items or the CV language change, not on every keystroke.
const missing = computed(() => {
  const draft = cv.value
  if (!source) return undefined
  return Object.fromEntries(
    PROFILE_LISTS.map((list) => [list, missingFromProfile(draft, source, list)])
  ) as Record<CvProfileList, ProfileListItem[]>
})
const addItems = (list: CvProfileList): DropdownMenuItem[] => {
  if (!missing.value) return [{ label: 'Your profile isn’t loaded yet', disabled: true }]
  const items = missing.value[list]
  if (!items.length)
    return [{ label: 'Everything from your profile is already here', disabled: true }]
  return items.map((item) => ({
    label: 'employer' in item ? experienceName(item) : 'school' in item ? item.school : item.name,
    onSelect: () => addFromProfile(cv.value, source!, list, item)
  }))
}
const emptyMessage = (list: CvProfileList, none: string) => {
  if (cv.value[list].length) return undefined
  return missing.value?.[list].length ? `${none} Use Add to bring it back from your profile.` : none
}
</script>

<template>
  <DefineContact>
    <ListingsTailoredCvSection
      title="Contact and headline"
      testid="tailored-cv-contact"
      :warning="warning('contact')"
      editable
      v-bind="ai?.review('headline')"
      suggestion-label="Headline"
      :empty-message="hasContact ? undefined : 'No contact details yet.'"
      @edit="contactOpen = true"
    >
      <div v-if="hasContact" class="space-y-1 break-words text-sm">
        <p v-if="cv.fullName" class="font-medium text-highlighted">{{ cv.fullName }}</p>
        <p v-if="cv.headline">{{ cv.headline }}</p>
        <p v-for="line in contactLines" :key="line" class="text-muted">{{ line }}</p>
        <p v-if="links.length" class="flex flex-wrap gap-x-3 gap-y-1">
          <ULink
            v-for="(link, i) in links"
            :key="i"
            :to="link.url"
            target="_blank"
            class="break-all"
            >{{ link.label.trim() || link.url }}</ULink
          >
        </p>
      </div>
    </ListingsTailoredCvSection>
  </DefineContact>

  <DefineSummary>
    <ListingsTailoredCvSection
      title="Summary"
      testid="tailored-cv-summary"
      :warning="warning('summary')"
      editable
      :analyzable="!!ai?.analyze"
      v-bind="ai?.section('summary')"
      :empty-message="cv.summary.trim() ? undefined : 'No summary yet.'"
      @edit="editSummary"
      @analyze="ai?.analyze?.('summary', 'the summary')"
    >
      <p
        v-if="cv.summary.trim()"
        class="whitespace-pre-wrap break-words text-sm"
        data-testid="tailored-cv-summary-text"
      >
        {{ cv.summary }}
      </p>
    </ListingsTailoredCvSection>
  </DefineSummary>

  <DefineExperience>
    <ListingsTailoredCvSection
      title="Experience"
      testid="tailored-cv-experience"
      :empty-message="emptyMessage('experiences', 'No experience in this CV.')"
      v-bind="ai?.review('experiences')"
      suggestion-label="All experience (entries added or reordered)"
      :add-items="addItems('experiences')"
      add-label="Add experience from your profile"
    >
      <ul class="divide-y divide-default">
        <ListingsTailoredCvEntry
          v-for="(e, i) in cv.experiences"
          :key="e.sourceEntryId ?? `new-${i}`"
          :warning="warning(`experiences[${i}]`)"
          v-bind="ai?.section(`experience:${e.sourceEntryId!}`)"
          :bullets="e.bullets"
          :paragraph="e.paragraph"
          :content-style="entryStyle"
          :title="e.title"
          :subtitle="e.employer"
          :dates="dates(e.startMonth, e.endMonth, 'Present')"
          :location="e.location"
          :technologies="e.technologies"
          :analyzable="!!ai?.analyze && e.sourceEntryId != null"
          @edit="editEntry('experiences', i)"
          @analyze="ai?.analyze?.(`experience:${e.sourceEntryId!}`, experienceName(e))"
          @remove="removeItem('experiences', i, e.title)"
        />
      </ul>
    </ListingsTailoredCvSection>
  </DefineExperience>

  <DefineSkills>
    <ListingsTailoredCvSection
      title="Skills"
      testid="tailored-cv-skills"
      :warning="warning('skills')"
      :analyzable="!!ai?.analyze"
      v-bind="ai?.section('skills')"
      :empty-message="emptyMessage('skills', 'No skills in this CV.')"
      :add-items="addItems('skills')"
      add-label="Add a skill from your profile"
      :editable="skillsModal"
      @edit="skillsOpen = true"
      @analyze="ai?.analyze?.('skills', 'skills')"
    >
      <div class="space-y-2">
        <ul v-if="skillsModal" class="flex flex-wrap gap-1.5" data-testid="tailored-cv-skill-list">
          <li v-for="skill in cv.skills" :key="skill.sourceSkillId ?? skill.name">
            <UBadge color="neutral" variant="outline" data-testid="tailored-cv-skill">{{
              skill.name
            }}</UBadge>
          </li>
        </ul>
        <CvSkillRows
          v-else
          v-model:skills="cv.skills"
          :section-order="cv.sectionOrder"
          :disabled="disabled"
          @remove="(i, name) => removeItem('skills', i, name)"
          @group="clearFlags('skills')"
        />
        <div
          v-if="!skillsModal || cv.sectionOrder === 'DEVELOPER'"
          class="flex flex-wrap items-center justify-between gap-2"
        >
          <p v-if="!skillsModal" class="text-xs text-muted">
            {{
              cv.sectionOrder === 'DEVELOPER'
                ? 'A group replaces the category in the PDF, and skills with the same group share a line. Categories, groups and order apply to this CV only.'
                : 'The order applies to this CV only. Categories and groups show with the Developer PDF layout.'
            }}
          </p>
          <UButton
            v-if="cv.sectionOrder === 'DEVELOPER'"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="outline"
            size="sm"
            class="ml-auto"
            :disabled="disabled || !cv.skills.length"
            data-testid="tailored-cv-suggest-groups"
            @click="groupsOpen = true"
            >Suggest groups</UButton
          >
        </div>
      </div>
    </ListingsTailoredCvSection>
  </DefineSkills>

  <DefineEducation>
    <ListingsTailoredCvSection
      title="Education"
      testid="tailored-cv-education"
      :empty-message="emptyMessage('educations', 'No education in this CV.')"
      v-bind="ai?.review('educations')"
      suggestion-label="All education (entries added or reordered)"
      :add-items="addItems('educations')"
      add-label="Add education from your profile"
    >
      <ul class="divide-y divide-default">
        <ListingsTailoredCvEntry
          v-for="(e, i) in cv.educations"
          :key="e.sourceEntryId ?? `new-${i}`"
          :warning="warning(`educations[${i}]`)"
          v-bind="ai?.section(`education:${e.sourceEntryId!}`)"
          :bullets="e.bullets"
          :paragraph="e.paragraph"
          :content-style="entryStyle"
          :title="e.school"
          :subtitle="[e.degree, e.field].filter(Boolean).join(', ')"
          :dates="dates(e.startMonth, e.endMonth)"
          :location="e.location"
          :analyzable="!!ai?.analyze && e.sourceEntryId != null"
          @edit="editEntry('educations', i)"
          @analyze="ai?.analyze?.(`education:${e.sourceEntryId!}`, e.school)"
          @remove="removeItem('educations', i, e.school)"
        />
      </ul>
    </ListingsTailoredCvSection>
  </DefineEducation>

  <DefineCertifications>
    <ListingsTailoredCvSection
      title="Certifications"
      testid="tailored-cv-certifications"
      :empty-message="emptyMessage('certifications', 'No certifications in this CV.')"
      v-bind="ai?.review('certifications')"
      suggestion-label="All certifications"
      :add-items="addItems('certifications')"
      add-label="Add a certification from your profile"
    >
      <ul class="divide-y divide-default">
        <ListingsTailoredCvEntry
          v-for="(c, i) in cv.certifications"
          :key="c.sourceEntryId ?? `new-${i}`"
          :warning="warning(`certifications[${i}]`)"
          :bullets="c.bullets"
          :paragraph="c.paragraph"
          :content-style="entryStyle"
          :title="c.name"
          :subtitle="c.issuer"
          :dates="dates(c.issuedMonth, c.expiresMonth)"
          @edit="editEntry('certifications', i)"
          @remove="removeItem('certifications', i, c.name)"
        />
      </ul>
    </ListingsTailoredCvSection>
  </DefineCertifications>

  <DefineProjects>
    <ListingsTailoredCvSection
      title="Projects"
      testid="tailored-cv-projects"
      :empty-message="emptyMessage('projects', 'No projects in this CV.')"
      v-bind="ai?.review('projects')"
      suggestion-label="All projects (entries added or reordered)"
      :add-items="addItems('projects')"
      add-label="Add a project from your profile"
    >
      <ul class="divide-y divide-default">
        <ListingsTailoredCvEntry
          v-for="(p, i) in cv.projects"
          :key="p.sourceEntryId ?? `new-${i}`"
          :warning="warning(`projects[${i}]`)"
          v-bind="ai?.section(`project:${p.sourceEntryId!}`)"
          :bullets="p.bullets"
          :paragraph="p.paragraph"
          :content-style="entryStyle"
          :title="p.name"
          :subtitle="p.url"
          :dates="dates(p.startMonth, p.endMonth)"
          :location="p.location"
          :badge="projectKindLabel(p.kind)"
          :technologies="p.technologies"
          :analyzable="!!ai?.analyze && p.sourceEntryId != null"
          @edit="editEntry('projects', i)"
          @analyze="ai?.analyze?.(`project:${p.sourceEntryId!}`, p.name)"
          @remove="removeItem('projects', i, p.name)"
        />
      </ul>
    </ListingsTailoredCvSection>
  </DefineProjects>

  <DefineLanguages>
    <ListingsTailoredCvSection
      title="Languages"
      testid="tailored-cv-languages"
      :warning="warning('languages')"
      editable
      :empty-message="cv.languages.length ? undefined : 'No languages in this CV.'"
      v-bind="ai?.review('languages')"
      @edit="languagesOpen = true"
    >
      <ul v-if="cv.languages.length" class="space-y-1 break-words text-sm">
        <li v-for="(l, i) in cv.languages" :key="i" data-testid="tailored-cv-language-line">
          {{ languageLine(l) }}
        </li>
      </ul>
    </ListingsTailoredCvSection>
  </DefineLanguages>

  <!-- Wide screens (columns, 2xl): long-text cards in the main column, short lists beside them.
     The DOM follows what's on screen, so tab order and the review's Next walk it in reading order. -->
  <div
    v-if="twoColumns"
    class="grid items-start gap-6 grid-cols-[minmax(0,1fr)_26rem] min-[120rem]:grid-cols-[minmax(0,1fr)_30rem]"
    data-testid="cv-editor-columns"
  >
    <div class="min-w-0 space-y-6" data-testid="cv-editor-main">
      <ContactCard />
      <SummaryCard />
      <ExperienceCard />
      <ProjectsCard />
    </div>
    <div class="min-w-0 space-y-6" data-testid="cv-editor-aside">
      <slot name="aside-start" />
      <SkillsCard />
      <EducationCard />
      <CertificationsCard />
      <LanguagesCard />
    </div>
  </div>
  <template v-else>
    <slot name="aside-start" />
    <ContactCard />
    <SummaryCard />
    <ExperienceCard />
    <SkillsCard />
    <EducationCard />
    <CertificationsCard />
    <ProjectsCard />
    <LanguagesCard />
  </template>

  <LazyListingsTailoredCvEntryModal
    v-if="editedEntry"
    v-model:open="entryOpen"
    :list="editedEntry.list"
    :entry="editedEntry.entry"
    :content-style="entryStyle"
    :section-order="cv.sectionOrder"
    @apply="applyEntry"
  />
  <LazyListingsTailoredCvContactModal
    v-if="contactOpened"
    v-model:open="contactOpen"
    :cv="cv"
    :profile="source"
    @apply="(contact) => (Object.assign(cv, contact), clearFlags('contact'))"
  />
  <LazyListingsTailoredCvLanguagesModal
    v-if="languagesOpened"
    v-model:open="languagesOpen"
    :languages="cv.languages"
    :profile="source"
    @apply="(languages) => ((cv.languages = languages), clearFlags('languages'))"
  />
  <AppFormModal
    v-model:open="summaryOpen"
    title="Edit summary"
    :description="CV_APPLY_DESCRIPTION"
    save-label="Apply"
    :state="{ summary: summaryDraft }"
    @submit="applySummary"
  >
    <UFormField label="Summary">
      <UTextarea
        v-model="summaryDraft"
        :rows="6"
        autoresize
        class="w-full"
        data-testid="tailored-cv-summary-input"
      />
    </UFormField>
  </AppFormModal>
  <LazyListingsTailoredCvSkillsModal
    v-if="skillsOpened"
    v-model:open="skillsOpen"
    :skills="cv.skills"
    :section-order="cv.sectionOrder"
    @apply="(skills) => ((cv.skills = skills), clearFlags('skills'))"
  />
  <!-- Only the Developer layout uses groups, so other CVs don't load the modal. -->
  <LazyListingsTailoredCvSkillGroupsModal
    v-if="cv.sectionOrder === 'DEVELOPER'"
    v-model:open="groupsOpen"
    :input="groupsInput"
    @apply="applyGroups"
  />
</template>
