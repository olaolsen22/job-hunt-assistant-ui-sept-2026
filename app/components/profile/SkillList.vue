<script setup lang="ts">
import type { ProfileSkill } from '~/composables/useProfile'

// Read-only list; Add opens the single-skill form (it has the name search), Edit the bulk one.
defineProps<{ skills: readonly ProfileSkill[] }>()
const emit = defineEmits<{ changed: []; clear: [] }>()

const addOpen = ref(false)
const editOpen = ref(false)
</script>

<template>
  <ProfileSection
    clearable
    title="Skills"
    icon="i-lucide-wrench"
    testid="profile-skills"
    :empty="!skills.length"
    empty-message="No skills yet."
    add-label="Add skill"
    @clear="emit('clear')"
    @add="addOpen = true"
  >
    <template v-if="skills.length" #actions>
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="subtle"
          size="sm"
          aria-label="Edit skills"
          data-testid="profile-skills-edit"
          @click="editOpen = true"
          >Edit</UButton
        >
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          aria-label="Add skill"
          data-testid="profile-skills-add"
          @click="addOpen = true"
          >Add</UButton
        >
      </div>
    </template>
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
      </li>
    </ul>
    <!-- Skills tagged on an entry are added here at level 1 as a placeholder. -->
    <p v-if="skills.some((s) => s.level === 1)" class="mt-3 text-xs text-muted">
      Skills added from your entries start at level 1. Raise the level where it's higher.
    </p>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileSkillModal v-model:open="addOpen" :skill="null" @changed="emit('changed')" />
  <ProfileSkillsModal v-model:open="editOpen" :skills="skills" @changed="emit('changed')" />
</template>
