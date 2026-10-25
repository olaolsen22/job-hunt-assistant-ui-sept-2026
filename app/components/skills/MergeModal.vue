<script setup lang="ts">
import type { CatalogSkill } from '~/composables/useSkillsCatalog'

// Folds several skills into one: profile rows, entry tags and listing skills all move to the kept
// skill, and the others are deleted. `initialIds` are the skills picked on the page.
const { skills, initialIds } = defineProps<{
  skills: readonly CatalogSkill[]
  initialIds: readonly number[]
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ merged: [] }>()

const ids = ref<number[]>([])
const targetId = ref<number>()
const name = ref('')

const byId = computed(() => new Map(skills.map((s) => [s.id, s])))
const picked = computed(() => ids.value.map((id) => byId.value.get(id)!).filter(Boolean))
const items = computed(() => skills.map((s) => ({ label: s.name, value: s.id })))

// The skill whose levels are kept: the one on the profile (highest level), else the most used.
const bestTarget = (list: readonly CatalogSkill[]) =>
  [...list].sort(
    (a, b) => (b.profileLevel ?? 0) - (a.profileLevel ?? 0) || b.listingCount - a.listingCount
  )[0]

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    ids.value = [...initialIds]
    targetId.value = bestTarget(picked.value)?.id
    name.value = byId.value.get(targetId.value!)?.name ?? ''
  },
  // Mounted on first open (already open), so the first open needs the reset too.
  { immediate: true }
)

// Keep the kept skill among the picked ones, and its name in the field until the owner edits it.
watch(ids, () => {
  if (targetId.value != null && ids.value.includes(targetId.value)) return
  targetId.value = bestTarget(picked.value)?.id
  name.value = byId.value.get(targetId.value!)?.name ?? ''
})
watch(targetId, (id, previous) => {
  if (previous != null && name.value === byId.value.get(previous)?.name)
    name.value = byId.value.get(id!)?.name ?? ''
})

const target = computed(() => byId.value.get(targetId.value!))
const others = computed(() => picked.value.filter((s) => s.id !== targetId.value))
// The API merges into a skill that already has the new name, so say so before it happens.
const clash = computed(() => {
  const wanted = name.value.trim().toLowerCase()
  return skills.find((s) => !ids.value.includes(s.id) && s.name.toLowerCase() === wanted)
})

const validate = () =>
  formErrors({
    ids: ids.value.length < 2 && 'Pick at least two skills.',
    name: requiredError(name.value, 'a name')
  })

const { run, loading } = useMutation()
const submit = async () => {
  const ok = await run(
    async () =>
      (
        await gql(CLEAN_UP_SKILLS, {
          // The kept skill goes first; the others are merged into it.
          operations: [
            {
              skillIds: [targetId.value!, ...others.value.map((s) => s.id)],
              names: [name.value.trim()]
            }
          ]
        })
      ).cleanUpSkills.errors
  )
  if (!ok) return
  open.value = false
  emit('merged')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Merge skills"
    description="Listings, your profile and entry tags move to the skill you keep. The others are deleted."
    :state="{ ids, targetId, name }"
    :validate="validate"
    :loading="loading"
    :save-label="ids.length >= 2 ? `Merge ${ids.length} skills` : 'Merge'"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Skills to merge" name="ids" required>
        <USelectMenu
          v-model="ids"
          :items="items"
          value-key="value"
          multiple
          placeholder="Pick skills"
          class="w-full"
          data-testid="merge-skills"
        />
      </UFormField>

      <UFormField v-if="picked.length >= 2" label="Keep this skill" name="targetId">
        <URadioGroup
          v-model="targetId"
          :items="picked.map((s) => ({ label: s.name, value: s.id }))"
          data-testid="merge-target"
        />
      </UFormField>

      <UFormField
        label="Name"
        name="name"
        required
        :help="
          clash ? `A skill called ${clash.name} already exists; it is merged in too.` : undefined
        "
      >
        <UInput v-model="name" maxlength="200" class="w-full" data-testid="merge-name" />
      </UFormField>

      <p v-if="target && others.length" class="text-sm text-muted" data-testid="merge-summary">
        {{ others.map((s) => s.name).join(', ') }}
        {{ others.length === 1 ? 'merges' : 'merge' }} into {{ name.trim() || target.name }}.
        {{
          target.profileLevel != null
            ? `Your level ${target.profileLevel}/5 stays.`
            : 'If it is not on your profile yet, it takes the highest level among the merged skills.'
        }}
        Where a listing names more than one of them, the kept skill's row wins.
      </p>
    </div>
  </AppFormModal>
</template>
