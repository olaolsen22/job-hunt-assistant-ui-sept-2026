<script setup lang="ts">
import type { ProfileExperience } from '~/composables/useProfile'

defineProps<{ experiences: readonly ProfileExperience[] }>()
const emit = defineEmits<{ changed: [] }>()

const DELETE_EXPERIENCE = graphql(`
  mutation DeleteProfileExperience($input: DeleteProfileExperienceInput!) {
    deleteProfileExperience(input: $input) {
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

const formOpen = ref(false)
const editing = ref<ProfileExperience | null>(null)
const deleting = ref<ProfileExperience | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

const openForm = (experience: ProfileExperience | null) => {
  editing.value = experience
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const id = deleting.value!.id
  const ok = await run(async () => {
    const { deleteProfileExperience } = await gql(DELETE_EXPERIENCE, { input: { id } })
    return deleteProfileExperience.errors
  })
  deleting.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    title="Experience"
    icon="i-lucide-briefcase"
    testid="profile-experience"
    :empty="!experiences.length"
    empty-message="No experience yet."
    add-label="Add experience"
    @add="openForm(null)"
  >
    <ul class="divide-y divide-default">
      <ProfileEntry
        v-for="e in experiences"
        :key="e.id"
        kind="EXPERIENCE"
        :entry-id="e.id"
        :title="`${e.title} · ${e.employer}`"
        :dates="
          [
            formatMonthRange(e.startMonth, e.endMonth, 'Present'),
            e.location && formatLocation(e.location)
          ]
            .filter(Boolean)
            .join(' · ')
        "
        :bullets="e.bullets"
        @edit="openForm(e)"
        @delete="deleting = e"
        @changed="emit('changed')"
      >
        <div v-if="e.skills.length" class="mt-1 flex flex-wrap gap-1">
          <UBadge v-for="s in e.skills" :key="s.id" color="neutral" variant="subtle" size="sm">{{
            s.name
          }}</UBadge>
        </div>
      </ProfileEntry>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileExperienceModal
    v-model:open="formOpen"
    :experience="editing"
    @changed="emit('changed')"
  />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete this experience?"
    :description="
      deleting ? `${deleting.title} at ${deleting.employer}, with its bullets.` : undefined
    "
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>
