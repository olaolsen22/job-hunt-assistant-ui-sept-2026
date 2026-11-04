<script setup lang="ts">
import type { ListingImportItem } from '~/composables/useListingImports'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Job imports' })

// Pending is the default view, matching the layout's notice. "All" is in the URL so Back from
// quick add returns to it.
const route = useRoute()
const router = useRouter()
const tab = ref(route.query.view === 'all' ? 'all' : 'pending')
watch(tab, (value) => router.replace({ query: value === 'all' ? { view: 'all' } : {} }))
const pendingOnly = computed(() => tab.value === 'pending')

const { data, status, error, refresh } = useAsyncData(
  'listing-imports',
  () => fetchListingImports(pendingOnly.value ? false : null, null),
  { watch: [pendingOnly], server: false }
)
// Pages after the first, from Load more; a refetch of the first page starts over.
const more = ref<ListingImportItem[]>([])
const endCursor = ref<string | null>(null)
const hasNextPage = ref(false)
watch(
  data,
  (page) => {
    more.value = []
    endCursor.value = page?.pageInfo.endCursor ?? null
    hasNextPage.value = !!page?.pageInfo.hasNextPage
  },
  { immediate: true }
)
const imports = computed(() => [...(data.value?.nodes ?? []), ...more.value])
// The sidebar's count; marking an import reviewed refreshes it.
const pendingCount = usePendingImportCount()
const tabItems = computed(() => [
  {
    label: 'To review',
    value: 'pending',
    icon: 'i-lucide-inbox',
    badge: pendingCount.value
      ? { label: String(pendingCount.value), color: 'neutral' as const, variant: 'soft' as const }
      : undefined
  },
  { label: 'All', value: 'all', icon: 'i-lucide-list' }
])
const loading = computed(() => status.value === 'pending' || status.value === 'idle')

const toast = useToast()
const loadingMore = ref(false)
const loadMore = async () => {
  loadingMore.value = true
  const view = tab.value
  try {
    const page = await fetchListingImports(pendingOnly.value ? false : null, endCursor.value)
    // A tab switch meanwhile has started the list over.
    if (tab.value !== view) return
    more.value.push(...(page?.nodes ?? []))
    endCursor.value = page?.pageInfo.endCursor ?? null
    hasNextPage.value = !!page?.pageInfo.hasNextPage
  } catch {
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    loadingMore.value = false
  }
}

const { setReviewed } = useSetImportReviewed()
const toastSuccess = useSuccessToast()
const busyId = ref<number>()
const toggleReviewed = async (item: ListingImportItem) => {
  busyId.value = item.id
  try {
    const isReviewed = !item.reviewedAt
    if (!(await setReviewed(item.id, isReviewed))) return
    toastSuccess(isReviewed ? 'Marked reviewed' : 'Marked unreviewed')
    await refresh()
  } finally {
    busyId.value = undefined
  }
}

const jobsLabel = (n: number) => `${n} ${n === 1 ? 'job' : 'jobs'}`
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <p class="text-sm text-muted">
        Files of collected jobs from the import folder. Review one to check its new jobs, fix
        anything wrong and save them as listings. It’s marked reviewed once nothing is left to save;
        leave early and it stays here.
      </p>
      <UTabs
        v-model="tab"
        :items="tabItems"
        :content="false"
        class="sm:w-fit"
        aria-label="Show"
        data-testid="imports-tabs"
      />
    </div>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div v-else-if="loading && !imports.length" class="grid gap-3">
      <USkeleton v-for="i in 3" :key="i" class="h-24 w-full" />
    </div>

    <div
      v-else-if="!imports.length"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="imports-empty"
    >
      <UIcon
        :name="pendingOnly ? 'i-lucide-inbox' : 'i-lucide-file-json'"
        class="size-10 text-muted"
      />
      <p>{{ pendingOnly ? 'Nothing to review. You’re all caught up.' : 'No imports yet.' }}</p>
      <UButton v-if="pendingOnly" color="neutral" variant="subtle" @click="tab = 'all'"
        >Show all imports</UButton
      >
    </div>

    <template v-else>
      <!-- The previous tab's rows stay until the new ones arrive; dimmed and inert, like /companies. -->
      <div
        class="grid gap-3 transition-opacity"
        :class="{ 'pointer-events-none opacity-50': loading }"
        data-testid="imports-list"
      >
        <UCard v-for="item in imports" :key="item.id" data-testid="imports-row">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <div class="min-w-0 space-y-1 md:flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-highlighted">{{
                  formatDateTime(item.generatedAt)
                }}</span>
                <UBadge :label="item.kind" color="neutral" variant="subtle" />
                <UBadge
                  v-if="item.reviewedAt"
                  label="Reviewed"
                  icon="i-lucide-check"
                  color="success"
                  variant="subtle"
                  data-testid="imports-row-reviewed"
                />
              </div>
              <p class="text-sm break-all text-muted">
                <template v-if="!item.error">{{ jobsLabel(item.itemCount) }} · </template
                >{{ item.fileName }}
              </p>
              <UAlert
                v-if="item.error"
                color="error"
                variant="subtle"
                icon="i-lucide-circle-alert"
                title="This file couldn’t be imported"
                :description="item.error"
                data-testid="imports-row-error"
              />
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton
                v-if="!item.error"
                :to="`/listings/quick-add?import=${item.id}`"
                trailing-icon="i-lucide-arrow-right"
                :variant="item.reviewedAt ? 'outline' : 'solid'"
                :disabled="!item.itemCount"
                data-testid="imports-row-open"
                >{{ item.reviewedAt ? 'Open' : 'Review' }}</UButton
              >
              <UButton
                :icon="item.reviewedAt ? 'i-lucide-undo-2' : 'i-lucide-check'"
                color="neutral"
                variant="ghost"
                :loading="busyId === item.id"
                :disabled="busyId !== undefined"
                data-testid="imports-row-toggle"
                @click="toggleReviewed(item)"
                >{{ item.reviewedAt ? 'Mark unreviewed' : 'Mark reviewed' }}</UButton
              >
            </div>
          </div>
        </UCard>
      </div>

      <div v-if="hasNextPage" class="flex justify-center">
        <UButton
          color="neutral"
          variant="subtle"
          :loading="loadingMore"
          data-testid="imports-load-more"
          @click="loadMore"
          >Load more</UButton
        >
      </div>
    </template>
  </div>
</template>
