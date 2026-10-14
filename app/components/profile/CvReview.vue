<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'
import {
  CV_BASIC_FIELDS,
  CV_HISTORY,
  CV_ISSUES,
  cvPathWithin,
  cvSavedSkill,
  formatCvLocation,
  type CvDraft,
  type CvIssue
} from '~/utils/profileCvImport'
import { PROFICIENCY_OPTIONS, SKILL_LEVELS, LINK_KIND_OPTIONS } from '~/constants/listing'

const props = defineProps<{ profile: ProfileData; issues: CvIssue[]; notes: CvIssue[] }>()
const draft = defineModel<CvDraft>({ required: true })
provide(
  CV_ISSUES,
  computed(() => props.issues)
)
const labels = {
  fullName: 'Full name',
  headline: 'Headline',
  summary: 'Summary',
  email: 'Email',
  phone: 'Phone'
}
const sections = {
  experiences: { title: 'Experience', icon: 'i-lucide-briefcase' },
  educations: { title: 'Education', icon: 'i-lucide-graduation-cap' },
  certifications: { title: 'Certifications', icon: 'i-lucide-award' },
  projects: { title: 'Projects', icon: 'i-lucide-folder-git-2' }
}
// Saved items come first in the editable lists, so the CV's own items are the remainder.
const importedLinks = computed(() => draft.value.links.slice(props.profile.links.length))
const importedHobbies = computed(() => draft.value.hobbies.slice(props.profile.hobbies.length))
const linkKind = (kind: string) => LINK_KIND_OPTIONS.find((option) => option.value === kind)!
const savedSkillLevel = (name: string) => {
  const level = cvSavedSkill(props.profile, name)?.level
  return level ? `Saved ${level}/5` : 'New'
}
const savedLanguage = (name: string) =>
  props.profile.languages.some((saved) => saved.name.toLowerCase() === name.trim().toLowerCase())
    ? 'Saved'
    : 'New'
const includeAllSkills = (include: boolean) =>
  draft.value.skills.forEach((skill) => (skill.include = include))
const needsAttention = (path: string) =>
  props.issues.some((issue) => cvPathWithin(issue.path, path))

const root = useTemplateRef<HTMLElement>('root')
// Opens the collapsed entry holding the first (in page order) of `paths` and focuses its control.
const focusIssue = async (paths: string[]) => {
  await nextTick()
  const fields = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-cv-field]') ?? [])
  const field = fields.find((element) =>
    paths.some(
      (path) =>
        cvPathWithin(path, element.dataset.cvField!) &&
        // The most specific field for this path, not an entry or section that also contains it.
        !fields.some(
          (other) =>
            other !== element &&
            other.dataset.cvField!.length > element.dataset.cvField!.length &&
            cvPathWithin(path, other.dataset.cvField!)
        )
    )
  )
  if (!field) return
  for (let ancestor = field.parentElement; ancestor && ancestor !== root.value;) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true
    ancestor = ancestor.parentElement
  }
  await nextTick()
  field.scrollIntoView({ block: 'center', behavior: 'smooth' })
  // preventScroll: an instant jump to the control would cut the smooth scroll short.
  ;(
    field.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    ) ?? field
  ).focus({ preventScroll: true })
}
defineExpose({ focusIssue })
</script>

