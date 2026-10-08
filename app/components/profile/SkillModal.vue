<script setup lang="ts">
import { SKILL_LEVELS } from '~/constants/listing'
import type { ProfileSkill } from '~/composables/useProfile'

// Without `skill` it adds one; with it, it changes that skill's level (the name is fixed).
const { skill } = defineProps<{ skill: ProfileSkill | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const SET_SKILL = graphql(`
  mutation SetProfileSkill($input: SetProfileSkillInput!) {
    setProfileSkill(input: $input) {
      profileSkill {
        level
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

const name = ref<string>()
const level = ref(3)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = skill?.skill.name
  level.value = skill?.level ?? 3
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const ok = await run(async () => {
    const { setProfileSkill } = await gql(SET_SKILL, {
      input: { name: name.value!.trim(), level: level.value }
    })
    return setProfileSkill.errors
  })
  if (!ok) return
  // A new skill is a new name, so the cached suggestions are stale.
  clearNuxtState('name-lookups')
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="skill ? 'Edit skill' : 'Add skill'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!name?.trim()"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Skill" required>
        <UInput v-if="skill" :model-value="name" disabled class="w-full" />
        <ListingsNameCombobox
          v-else
          v-model="name"
          lookup="skills"
          placeholder="Search or add a skill"
        />
      </UFormField>
      <UFormField label="Level">
        <USelect v-model="level" :items="SKILL_LEVELS" class="w-full" data-testid="skill-level" />
      </UFormField>
    </div>
  </AppConfirmModal>
</template>
