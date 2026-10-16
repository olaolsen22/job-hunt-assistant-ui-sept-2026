<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { CatalogSkill, SkillFilter } from '~/composables/useSkillsCatalog'

definePageMeta({ title: 'Skills' })

const DELETE_SKILL = graphql(`
  mutation DeleteSkill($input: DeleteSkillInput!) {
    deleteSkill(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const { data: skills, status, error, refresh } = useSkillsCatalog()
const { categories, refresh: refreshCategories } = useSkillCategories()
const loading = computed(() => status.value === 'pending' || status.value === 'idle')

// The category filter lives in the URL like the other list pages, so a reload keeps it.
const route = useRoute()
const router = useRouter()
const fromQuery = (v: unknown): SkillFilter =>
  v === 'none' ? 'none' : Number.isInteger(Number(v)) && v ? Number(v) : 'all'
const filter = ref<SkillFilter>(fromQuery(route.query.category))
watch(filter, (value) =>
  router.replace({ query: value === 'all' ? {} : { category: String(value) } })
)

const search = ref('')
// Deleting a category clears it on its skills, so null is the only uncategorized value.
const isUncategorized = (s: CatalogSkill) => s.categoryId == null
const uncategorizedCount = computed(() => skills.value.filter(isUncategorized).length)
const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  return skills.value.filter(
    (s) =>
      (filter.value === 'all' ||
        (filter.value === 'none' ? isUncategorized(s) : s.categoryId === filter.value)) &&
      (!term ||
        s.name.toLowerCase().includes(term) ||
        s.translations.some((t) => t.name.toLowerCase().includes(term)))
  )
})
const filterLabel = computed(() =>
  filter.value === 'all'
    ? 'All skills'
    : filter.value === 'none'
      ? 'Uncategorized'
      : (categories.value.find((c) => c.id === filter.value)?.name ?? 'All skills')
)

// Ticks survive filtering and searching, so a merge can pick skills from different categories.
const selected = ref<number[]>([])

// Counts change with every skill change, so both lists reload; the profile reloads on its next visit.
const reload = async () => {
  selected.value = []
  await Promise.all([refresh(), refreshCategories()])
}
const categorized = (skill: CatalogSkill, categoryId: number | null) => {
  skill.categoryId = categoryId
  refreshCategories()
}

const categoriesOpen = ref(false)
const cleanupOpen = ref(false)

const mergeOpen = ref(false)
const mergeIds = ref<number[]>([])
const openMerge = (ids: number[]) => {
  mergeIds.value = ids
  mergeOpen.value = true
}

const renaming = ref<CatalogSkill | null>(null)
const renameOpen = ref(false)
const openRename = (skill: CatalogSkill) => {
  renaming.value = skill
  renameOpen.value = true
}

// A skill used anywhere can't be deleted; the API says where, and merging is the way out.
const deleting = ref<CatalogSkill | null>(null)
const deleteOpen = ref(false)
const inUse = ref<string>()
const deleteBusy = ref(false)
const toast = useToast()
const openDelete = (skill: CatalogSkill) => {
  deleting.value = skill
  inUse.value = undefined
  deleteOpen.value = true
}
const confirmDelete = async () => {
  const skill = deleting.value!
  if (inUse.value) {
    deleteOpen.value = false
    openMerge([skill.id])
    return
  }
  deleteBusy.value = true
  try {
    const errors = (await gql(DELETE_SKILL, { input: { id: skill.id } })).deleteSkill.errors
    const inUseError = errors?.find((e) => e.__typename === 'SkillInUseError')
    if (inUseError) inUse.value = inUseError.message
    else if (errors?.length) toast.add({ title: errors[0]!.message, color: 'error' })
    else {
      deleteOpen.value = false
      await reload()
    }
  } catch {
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div>
    <div class="grid gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      <!-- Categories beside the skills on wide screens; a chip row and a slideover below `lg`. -->
      <UCard class="hidden self-start lg:block" data-testid="skills-categories-panel">
        <template #header>
          <h2 class="font-semibold text-highlighted">Categories</h2>
          <p class="text-sm text-muted">In the order a Developer CV prints them.</p>
        </template>
        <SkillsCategoryList
          v-model:filter="filter"
          :total-count="skills.length"
          :uncategorized-count="uncategorizedCount"
          @changed="refresh"
        />
      </UCard>

      <div class="min-w-0 space-y-4 lg:col-span-2 xl:col-span-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search skills"
            class="w-full sm:max-w-sm"
            data-testid="skills-search"
          >
            <template v-if="search" #trailing>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="link"
                aria-label="Clear search"
                @click="search = ''"
              />
            </template>
          </UInput>
          <div class="flex gap-2 sm:ml-auto">
            <UButton
              icon="i-lucide-tags"
              color="neutral"
              variant="subtle"
              class="flex-1 justify-center lg:hidden"
              data-testid="skills-manage-categories"
              @click="categoriesOpen = true"
              >Manage categories</UButton
            >
            <UButton
              icon="i-lucide-sparkles"
              color="neutral"
              variant="subtle"
              class="flex-1 justify-center"
              data-testid="skills-cleanup"
              @click="cleanupOpen = true"
              >Clean up with AI</UButton
            >
          </div>
        </div>

        <!-- Below `lg` the filter is a scrollable chip row, so it costs one line on phones. -->
        <div
          class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
          data-testid="skills-chips"
        >
          <UButton
            size="sm"
            color="neutral"
            :variant="filter === 'all' ? 'solid' : 'subtle'"
            :aria-pressed="filter === 'all'"
            class="shrink-0"
            @click="filter = 'all'"
            >All {{ skills.length }}</UButton
          >
          <UButton
            v-for="c in categories"
            :key="c.id"
            size="sm"
            color="neutral"
            :variant="filter === c.id ? 'solid' : 'subtle'"
            :aria-pressed="filter === c.id"
            class="shrink-0"
            @click="filter = c.id"
            >{{ c.name }} {{ c.skillCount }}</UButton
          >
          <UButton
            size="sm"
            :color="uncategorizedCount ? 'warning' : 'neutral'"
            :variant="filter === 'none' ? 'solid' : 'subtle'"
            :aria-pressed="filter === 'none'"
            class="shrink-0"
            @click="filter = 'none'"
            >Uncategorized {{ uncategorizedCount }}</UButton
          >
        </div>

        <UCard :ui="{ body: 'py-2 sm:py-2' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted" data-testid="skills-heading">
                {{ filterLabel }}
              </h2>
              <span v-if="!loading" class="text-sm text-muted">{{ visible.length }}</span>
            </div>
          </template>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            :description="ERROR_MESSAGES.generic"
            class="my-2"
            :actions="[
              { label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => refresh() }
            ]"
          />
          <div v-else-if="loading && !skills.length" class="space-y-3 py-2">
            <USkeleton v-for="i in 6" :key="i" class="h-12 w-full" />
          </div>
          <div
            v-else-if="!visible.length"
            class="flex flex-col items-center gap-3 py-12 text-center"
            data-testid="skills-empty"
          >
            <UIcon name="i-lucide-tags" class="size-10 text-muted" />
            <p>
              {{
                !skills.length
                  ? 'No skills yet. They come from your profile and the listings you save.'
                  : search
                    ? 'No skills match your search.'
                    : 'No skills in this category.'
              }}
            </p>
          </div>
          <SkillsSkillList
            v-else
            v-model:selected="selected"
            :skills="visible"
            @categorized="categorized"
            @rename="openRename"
            @merge="(s) => openMerge(selected.includes(s.id) ? selected : [...selected, s.id])"
            @delete="openDelete"
          />
        </UCard>

        <!-- Sticky so the merge action stays in reach while ticking skills further down. -->
        <div
          v-if="selected.length"
          class="sticky bottom-4 z-10 flex items-center justify-between gap-2 rounded-lg bg-default p-3 shadow-lg ring ring-default"
          data-testid="skills-selection"
        >
          <span class="text-sm">{{ selected.length }} selected</span>
          <div class="flex gap-2">
            <UButton color="neutral" variant="ghost" @click="selected = []">Clear</UButton>
            <UButton
              icon="i-lucide-merge"
              :disabled="selected.length < 2"
              data-testid="skills-merge"
              @click="openMerge(selected)"
              >Merge</UButton
            >
          </div>
        </div>
      </div>
    </div>

    <USlideover
      v-model:open="categoriesOpen"
      title="Categories"
      description="In the order a Developer CV prints them."
    >
      <template #body>
        <SkillsCategoryList
          v-model:filter="filter"
          :total-count="skills.length"
          :uncategorized-count="uncategorizedCount"
          @changed="refresh"
        />
      </template>
    </USlideover>

    <LazySkillsMergeModal
      v-model:open="mergeOpen"
      :skills="skills"
      :initial-ids="mergeIds"
      @merged="reload"
    />
    <LazySkillsRenameModal
      v-model:open="renameOpen"
      :skill="renaming"
      :skills="skills"
      @renamed="reload"
    />
    <LazyProfileSkillCleanupModal v-model:open="cleanupOpen" @changed="reload" />

    <AppConfirmModal
      v-model:open="deleteOpen"
      :title="`Delete ${deleting?.name}?`"
      :description="
        inUse ? `${inUse} Merge it into another skill instead.` : 'It isn\'t used anywhere.'
      "
      :confirm-label="inUse ? 'Merge instead…' : 'Delete'"
      :color="inUse ? 'primary' : 'error'"
      :loading="deleteBusy"
      @confirm="confirmDelete"
    />
  </div>
</template>
