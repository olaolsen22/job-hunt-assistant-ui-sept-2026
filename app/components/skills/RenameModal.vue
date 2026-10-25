<script setup lang="ts">
import type { CatalogSkill } from '~/composables/useSkillsCatalog'

// A rename is a one-skill cleanup operation; listings, profile and tags keep pointing at the skill.
const { skill, skills } = defineProps<{
  skill: CatalogSkill | null
  skills: readonly CatalogSkill[]
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ renamed: [] }>()

const name = ref('')
watch(
  open,
  (isOpen) => {
    if (isOpen) name.value = skill?.name ?? ''
  },
  // Mounted on first open (already open), so the first open needs the reset too.
  { immediate: true }
)

// The API merges into a skill that already has the new name, so the button says that instead.
const clash = computed(() => {
  const wanted = name.value.trim().toLowerCase()
  return skills.find((s) => s.id !== skill?.id && s.name.toLowerCase() === wanted)
})

const validate = () => formErrors({ name: requiredError(name.value, 'a name') })

const { run, loading } = useMutation()
const submit = async () => {
  const wanted = name.value.trim()
  if (wanted === skill!.name) {
    open.value = false
    return
  }
  const ok = await run(
    async () =>
      (
        await gql(CLEAN_UP_SKILLS, {
          operations: [{ skillIds: [skill!.id], names: [wanted] }]
        })
      ).cleanUpSkills.errors
  )
  if (!ok) return
  open.value = false
  emit('renamed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Rename skill"
    :state="{ name }"
    :validate="validate"
    :loading="loading"
    :save-label="clash ? `Merge into ${clash.name}` : 'Rename'"
    @submit="submit"
  >
    <UFormField
      label="Name"
      name="name"
      required
      :help="
        clash
          ? `${clash.name} already exists. Saving merges ${skill?.name} into it; its own levels are kept.`
          : 'Listings, your profile and entry tags show the new name.'
      "
    >
      <UInput v-model="name" maxlength="200" class="w-full" data-testid="rename-name" />
    </UFormField>
  </AppFormModal>
</template>
