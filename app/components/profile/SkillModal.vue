<script setup lang="ts">
import { SKILL_CATEGORY_OPTIONS, SKILL_LEVELS, type SkillCategory } from '~/constants/listing'
import type { ProfileSkill } from '~/composables/useProfile'

// Without `skill` it adds one; with it, it changes that skill's level and category (the name is fixed).
const { skill } = defineProps<{ skill: ProfileSkill | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const SET_SKILL = graphql(`
  mutation SetProfileSkill($input: SetProfileSkillInput!) {
    setProfileSkill(input: $input) {
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

const SET_CATEGORY = graphql(`
  mutation SetSkillCategory($input: SetSkillCategoryInput!) {
    setSkillCategory(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

// A select can't hold null, so "uncategorized" is a sentinel that is sent as null.
const NO_CATEGORY = 'NONE'
const CATEGORY_ITEMS = [{ label: 'Uncategorized', value: NO_CATEGORY }, ...SKILL_CATEGORY_OPTIONS]

const name = ref<string>()
const level = ref(3)
const category = ref<SkillCategory | typeof NO_CATEGORY>(NO_CATEGORY)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = skill?.skill.name
  level.value = skill?.level ?? 3
  category.value = skill?.skill.category ?? NO_CATEGORY
})

const validate = () => formErrors({ name: requiredError(name.value, 'a skill') })

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const ok = await run(async () => {
    const { setProfileSkill } = await gql(SET_SKILL, {
      input: { name: name.value!.trim(), level: level.value }
    })
    const skillId = setProfileSkill.profileSkill?.skill.id
    const wanted = category.value === NO_CATEGORY ? null : category.value
    if (setProfileSkill.errors?.length || skillId == null) return setProfileSkill.errors
    if (wanted === (skill?.skill.category ?? null)) return null
    return (await gql(SET_CATEGORY, { input: { skillId, category: wanted } })).setSkillCategory
      .errors
  })
  if (!ok) return
  // A new skill is a new name, so the cached suggestions are stale.
  clearNuxtState('name-lookups')
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="skill ? 'Edit skill' : 'Add skill'"
    :state="{ name, level, category }"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Skill" name="name" required>
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
      <UFormField label="Category" description="Groups this skill in the Developer CV layout.">
        <USelect
          v-model="category"
          :items="CATEGORY_ITEMS"
          class="w-full"
          data-testid="skill-category"
        />
      </UFormField>
    </div>
  </AppFormModal>
</template>
