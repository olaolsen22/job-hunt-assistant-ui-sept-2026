<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CatalogSkill } from '~/composables/useSkillsCatalog'

// One line per skill from `md` up, a stacked card below. The category saves as soon as it's picked.
defineProps<{ skills: readonly CatalogSkill[] }>()
const selected = defineModel<number[]>('selected', { required: true })
const emit = defineEmits<{
  categorized: [skill: CatalogSkill, categoryId: number | null]
  rename: [skill: CatalogSkill]
  merge: [skill: CatalogSkill]
  delete: [skill: CatalogSkill]
}>()

const SET_CATEGORY = graphql(`
  mutation SetSkillCategoryInline($input: SetSkillCategoryInput!) {
    setSkillCategory(input: $input) {
      skill {
        categoryId
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

const { items: categoryItems } = useSkillCategories()
const { run } = useMutation()
const saving = ref<number>()
const setCategory = async (skill: CatalogSkill, choice: CategoryChoice) => {
  const categoryId = fromCategoryChoice(choice)
  saving.value = skill.id
  const ok = await run(
    async () =>
      (await gql(SET_CATEGORY, { input: { skillId: skill.id, categoryId } })).setSkillCategory
        .errors
  )
  saving.value = undefined
  if (ok) emit('categorized', skill, categoryId)
}

const toggle = (id: number, on: boolean) => {
  selected.value = on ? [...selected.value, id] : selected.value.filter((x) => x !== id)
}

const usage = (s: CatalogSkill) =>
  [
    s.profileLevel != null && `On profile · level ${s.profileLevel}/5`,
    `${s.listingCount} ${s.listingCount === 1 ? 'listing' : 'listings'}`
  ]
    .filter(Boolean)
    .join(' · ')

// Delete is offered only where it can work; the API still refuses a skill tagged on an entry.
const actions = (s: CatalogSkill): DropdownMenuItem[] => [
  { label: 'Rename', icon: 'i-lucide-pencil', onSelect: () => emit('rename', s) },
  { label: 'Merge…', icon: 'i-lucide-merge', onSelect: () => emit('merge', s) },
  ...(s.listingCount === 0 && s.profileLevel == null
    ? [
        {
          label: 'Delete',
          icon: 'i-lucide-trash-2',
          color: 'error' as const,
          onSelect: () => emit('delete', s)
        }
      ]
    : [])
]
</script>

<template>
  <ul class="divide-y divide-default" data-testid="skills-list">
    <li
      v-for="s in skills"
      :key="s.id"
      class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 md:flex-nowrap"
      data-testid="skills-row"
    >
      <!-- Padding gives the checkbox a finger-sized target on phones. -->
      <UCheckbox
        :model-value="selected.includes(s.id)"
        :aria-label="`Select ${s.name}`"
        class="p-1"
        data-testid="skills-select"
        @update:model-value="(on) => toggle(s.id, !!on)"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-highlighted" :title="s.name">{{ s.name }}</p>
        <p class="truncate text-sm text-muted">
          <span v-if="s.translations.length"
            >{{ s.translations.map((t) => t.name).join(', ') }} ·
          </span>
          <span data-testid="skills-usage">{{ usage(s) }}</span>
        </p>
      </div>
      <div class="flex w-full items-center gap-2 pl-9 md:w-auto md:pl-0">
        <USelect
          :model-value="toCategoryChoice(s.categoryId)"
          :items="categoryItems"
          :loading="saving === s.id"
          :disabled="saving === s.id"
          :aria-label="`${s.name} category`"
          class="min-w-0 flex-1 md:w-44 md:flex-none"
          data-testid="skills-category"
          @update:model-value="(choice) => setCategory(s, choice as CategoryChoice)"
        />
        <UDropdownMenu :items="actions(s)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Actions for ${s.name}`"
            data-testid="skills-actions"
          />
        </UDropdownMenu>
      </div>
    </li>
  </ul>
</template>
