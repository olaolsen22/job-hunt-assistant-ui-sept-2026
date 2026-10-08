<script setup lang="ts">
import type { ProfileSkill } from '~/composables/useProfile'

defineProps<{ skills: readonly ProfileSkill[] }>()
const emit = defineEmits<{ changed: [] }>()

const REMOVE_SKILL = graphql(`
  mutation RemoveProfileSkill($input: RemoveProfileSkillInput!) {
    removeProfileSkill(input: $input) {
      skillId
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
const editing = ref<ProfileSkill | null>(null)
const removing = ref<ProfileSkill | null>(null)
const removeOpen = computed({
  get: () => !!removing.value,
  set: (value) => {
    if (!value) removing.value = null
  }
})

const openForm = (skill: ProfileSkill | null) => {
  editing.value = skill
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const skillId = removing.value!.skill.id
  const ok = await run(async () => {
    const { removeProfileSkill } = await gql(REMOVE_SKILL, { input: { skillId } })
    return removeProfileSkill.errors
  })
  removing.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    title="Skills"
    icon="i-lucide-wrench"
    testid="profile-skills"
    :empty="!skills.length"
    empty-message="No skills yet."
    add-label="Add skill"
    @add="openForm(null)"
  >
    <ul class="space-y-2">
      <li
        v-for="s in skills"
        :key="s.skill.id"
        class="flex items-center gap-2"
        data-testid="profile-skill"
      >
        <span class="min-w-0 flex-1 truncate">{{ s.skill.name }}</span>
        <UBadge color="neutral" variant="subtle" size="sm">Level {{ s.level }}/5</UBadge>
        <span class="w-14 shrink-0 text-right text-sm text-muted">{{
          formatYears(s.experienceMonths)
        }}</span>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Edit ${s.skill.name}`"
          data-testid="profile-skill-edit"
          @click="openForm(s)"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Remove ${s.skill.name}`"
          @click="removing = s"
        />
      </li>
    </ul>
    <!-- Skills tagged on an entry are added here at level 1 as a placeholder. -->
    <p v-if="skills.some((s) => s.level === 1)" class="mt-3 text-xs text-muted">
      Skills added from your entries start at level 1. Raise the level where it's higher.
    </p>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileSkillModal v-model:open="formOpen" :skill="editing" @changed="emit('changed')" />
  <AppConfirmModal
    v-model:open="removeOpen"
    title="Remove this skill?"
    :description="
      removing ? `${removing.skill.name} stays on the entries it is tagged on.` : undefined
    "
    confirm-label="Remove"
    :loading="loading"
    @confirm="remove"
  />
</template>
