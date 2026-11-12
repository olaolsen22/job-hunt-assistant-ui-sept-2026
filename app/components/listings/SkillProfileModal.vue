<script setup lang="ts">
import { SKILL_LEVELS } from '~/constants/listing'
import type { ListingDetail } from '~/composables/useListing'

// Adds a listing's skill to the profile, tagged on experiences/projects; for a skill the owner
// already has it changes the level and adds tags. The API never removes tags.
const { skill, listingLevel } = defineProps<{
  skill: ListingDetail['skills'][number]['skill']
  listingLevel: number
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_SKILL = graphql(`
  mutation AddSkillToProfile($input: AddSkillToProfileInput!) {
    addSkillToProfile(input: $input) {
      profileSkill {
        level
        skill {
          id
        }
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const {
  profile,
  loading: profileLoading,
  error: profileError,
  refresh: refreshProfile
} = useProfile()

const isOwned = computed(() => skill.profileLevel != null)
const isTagged = (entry: { skills: { id: number }[] }) =>
  entry.skills.some((s) => s.id === skill.id)

const experienceItems = computed(() =>
  (profile.value?.experiences ?? []).map((e) => ({
    label: e.employer,
    description: isTagged(e) ? `${e.title} · Already tagged` : e.title,
    value: String(e.id),
    disabled: isTagged(e)
  }))
)
const projectItems = computed(() =>
  (profile.value?.projects ?? []).map((p) => ({
    label: p.name,
    description: isTagged(p) ? 'Already tagged' : undefined,
    value: String(p.id),
    disabled: isTagged(p)
  }))
)
const hasEntries = computed(() => experienceItems.value.length + projectItems.value.length > 0)

const level = ref(3)
// UCheckboxGroup values are strings, so ids are kept as strings until sent.
const experienceIds = ref<string[]>([])
const projectIds = ref<string[]>([])

// Already-tagged entries start ticked (and locked): they stay sent, so a level-only change still
// passes the API's "at least one entry" rule.
const tickTagged = () => {
  experienceIds.value = (profile.value?.experiences ?? []).filter(isTagged).map((e) => String(e.id))
  projectIds.value = (profile.value?.projects ?? []).filter(isTagged).map((p) => String(p.id))
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    level.value = skill.profileLevel ?? listingLevel
    tickTagged()
  },
  { immediate: true }
)
// The profile may arrive after the modal opened.
watch(profile, tickTagged)

const validate = () =>
  formErrors({
    entries:
      !experienceIds.value.length &&
      !projectIds.value.length &&
      'Tick at least one experience or project.'
  })

const { run, loading } = useMutation(refreshProfile)
const { success: toastSuccess } = useAppToast()

const submit = async () => {
  const ok = await run(
    async () =>
      (
        await gql(ADD_SKILL, {
          input: {
            skillId: skill.id,
            level: level.value,
            experienceIds: experienceIds.value.map(Number),
            projectIds: projectIds.value.map(Number)
          }
        })
      ).addSkillToProfile.errors
  )
  if (!ok) return
  open.value = false
  toastSuccess(
    isOwned.value ? `Updated ${skill.name} on your profile` : `Added ${skill.name} to your profile`
  )
  await refreshProfile()
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="isOwned ? `Edit ${skill.name} on profile` : `Add ${skill.name} to profile`"
    :save-label="isOwned ? 'Save' : 'Add to profile'"
    :state="{ level, experienceIds, projectIds }"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Level">
        <USelect v-model="level" :items="SKILL_LEVELS" class="w-full" data-testid="skill-level" />
      </UFormField>

      <div v-if="profileLoading" class="space-y-2" data-testid="skill-entries-loading">
        <USkeleton v-for="n in 4" :key="n" class="h-6 w-full" />
      </div>
      <UAlert
        v-else-if="profileError"
        color="error"
        title="Couldn't load your experiences and projects"
        :actions="[
          { label: 'Retry', color: 'neutral', variant: 'outline', onClick: () => refreshProfile() }
        ]"
      />
      <UAlert
        v-else-if="!hasEntries"
        color="neutral"
        variant="subtle"
        title="Add an experience or project first"
        description="A profile skill is tagged on where you used it."
        :actions="[
          { label: 'Go to profile', to: '/profile', color: 'neutral', variant: 'outline' }
        ]"
      />
      <UFormField
        v-else
        name="entries"
        label="Where did you use it?"
        description="Tick at least one."
      >
        <div class="space-y-4 pt-1">
          <UCheckboxGroup
            v-if="experienceItems.length"
            v-model="experienceIds"
            legend="Experiences"
            :items="experienceItems"
            data-testid="skill-experiences"
          />
          <p v-else class="text-sm text-muted">No experiences on your profile yet</p>
          <UCheckboxGroup
            v-if="projectItems.length"
            v-model="projectIds"
            legend="Projects"
            :items="projectItems"
            data-testid="skill-projects"
          />
          <p v-else class="text-sm text-muted">No projects on your profile yet</p>
        </div>
      </UFormField>
    </div>
  </AppFormModal>
</template>
