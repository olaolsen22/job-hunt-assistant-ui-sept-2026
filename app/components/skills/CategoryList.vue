<script setup lang="ts">
import type { SkillCategory } from '~/composables/useSkillCategories'
import type { SkillFilter } from '~/composables/useSkillsCatalog'

// The category column on wide screens and the "Manage categories" slideover on narrow ones. Picking
// a row filters the skills; the order is the order the Developer CV prints its skill lines in.
defineProps<{ totalCount: number; uncategorizedCount: number }>()
const filter = defineModel<SkillFilter>('filter', { required: true })
const emit = defineEmits<{ changed: [] }>()

const MOVE = graphql(
  `
    mutation MoveSkillCategory($input: MoveSkillCategoryInput!) {
      moveSkillCategory(input: $input) {
        skillCategories {
          ...SkillCategoryFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [SKILL_CATEGORY_FIELDS]
)

const { categories, status, error, refresh, replace } = useSkillCategories()

// Buttons rather than dragging: a handful of rows, and they work the same by touch and keyboard.
const { run, loading: moving } = useMutation(refresh)
const move = (category: SkillCategory, position: number) =>
  run(async () => {
    const { moveSkillCategory: payload } = await gql(MOVE, {
      input: { id: category.id, position }
    })
    if (payload.skillCategories) replace([...payload.skillCategories])
    return payload.errors
  })

const modalOpen = ref(false)
const editing = ref<SkillCategory | null>(null)
const openModal = (category: SkillCategory | null) => {
  editing.value = category
  modalOpen.value = true
}
const changed = async () => {
  await refresh()
  // A deleted category no longer filters anything.
  if (typeof filter.value === 'number' && !categories.value.some((c) => c.id === filter.value))
    filter.value = 'all'
  emit('changed')
}

const rowClass = (active: boolean) => [
  'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
  active ? 'bg-elevated font-medium text-highlighted' : 'hover:bg-elevated/50'
]
</script>

<template>
  <div class="space-y-1" data-testid="skill-categories">
    <button
      type="button"
      :class="rowClass(filter === 'all')"
      class="w-full"
      :aria-pressed="filter === 'all'"
      data-testid="skill-filter-all"
      @click="filter = 'all'"
    >
      <span>All skills</span>
      <span class="text-muted">{{ totalCount }}</span>
    </button>

    <USeparator class="my-2" />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Could not load your categories."
      :actions="[
        { label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => refresh() }
      ]"
    />
    <template v-else-if="status === 'pending' && !categories.length">
      <USkeleton v-for="i in 6" :key="i" class="h-8 w-full" />
    </template>
    <ul v-else class="space-y-1">
      <li
        v-for="(c, i) in categories"
        :key="c.id"
        class="flex items-center gap-1"
        data-testid="skill-category"
      >
        <button
          type="button"
          :class="rowClass(filter === c.id)"
          :aria-pressed="filter === c.id"
          :title="c.description ?? undefined"
          @click="filter = c.id"
        >
          <span class="truncate">{{ c.name }}</span>
          <span class="text-muted">{{ c.skillCount }}</span>
        </button>
        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="i === 0 || moving"
          :aria-label="`Move ${c.name} up`"
          data-testid="skill-category-up"
          @click="move(c, i - 1)"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="i === categories.length - 1 || moving"
          :aria-label="`Move ${c.name} down`"
          data-testid="skill-category-down"
          @click="move(c, i + 1)"
        />
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Edit ${c.name}`"
          data-testid="skill-category-edit"
          @click="openModal(c)"
        />
      </li>
    </ul>

    <!-- Skills with no category print last on a Developer CV, under Other. -->
    <button
      type="button"
      :class="rowClass(filter === 'none')"
      class="w-full"
      :aria-pressed="filter === 'none'"
      data-testid="skill-filter-none"
      @click="filter = 'none'"
    >
      <span>Uncategorized</span>
      <UBadge v-if="uncategorizedCount" color="warning" variant="subtle" size="sm">{{
        uncategorizedCount
      }}</UBadge>
      <span v-else class="text-muted">0</span>
    </button>

    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      size="sm"
      class="mt-2"
      data-testid="skill-category-add"
      @click="openModal(null)"
      >New category</UButton
    >
  </div>

  <SkillsCategoryModal v-model:open="modalOpen" :category="editing" @changed="changed" />
</template>
