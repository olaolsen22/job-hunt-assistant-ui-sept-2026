<script setup lang="ts">
import type { ListingSkill } from '~/composables/useListingForm'

const skills = defineModel<ListingSkill[]>({ required: true })

// Labelled, so the closed select reads on its own; the API doesn't define what each level means.
const SKILL_LEVELS = [1, 2, 3, 4, 5].map((n) => ({ label: `Level ${n}`, value: n }))

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
  <div class="space-y-3">
    <p v-if="!skills.length" class="text-sm text-muted">No skills yet.</p>
    <!-- Same widths as the row controls below, so the headers line up from sm up. -->
    <div v-else class="hidden gap-3 text-xs text-muted sm:flex" aria-hidden="true">
      <span class="flex-1">Skill</span>
      <span class="w-28">Level</span>
      <span class="w-28">Min. years</span>
      <span class="w-24">Required</span>
      <span class="w-9" />
    </div>
    <!-- Phones: name and remove on the first line, controls on the second. sm and up: one line,
         the controls wrapper uses `contents` so its children join the row's flex. -->
    <div
      v-for="(skill, i) in skills"
      :key="skill.name"
      class="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:gap-3"
      data-testid="skill-row"
    >
      <div class="flex min-w-0 items-center gap-2 sm:flex-1">
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
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :aria-label="`Remove ${skill.name}`"
        class="sm:order-last"
        @click="skills.splice(i, 1)"
      />
      <div class="col-span-2 flex flex-wrap items-center gap-2 sm:contents">
        <USelect
          v-model="skill.level"
          :items="SKILL_LEVELS"
          aria-label="Level"
          class="w-28 sm:shrink-0"
        />
        <UInputNumber
          v-model="skill.minYears"
          :min="1"
          :increment="false"
          :decrement="false"
          placeholder="Min. years"
          aria-label="Minimum years"
          class="w-28 sm:shrink-0"
        />
        <div class="sm:w-24 sm:shrink-0">
          <USwitch v-model="skill.isRequired" label="Required" />
        </div>
      </div>
    </div>

    <ListingsNameCombobox
      v-model="newSkill"
      lookup="skills"
      placeholder="Search or add a skill"
      @update:model-value="addSkill"
    />
  </div>
</template>
