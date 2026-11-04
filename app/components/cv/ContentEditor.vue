<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { VueDraggable } from 'vue-draggable-plus'
import type { ProfileData } from '~/composables/useProfile'
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
  profile,
  disabled = false,
  ai = undefined
} = defineProps<{
  profile: ProfileData | null | undefined
  disabled?: boolean
  ai?: CvEditorAi
}>()
const cv = defineModel<TailoredCv>('cv', { required: true })

const toast = useToast()
const entryStyle = computed(() => cvEntryStyle(cv.value))

// The owner's categories (edited on the skills page); a deleted one shows as uncategorized.
const { items: categoryItems, known: knownCategory } = useSkillCategories()
const moveSkill = (from: number, to: number) => {
  const skills = cv.value.skills
  skills.splice(to, 0, ...skills.splice(from, 1))
}

// Developer layout: a group label replaces the category name and skills sharing it print on one
// line, so the field suggests the labels already in use (case-insensitive, first spelling kept).
const usedGroups = computed(() => {
  const seen = new Map<string, string>()
  for (const { group } of cv.value.skills) {
    const label = group?.trim()
    if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label)
  }
  return [...seen.values()]
})
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
  toast.add({
    title: 'Groups suggested. Review them, then save.',
    icon: 'i-lucide-sparkles',
    actions: [
      {
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: () => before.forEach(([skill, group]) => (skill.group = group))
      }
    ]
  })
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
  toast.add({
    title: name.trim() ? `Removed ${name} from this CV` : 'Removed from this CV',
    icon: 'i-lucide-trash-2',
    actions: [
      {
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          const items = cv.value[list] as unknown[]
          items.splice(Math.min(index, items.length), 0, item)
        }
      }
    ]
  })
}

const PROFILE_LISTS = ['experiences', 'educations', 'certifications', 'projects', 'skills'] as const
type ProfileListItem = TailoredCv[CvProfileList][number]
// Recomputed only when a list's items or the CV language change, not on every keystroke.
const missing = computed(() => {
  const draft = cv.value
  if (!profile) return undefined
  return Object.fromEntries(
    PROFILE_LISTS.map((list) => [list, missingFromProfile(draft, profile, list)])
  ) as Record<CvProfileList, ProfileListItem[]>
})
const addItems = (list: CvProfileList): DropdownMenuItem[] => {
  const items = missing.value?.[list] ?? []
  if (!items.length)
    return [{ label: 'Everything from your profile is already here', disabled: true }]
  return items.map((item) => ({
    label: 'employer' in item ? experienceName(item) : 'school' in item ? item.school : item.name,
    onSelect: () => addFromProfile(cv.value, profile!, list, item)
  }))
}
const emptyMessage = (list: CvProfileList, none: string) => {
  if (cv.value[list].length) return undefined
  return missing.value?.[list].length ? `${none} Use Add to bring it back from your profile.` : none
}
</script>

