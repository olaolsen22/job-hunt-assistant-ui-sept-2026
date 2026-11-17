<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { TailoredCv } from '~/utils/tailoredCv'

// A CV's skills as editable rows: drag (mouse) or arrows to reorder, remove, and with the Developer
// layout a category and group per skill. The CV template editor shows them inline, the tailored CV
// in its skills modal on a copy. The parent removes (inline it toasts Undo).
const { sectionOrder, disabled = false } = defineProps<{
  sectionOrder: TailoredCv['sectionOrder']
  disabled?: boolean
}>()
const skills = defineModel<TailoredCv['skills']>('skills', { required: true })
const emit = defineEmits<{ remove: [index: number, name: string]; group: [] }>()

// The owner's categories (edited on the skills page); a deleted one shows as uncategorized.
const { items: categoryItems, known: knownCategory } = useSkillCategories()
const move = (from: number, to: number) => {
  skills.value.splice(to, 0, ...skills.value.splice(from, 1))
}

// Developer layout: a group label replaces the category name and skills sharing it print on one
// line, so the field suggests the labels already in use (case-insensitive, first spelling kept).
const usedGroups = computed(() => {
  const seen = new Map<string, string>()
  for (const { group } of skills.value) {
    const label = group?.trim()
    if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label)
  }
  return [...seen.values()]
})
const groupsId = useId()
</script>

<template>
  <VueDraggable
    v-model="skills"
    tag="ul"
    handle=".drag-handle"
    ghost-class="opacity-50"
    :animation="150"
    :disabled="disabled"
    class="space-y-1"
    data-testid="tailored-cv-skill-list"
  >
    <!-- Keyed without the index, so moving a skill keeps its row (and the focused
       button) instead of remounting it. Phones: name and remove first, then the
       category and order controls on their own line. -->
    <li
      v-for="(skill, i) in skills"
      :key="skill.sourceSkillId ?? skill.name"
      class="flex flex-wrap items-center gap-x-1 gap-y-1"
      data-testid="tailored-cv-skill"
    >
      <!-- Mouse only: the arrow buttons cover touch and keyboard, so no tab stop. -->
      <span
        class="drag-handle hidden shrink-0 cursor-grab touch-none p-1.5 text-muted sm:inline-flex"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-grip-vertical" class="size-4" />
      </span>
      <span class="min-w-0 flex-1 break-words">{{ skill.name }}</span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        class="sm:order-last"
        :aria-label="`Remove ${skill.name}`"
        @click="emit('remove', i, skill.name)"
      />
      <div class="flex w-full items-center gap-1 sm:w-auto">
        <!-- Categories and groups only group skills in the Developer layout. -->
        <template v-if="sectionOrder === 'DEVELOPER'">
          <USelect
            :model-value="knownCategory(skill.categoryId)"
            :items="categoryItems"
            size="sm"
            :aria-label="`${skill.name} category`"
            class="min-w-0 flex-1 sm:w-40 sm:flex-none"
            @update:model-value="(choice) => (skill.categoryId = fromCategoryChoice(choice))"
          />
          <!-- A native datalist keeps the field free text while offering used labels. -->
          <UInput
            :model-value="skill.group ?? ''"
            size="sm"
            placeholder="Group"
            :list="groupsId"
            autocomplete="off"
            :aria-label="`${skill.name} group`"
            class="min-w-0 flex-1 sm:w-36 sm:flex-none"
            data-testid="tailored-cv-skill-group"
            @update:model-value="(value) => ((skill.group = value), emit('group'))"
          />
        </template>
        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="i === 0"
          :aria-label="`Move ${skill.name} earlier`"
          @click="move(i, i - 1)"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="i === skills.length - 1"
          :aria-label="`Move ${skill.name} later`"
          @click="move(i, i + 1)"
        />
      </div>
    </li>
  </VueDraggable>
  <datalist :id="groupsId">
    <option v-for="label in usedGroups" :key="label" :value="label" />
  </datalist>
</template>
