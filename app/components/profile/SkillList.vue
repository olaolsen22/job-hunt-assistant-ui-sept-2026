<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ProfileData, ProfileSkill } from '~/composables/useProfile'

// Read-only list; Add opens the single-skill form (it has the name search), Edit the bulk one.
// `profile` lets the wording review show each bullet's current text.
const props = withDefaults(
  defineProps<{
    skills: readonly ProfileSkill[]
    profile: ProfileData
    count?: number
  }>(),
  { count: undefined }
)
const emit = defineEmits<{ changed: []; clear: [] }>()

const addOpen = ref(false)
const editOpen = ref(false)
const cleanupOpen = ref(false)
const wordingOpen = ref(false)
const cleanupOpened = useOpenedOnce(cleanupOpen)
const wordingOpened = useOpenedOnce(wordingOpen)

// The AI tidy-ups are occasional, so they sit in the ⋮ menu and keep the header to Edit and Add.
const menuItems = computed<DropdownMenuItem[]>(() =>
  props.skills.length
    ? [
        {
          label: 'Clean up skills with AI',
          icon: 'i-lucide-sparkles',
          onSelect: () => (cleanupOpen.value = true)
        },
        {
          label: 'Fix skill wording',
          icon: 'i-lucide-spell-check',
          onSelect: () => (wordingOpen.value = true)
        }
      ]
    : []
)

const { target } = useProfileTranslation()
const translated = (s: ProfileSkill) =>
  s.skill.translations.find((t) => t.language === target.value)?.name
</script>

<template>
  <ProfileSection
    clearable
    title="Skills"
    icon="i-lucide-wrench"
    testid="profile-skills"
    :empty="!skills.length"
    :count="count"
    :menu-items="menuItems"
    empty-message="No skills yet."
    add-label="Add skill"
    @clear="emit('clear')"
    @add="addOpen = true"
  >
    <template v-if="skills.length" #actions>
      <div class="flex flex-wrap justify-end gap-2">
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
        <span class="min-w-0 flex-1 truncate"
          >{{ s.skill.name
          }}<span
            v-if="translated(s)"
            class="text-sm text-muted"
            data-testid="profile-skill-translation"
          >
            · {{ translated(s) }}</span
          ></span
        >
        <UBadge v-if="s.skill.category" color="neutral" variant="outline" size="sm">{{
          s.skill.category.name
        }}</UBadge>
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
    <ULink
      to="/skills"
      class="mt-3 inline-block text-sm text-primary"
      data-testid="profile-skills-manage"
      >Categories, renames and merges are on the Skills page</ULink
    >
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileSkillModal v-model:open="addOpen" :skill="null" @changed="emit('changed')" />
  <LazyProfileSkillCleanupModal
    v-if="cleanupOpened"
    v-model:open="cleanupOpen"
    @changed="emit('changed')"
  />
  <LazyProfileSkillWordingModal
    v-if="wordingOpened"
    v-model:open="wordingOpen"
    :profile="profile"
    @changed="emit('changed')"
  />
  <ProfileSkillsModal v-model:open="editOpen" :skills="skills" @changed="emit('changed')" />
</template>
