<script setup lang="ts">
import type { ListingSkill } from '~/composables/useListingForm'

const skills = defineModel<ListingSkill[]>({ required: true })

const SKILL_LEVELS = [1, 2, 3, 4, 5]

const isNewName = useIsNewName()

const newSkill = ref<string>()

const addSkill = (name?: string) => {
  const exists = skills.value.some((s) => s.name.toLowerCase() === name?.toLowerCase())
  if (name && !exists) skills.value.push({ name, level: 3, isRequired: true })
  // Clear on the next tick, after the combobox has applied the selection.
  nextTick(() => (newSkill.value = undefined))
}
</script>

<template>
  <div class="space-y-2">
    <ListingsNameCombobox
      v-model="newSkill"
      lookup="skills"
      placeholder="Search or add a skill"
      @update:model-value="addSkill"
    />
    <p v-if="!skills.length" class="text-sm text-muted">No skills yet.</p>
    <div
      v-for="(skill, i) in skills"
      :key="skill.name"
      class="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3"
      data-testid="skill-row"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span class="truncate">{{ skill.name }}</span>
        <!-- A badge, not NameCombobox's hint line, to keep skill rows one line high -->
        <UBadge
          v-if="isNewName('skills', skill.name)"
          label="New"
          color="neutral"
          variant="subtle"
          size="sm"
          data-testid="skill-new-badge"
        />
      </div>
      <USelect v-model="skill.level" :items="SKILL_LEVELS" class="w-20" />
      <UInputNumber v-model="skill.minYears" :min="1" placeholder="Min yrs" class="w-28" />
      <USwitch v-model="skill.isRequired" label="Required" />
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" @click="skills.splice(i, 1)" />
    </div>
  </div>
</template>
