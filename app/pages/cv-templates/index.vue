<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { BaseCvListItem } from '~/composables/useBaseCvs'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { languageLabel } from '~/constants/listing'

definePageMeta({ title: 'CV templates' })

// Reusable CVs (the API's base CVs), sent as they are from a listing's Apply dialog. Archived ones
// are a tab in the URL, so Back from a template returns to the same view.
const route = useRoute()
const router = useRouter()
const tab = ref(route.query.archived === '1' ? 'archived' : 'active')
const archived = computed(() => tab.value === 'archived')
watch(archived, (value) => router.replace({ query: value ? { archived: '1' } : {} }))

const { data, status, error, refresh } = useAsyncData(
  'base-cvs',
  () => gql(BASE_CV_LIST, { archived: archived.value }).then((r) => r.baseCvs),
  { watch: [archived], server: false }
)
const baseCvs = computed(() => data.value ?? [])
const loading = computed(() => status.value === 'pending' || status.value === 'idle')

const toastSuccess = useSuccessToast()
const createOpen = ref(false)
const deleting = ref<BaseCvListItem>()
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (isOpen) => {
    if (!isOpen) deleting.value = undefined
  }
})

const { setArchived } = useBaseCvActions()
const archive = async (baseCv: BaseCvListItem, isArchived: boolean) => {
  if (!(await setArchived(baseCv.id, isArchived))) return
  toastSuccess(isArchived ? `${baseCv.name} archived` : `${baseCv.name} restored`)
  await refresh()
}
const menuItems = (baseCv: BaseCvListItem): DropdownMenuItem[] => [
  {
    label: baseCv.archivedAt ? 'Restore' : 'Archive',
    icon: baseCv.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive',
    onSelect: () => archive(baseCv, !baseCv.archivedAt)
  },
  {
    label: 'Delete…',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => (deleting.value = baseCv)
  }
]
const onDeleted = async (name: string, outcome: 'deleted' | 'archived') => {
  toastSuccess(outcome === 'deleted' ? `${name} deleted` : `${name} archived`)
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
      <p class="text-sm text-muted sm:flex-1">
        Reusable CVs for a kind of role, sent as they are. Every save that changes one is a new
        version, so you can tell which version you sent where.
      </p>
      <div class="flex items-center justify-between gap-3">
        <UTabs
          v-model="tab"
          :items="[
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived', icon: 'i-lucide-archive' }
          ]"
          :content="false"
          variant="pill"
          size="sm"
          aria-label="Show"
          data-testid="cv-templates-tabs"
        />
        <UButton icon="i-lucide-plus" data-testid="cv-templates-new" @click="createOpen = true"
          >New CV template</UButton
        >
      </div>
    </div>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div v-else-if="loading && !baseCvs.length" class="grid gap-3 xl:grid-cols-2">
      <USkeleton v-for="i in 2" :key="i" class="h-28 w-full" />
    </div>

    <div
      v-else-if="!baseCvs.length"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="cv-templates-empty"
    >
      <UIcon :name="archived ? 'i-lucide-archive' : 'i-lucide-files'" class="size-10 text-muted" />
      <p>
        {{
          archived
            ? 'No archived templates.'
            : 'No CV templates yet. Make one from your profile and reuse it for any listing.'
        }}
      </p>
      <UButton
        v-if="!archived"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        @click="createOpen = true"
        >New CV template</UButton
      >
    </div>

    <div v-else class="grid gap-3 xl:grid-cols-2" data-testid="cv-templates-list">
      <UCard
        v-for="b in baseCvs"
        :key="b.id"
        class="relative transition hover:bg-elevated"
        data-testid="cv-templates-row"
      >
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <!-- The ::after overlay makes the whole card the link, like /contacts. -->
              <NuxtLink
                :to="`/cv-templates/${b.id}`"
                class="break-words font-medium text-highlighted after:absolute after:inset-0"
                data-testid="cv-templates-row-link"
                >{{ b.name }}</NuxtLink
              >
              <UBadge color="neutral" variant="subtle" size="sm">{{
                languageLabel(b.language)
              }}</UBadge>
            </div>
            <p class="text-sm text-muted">
              v{{ b.latestVersion.number }} · updated {{ daysAgoLabel(b.updatedAt) }}
            </p>
            <p v-if="b.description" class="line-clamp-2 break-words text-sm">
              {{ b.description }}
            </p>
          </div>
          <!-- Above the card's link overlay, so the menu opens instead of the template. -->
          <UDropdownMenu :items="menuItems(b)" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              class="relative z-10"
              :aria-label="`More actions for ${b.name}`"
              data-testid="cv-templates-row-menu"
            />
          </UDropdownMenu>
        </div>
      </UCard>
    </div>

    <CvTemplatesDetailsModal v-model:open="createOpen" />
    <CvTemplatesDeleteModal
      v-if="deleting"
      v-model:open="deleteOpen"
      :base-cv="deleting"
      @deleted="onDeleted(deleting.name, 'deleted')"
      @archived="onDeleted(deleting.name, 'archived')"
    />
  </div>
</template>