<template>
  <ListingsTailoredCvSection
    title="Contact and headline"
    testid="tailored-cv-contact"
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

  <ListingsTailoredCvSection
    title="Summary"
    testid="tailored-cv-summary"
    editable
    :analyzable="!!ai"
    v-bind="ai?.section('summary')"
    :empty-message="cv.summary.trim() ? undefined : 'No summary yet.'"
    @edit="editSummary"
    @analyze="ai?.analyze('summary', 'the summary')"
  >
    <p
      v-if="cv.summary.trim()"
      class="whitespace-pre-wrap break-words text-sm"
      data-testid="tailored-cv-summary-text"
    >
      {{ cv.summary }}
    </p>
  </ListingsTailoredCvSection>

  <ListingsTailoredCvSection
    title="Experience"
    testid="tailored-cv-experience"
    :empty-message="emptyMessage('experiences', 'No experience in this CV.')"
    v-bind="ai?.review('experiences')"
    suggestion-label="All experience"
    :add-items="addItems('experiences')"
    add-label="Add experience from your profile"
  >
    <ul class="divide-y divide-default">
      <ListingsTailoredCvEntry
        v-for="(e, i) in cv.experiences"
        :key="e.sourceEntryId ?? `new-${i}`"
        v-bind="ai?.section(`experience:${e.sourceEntryId!}`)"
        :bullets="e.bullets"
        :paragraph="e.paragraph"
        :content-style="entryStyle"
        :title="e.title"
        :subtitle="e.employer"
        :dates="dates(e.startMonth, e.endMonth, 'Present')"
        :location="e.location"
        :technologies="e.technologies"
        :analyzable="!!ai && e.sourceEntryId != null"
        @edit="editEntry('experiences', i)"
        @analyze="ai?.analyze(`experience:${e.sourceEntryId!}`, experienceName(e))"
        @remove="removeItem('experiences', i, e.title)"
      />
    </ul>
  </ListingsTailoredCvSection>

  <ListingsTailoredCvSection
    title="Skills"
    testid="tailored-cv-skills"
    :analyzable="!!ai"
    v-bind="ai?.section('skills')"
    :empty-message="emptyMessage('skills', 'No skills in this CV.')"
    :add-items="addItems('skills')"
    add-label="Add a skill from your profile"
    @analyze="ai?.analyze('skills', 'skills')"
  >
    <div class="space-y-2">
      <VueDraggable
        v-model="cv.skills"
        tag="ul"
        handle=".drag-handle"
        ghost-class="opacity-50"
        :animation="150"
        :disabled="disabled"
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
            <!-- Categories and groups only group skills in the Developer layout. -->
            <template v-if="cv.sectionOrder === 'DEVELOPER'">
              <USelect
                :model-value="knownCategory(skill.categoryId)"
                :items="categoryItems"
                size="sm"
                :aria-label="`${skill.name} category`"
                class="min-w-0 flex-1 sm:w-40 sm:flex-none"
                @update:model-value="(choice) => (skill.categoryId = fromCategoryChoice(choice))"
              />
              <!-- A native datalist keeps the field free text while offering used labels. -->
              <UInput
                :model-value="skill.group ?? ''"
                size="sm"
                placeholder="Group"
                list="tailored-cv-skill-groups"
                autocomplete="off"
                :aria-label="`${skill.name} group`"
                class="min-w-0 flex-1 sm:w-36 sm:flex-none"
                data-testid="tailored-cv-skill-group"
                @update:model-value="(value) => (skill.group = value)"
              />
            </template>
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
      <datalist id="tailored-cv-skill-groups">
        <option v-for="label in usedGroups" :key="label" :value="label" />
      </datalist>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-muted">
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
          :disabled="disabled || !cv.skills.length"
          data-testid="tailored-cv-suggest-groups"
          @click="groupsOpen = true"
          >Suggest groups</UButton
        >
      </div>
    </div>
  </ListingsTailoredCvSection>

  <ListingsTailoredCvSection
    title="Education"
    testid="tailored-cv-education"
    :empty-message="emptyMessage('educations', 'No education in this CV.')"
    v-bind="ai?.review('educations')"
    suggestion-label="All education"
    :add-items="addItems('educations')"
    add-label="Add education from your profile"
  >
    <ul class="divide-y divide-default">
      <ListingsTailoredCvEntry
        v-for="(e, i) in cv.educations"
        :key="e.sourceEntryId ?? `new-${i}`"
        v-bind="ai?.section(`education:${e.sourceEntryId!}`)"
        :bullets="e.bullets"
        :paragraph="e.paragraph"
        :content-style="entryStyle"
        :title="e.school"
        :subtitle="[e.degree, e.field].filter(Boolean).join(', ')"
        :dates="dates(e.startMonth, e.endMonth)"
        :location="e.location"
        :analyzable="!!ai && e.sourceEntryId != null"
        @edit="editEntry('educations', i)"
        @analyze="ai?.analyze(`education:${e.sourceEntryId!}`, e.school)"
        @remove="removeItem('educations', i, e.school)"
      />
    </ul>
  </ListingsTailoredCvSection>

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

  <ListingsTailoredCvSection
    title="Projects"
    testid="tailored-cv-projects"
    :empty-message="emptyMessage('projects', 'No projects in this CV.')"
    v-bind="ai?.review('projects')"
    suggestion-label="All projects"
    :add-items="addItems('projects')"
    add-label="Add a project from your profile"
  >
    <ul class="divide-y divide-default">
      <ListingsTailoredCvEntry
        v-for="(p, i) in cv.projects"
        :key="p.sourceEntryId ?? `new-${i}`"
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
        :analyzable="!!ai && p.sourceEntryId != null"
        @edit="editEntry('projects', i)"
        @analyze="ai?.analyze(`project:${p.sourceEntryId!}`, p.name)"
        @remove="removeItem('projects', i, p.name)"
      />
    </ul>
  </ListingsTailoredCvSection>

  <ListingsTailoredCvSection
    title="Languages"
    testid="tailored-cv-languages"
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
    @apply="(contact) => Object.assign(cv, contact)"
  />
  <LazyListingsTailoredCvLanguagesModal
    v-if="languagesOpened"
    v-model:open="languagesOpen"
    :languages="cv.languages"
    @apply="(languages) => (cv.languages = languages)"
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
  <!-- Only the Developer layout uses groups, so other CVs don't load the modal. -->
  <LazyListingsTailoredCvSkillGroupsModal
    v-if="cv.sectionOrder === 'DEVELOPER'"
    v-model:open="groupsOpen"
    :input="groupsInput"
    @apply="applyGroups"
  />
</template>