<template>
  <div ref="root" class="space-y-6" data-testid="cv-review">
    <UAlert
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      description="Nothing saves until Save import; skipped content stays as it is and Norwegian translations are kept, though edited sources can make them stale."
    />
    <details v-if="notes.length" class="rounded-lg border border-default p-4">
      <summary class="cursor-pointer text-sm text-muted">Import notes ({{ notes.length }})</summary>
      <ul class="mt-2 space-y-1 text-sm">
        <li v-for="(note, i) in notes" :key="i">{{ note.message }}</li>
      </ul>
    </details>

    <ProfileCvSection title="Basics" icon="i-lucide-user" path="basics">
      <p class="text-sm text-muted">
        Included fields replace your saved values; an empty value clears one.
      </p>
      <!-- Unticked fields stay as a read-only comparison, so the saved value is always in view. -->
      <div v-for="key in CV_BASIC_FIELDS" :key="key" class="space-y-2">
        <UCheckbox v-model="draft.basics[key].include" :label="labels[key]" />
        <AppCompareBlock
          :current="profile[key]"
          :suggested="draft.basics[key].value"
          suggested-label="From your CV"
        >
          <template v-if="draft.basics[key].include" #suggested>
            <ProfileCvField :path="`basics.${key}`">
              <UTextarea
                v-if="key === 'summary'"
                v-model="draft.basics[key].value"
                :rows="4"
                autoresize
                :aria-label="labels[key]"
                class="w-full"
                :data-testid="`cv-${key}`"
              />
              <UInput
                v-else
                v-model="draft.basics[key].value"
                :aria-label="labels[key]"
                class="w-full"
                :data-testid="`cv-${key}`"
              />
            </ProfileCvField>
          </template>
        </AppCompareBlock>
      </div>
      <div class="space-y-2">
        <UCheckbox v-model="draft.location.include" label="Location" />
        <AppCompareBlock
          :current="profile.location && formatLocation(profile.location)"
          :suggested="formatCvLocation(draft.location.value)"
          suggested-label="From your CV"
        >
          <template v-if="draft.location.include" #suggested>
            <ProfileCvField path="basics.location">
              <ProfileLocationField
                v-model:country-code="draft.location.value.countryCode"
                v-model:city="draft.location.value.city"
              />
            </ProfileCvField>
          </template>
        </AppCompareBlock>
      </div>
    </ProfileCvSection>

    <ProfileCvSection title="Links" icon="i-lucide-link" path="links">
      <UCheckbox v-model="draft.replaceLinks" label="Replace saved links with this reviewed list" />
      <template v-if="!draft.replaceLinks">
        <div v-if="importedLinks.length" class="text-sm" data-testid="cv-imported-links">
          <p class="text-muted">From your CV:</p>
          <ul>
            <li v-for="(link, i) in importedLinks" :key="i" class="break-words">
              {{ link.label || linkKind(link.kind).label }} · {{ link.url }}
            </li>
          </ul>
        </div>
      </template>
      <template v-else>
        <p class="text-sm text-muted">
          Your saved links are included. Removing one removes it on save; an empty list clears all
          links.
        </p>
        <ProfileCvField path="links" exact />
        <ul class="divide-y divide-default">
          <li v-for="(link, i) in draft.links" :key="i" class="space-y-1 py-2">
            <div class="flex flex-wrap items-start gap-2">
              <ProfileCvField :path="`links[${i}].kind`" class="w-full sm:w-36">
                <USelect
                  v-model="link.kind"
                  :items="[...LINK_KIND_OPTIONS]"
                  aria-label="Link kind"
                  class="w-full"
                />
              </ProfileCvField>
              <ProfileCvField :path="`links[${i}].label`" class="min-w-32 flex-1">
                <UInput
                  v-model="link.label"
                  placeholder="Label (optional)"
                  aria-label="Link label"
                  class="w-full"
                />
              </ProfileCvField>
              <ProfileCvField :path="`links[${i}].url`" class="min-w-48 flex-1">
                <UInput v-model="link.url" placeholder="https://" aria-label="URL" class="w-full" />
              </ProfileCvField>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                :aria-label="`Remove ${link.label || link.url || 'link'}`"
                @click="draft.links.splice(i, 1)"
              />
            </div>
            <ProfileCvField :path="`links[${i}]`" exact />
          </li>
        </ul>
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-plus"
          :disabled="draft.links.length >= 10"
          @click="draft.links.push({ kind: 'OTHER', label: '', url: '' })"
          >Add link</UButton
        >
      </template>
    </ProfileCvSection>

    <ProfileCvSection title="Hobbies" icon="i-lucide-palette" path="hobbies">
      <UCheckbox
        v-model="draft.replaceHobbies"
        label="Replace saved hobbies with this reviewed list"
      />
      <p v-if="!draft.replaceHobbies && importedHobbies.length" class="break-words text-sm">
        <span class="text-muted">From your CV:</span> {{ importedHobbies.join(', ') }}
      </p>
      <template v-if="draft.replaceHobbies">
        <p class="text-sm text-muted">
          Your saved hobbies are included. An empty list clears all hobbies.
        </p>
        <ProfileCvField path="hobbies">
          <ProfileNamesField v-model="draft.hobbies" />
        </ProfileCvField>
      </template>
    </ProfileCvSection>

    <ProfileCvSection
      v-for="kind in CV_HISTORY"
      :key="kind"
      :title="`${sections[kind].title} (${draft.entries[kind].length})`"
      :icon="sections[kind].icon"
      :path="kind"
    >
      <p v-if="!draft.entries[kind].length" class="text-sm text-muted">
        No imported entries. Existing content stays unchanged.
      </p>
      <ProfileCvField :path="kind" exact />
      <ProfileCvEntryReview
        v-for="(entry, i) in draft.entries[kind]"
        :key="i"
        :model-value="entry"
        :kind="kind"
        :profile="profile"
        :path="`${kind}[${i}]`"
        :needs-attention="needsAttention(`${kind}[${i}]`)"
        @update:model-value="draft.entries[kind][i] = $event"
      />
    </ProfileCvSection>

    <ProfileCvSection title="Skills" icon="i-lucide-wrench" path="skills">
      <template v-if="draft.skills.length" #actions>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          data-testid="cv-skills-include-all"
          @click="includeAllSkills(true)"
          >Include all</UButton
        >
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          data-testid="cv-skills-skip-all"
          @click="includeAllSkills(false)"
          >Skip all</UButton
        >
      </template>
      <p class="text-sm text-muted">
        {{
          draft.skills.length
            ? 'Included skills are added or get the reviewed level. Skipped skills stay unchanged.'
            : 'No imported skills.'
        }}
      </p>
      <ProfileCvField path="skills" exact />
      <ul class="divide-y divide-default">
        <li
          v-for="(skill, i) in draft.skills"
          :key="i"
          class="space-y-1 py-2"
          :data-testid="`cv-skill-${i}`"
        >
          <div class="flex flex-wrap items-start gap-2">
            <UCheckbox
              v-model="skill.include"
              :aria-label="`Include ${skill.name || `skill ${i + 1}`}`"
              class="py-1.5"
            />
            <ProfileCvField :path="`skills[${i}].name`" class="min-w-40 flex-1">
              <UInput
                v-model="skill.name"
                :disabled="!skill.include"
                aria-label="Skill name"
                class="w-full"
                @update:model-value="skill.defaultNote = undefined"
              />
            </ProfileCvField>
            <ProfileCvField :path="`skills[${i}].level`" class="w-32">
              <USelect
                :model-value="skill.level ?? undefined"
                :items="SKILL_LEVELS"
                :disabled="!skill.include"
                placeholder="Level"
                aria-label="Skill level"
                class="w-full"
                @update:model-value="
                  (level) => {
                    skill.level = level ?? null
                    skill.defaultNote = undefined
                  }
                "
              />
            </ProfileCvField>
            <UBadge color="neutral" variant="subtle" size="sm" class="mt-1.5">{{
              savedSkillLevel(skill.name)
            }}</UBadge>
          </div>
          <ProfileCvField :path="`skills[${i}]`" exact />
          <p v-if="skill.include && skill.defaultNote" class="text-sm text-muted">
            {{ skill.defaultNote }}
          </p>
        </li>
      </ul>
    </ProfileCvSection>

    <ProfileCvSection title="Languages" icon="i-lucide-languages" path="languages">
      <p class="text-sm text-muted">
        {{
          draft.languages.length
            ? "Included languages add or update their proficiency. The profile's content language stays English."
            : 'No imported languages.'
        }}
      </p>
      <ProfileCvField path="languages" exact />
      <ul class="divide-y divide-default">
        <li
          v-for="(language, i) in draft.languages"
          :key="i"
          class="space-y-1 py-2"
          :data-testid="`cv-language-${i}`"
        >
          <div class="flex flex-wrap items-start gap-2">
            <UCheckbox
              v-model="language.include"
              :aria-label="`Include ${language.name || 'language'}`"
              class="py-1.5"
            />
            <ProfileCvField :path="`languages[${i}].name`" class="min-w-40 flex-1">
              <UInput
                v-model="language.name"
                :disabled="!language.include"
                aria-label="Language"
                class="w-full"
              />
            </ProfileCvField>
            <ProfileCvField :path="`languages[${i}].spoken`" class="w-36">
              <USelect
                :model-value="language.spoken ?? undefined"
                :items="[...PROFICIENCY_OPTIONS]"
                :disabled="!language.include"
                placeholder="Spoken"
                aria-label="Spoken proficiency"
                class="w-full"
                @update:model-value="language.spoken = $event ?? null"
              />
            </ProfileCvField>
            <ProfileCvField :path="`languages[${i}].written`" class="w-36">
              <USelect
                :model-value="language.written ?? undefined"
                :items="[...PROFICIENCY_OPTIONS]"
                :disabled="!language.include"
                placeholder="Written"
                aria-label="Written proficiency"
                class="w-full"
                @update:model-value="language.written = $event ?? null"
              />
            </ProfileCvField>
            <UBadge color="neutral" variant="subtle" size="sm" class="mt-1.5">{{
              savedLanguage(language.name)
            }}</UBadge>
          </div>
          <ProfileCvField :path="`languages[${i}]`" exact />
        </li>
      </ul>
    </ProfileCvSection>
  </div>
</template>
