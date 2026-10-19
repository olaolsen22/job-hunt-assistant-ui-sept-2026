<script setup lang="ts">
import { SUCCESS_TOAST_DURATION } from '~/constants/ui'
import type { VariablesOf } from 'gql.tada'
import { PROFILE_FIELDS, type ProfileData } from '~/composables/useProfile'
import { STORY_FIELDS } from '~/constants/profileStory'

const CLEAR_SECTIONS = graphql(
  `
    mutation ClearProfileSections($input: ClearProfileSectionsInput!) {
      clearProfileSections(input: $input) {
        profile {
          ...ProfileFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [PROFILE_FIELDS]
)

export type ProfileSectionName = VariablesOf<typeof CLEAR_SECTIONS>['input']['sections'][number]

const props = defineProps<{ profile: ProfileData }>()
// The section to clear, 'ALL' for every CV section, or null while closed.
const target = defineModel<ProfileSectionName | 'ALL' | null>('target', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

type Section = {
  value: ProfileSectionName
  label: string
  count: (p: ProfileData) => number
  noun: [one: string, many: string]
  // Entries with bullets: the API deletes those and their translations too.
  bullets?: boolean
}

// Order matches the page. The summary also holds the headline, so either one counts as content.
const SECTIONS: Section[] = [
  {
    value: 'SUMMARY',
    label: 'Summary',
    count: (p) => (p.headline || p.summary || p.translations.length ? 1 : 0),
    noun: ['', '']
  },
  {
    value: 'EXPERIENCES',
    label: 'Experience',
    count: (p) => p.experiences.length,
    noun: ['experience', 'experiences'],
    bullets: true
  },
  {
    value: 'PROJECTS',
    label: 'Projects',
    count: (p) => p.projects.length,
    noun: ['project', 'projects'],
    bullets: true
  },
  {
    value: 'EDUCATIONS',
    label: 'Education',
    count: (p) => p.educations.length,
    noun: ['education entry', 'education entries'],
    bullets: true
  },
  {
    value: 'REFERENCES',
    label: 'References',
    count: (p) => p.references.length,
    noun: ['reference', 'references']
  },
  { value: 'SKILLS', label: 'Skills', count: (p) => p.skills.length, noun: ['skill', 'skills'] },
  {
    value: 'LANGUAGES',
    label: 'Languages',
    count: (p) => p.languages.length,
    noun: ['language', 'languages']
  },
  {
    value: 'HOBBIES',
    label: 'Hobbies',
    count: (p) => p.hobbies.length,
    noun: ['hobby', 'hobbies']
  },
  {
    value: 'CERTIFICATIONS',
    label: 'Certifications',
    count: (p) => p.certifications.length,
    noun: ['certification', 'certifications'],
    bullets: true
  },
  {
    value: 'STORY',
    label: 'My story',
    count: (p) => (STORY_FIELDS.some((f) => p.story[f.key]) ? 1 : 0),
    noun: ['', '']
  }
]

// Names what the API deletes, so the owner sees the loss before confirming.
const what = (s: Section) => {
  if (s.value === 'SUMMARY') return 'your headline, summary and their translations'
  if (s.value === 'STORY') return 'your story for cover letters'
  const n = s.count(props.profile)
  const items = `${n} ${n === 1 ? s.noun[0] : s.noun[1]}`
  return s.bullets ? `${items}, with their bullets and translations` : items
}

// The last target stays shown while the modal animates closed. Counts read the live profile, so they
// stay right if it refreshes while the modal is open.
const shown = ref(target.value)
watch(target, (value) => {
  if (value) shown.value = value
})
const section = computed(() => SECTIONS.find((s) => s.value === shown.value))

// "Clear all CV content" leaves the story: it's cover letter material, cleared from its own menu.
const CV_SECTIONS = SECTIONS.filter((s) => s.value !== 'STORY')
const filled = computed(() => CV_SECTIONS.filter((s) => s.count(props.profile) > 0))

const open = computed({
  get: () => !!target.value,
  set: (value) => {
    if (!value) target.value = null
  }
})

const { run, loading } = useMutation(() => emit('changed'))
const toast = useToast()

const clear = async () => {
  const all = !section.value
  let saved: ProfileData | null = null
  const ok = await run(async () => {
    const { clearProfileSections } = await gql(CLEAR_SECTIONS, {
      input: { sections: all ? CV_SECTIONS.map((s) => s.value) : [section.value!.value] }
    })
    saved = clearProfileSections.profile
    return clearProfileSections.errors
  })
  // On failure the modal stays open; the clear is all-or-nothing, so nothing changed.
  if (!ok || !saved) return
  toast.add({
    title: all ? 'CV content cleared' : `${section.value!.label} cleared`,
    color: 'success',
    duration: SUCCESS_TOAST_DURATION
  })
  target.value = null
  emit('saved', saved)
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="section ? `Clear ${section.label}?` : 'Clear all CV content?'"
    :description="
      section
        ? `This permanently deletes ${what(section)}. It can't be undone.`
        : 'This permanently deletes the CV content below. It can\'t be undone.'
    "
    :confirm-label="section ? 'Clear section' : 'Clear all content'"
    color="error"
    :loading="loading"
    @confirm="clear"
  >
    <div v-if="!section" class="space-y-3 text-sm" data-testid="profile-clear-all-details">
      <ul class="list-disc space-y-1 ps-5">
        <li v-for="s in filled" :key="s.value">
          <span class="font-medium">{{ s.label }}</span
          >: {{ what(s) }}
        </li>
      </ul>
      <p class="text-muted">
        Kept: your name, contact details, links, job preferences, CV language, your story and
        tailored CVs.
      </p>
    </div>
  </AppConfirmModal>
</template>
