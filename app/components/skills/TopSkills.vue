<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const TOP_SKILLS = graphql(`
  query TopSkills($since: DateTime, $requiredOnly: Boolean!) {
    topSkills(limit: 10, since: $since, requiredOnly: $requiredOnly) {
      listingCount
      skill {
        id
        name
        profileLevel
        category {
          name
        }
      }
    }
  }
`)

type Period = 'all' | '90' | '30'
const PERIODS: { label: string; value: Period }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Last 90 days', value: '90' },
  { label: 'Last 30 days', value: '30' }
]

// Kept in the URL so coming back from /listings shows the same view. Merged into the query, since
// the page's category filter lives there too.
const route = useRoute()
const router = useRouter()
const period = ref<Period>(
  route.query.period === '30' || route.query.period === '90' ? route.query.period : 'all'
)
const requiredOnly = ref(route.query.required === '1')
watch([period, requiredOnly], ([p, r]) => {
  const { period: _p, required: _r, ...rest } = route.query
  router.replace({
    query: { ...rest, ...(p !== 'all' && { period: p }), ...(r && { required: '1' }) }
  })
})

// `since` filters on when the listing was saved, not its posting date. Archived listings stay out
// (the API default): they're old history, and the period covers "recent vs. all".
const { data, status, error, refresh } = useAsyncData(
  'top-skills',
  () =>
    gql(TOP_SKILLS, {
      // Minus one: "last 30 days" includes today, like the dashboard's "this week" (6).
      since: period.value === 'all' ? null : localDayStartIso(Number(period.value) - 1),
      requiredOnly: requiredOnly.value
    }).then((r) => r.topSkills),
  { server: false, watch: [period, requiredOnly] }
)
const rows = computed(() => data.value ?? [])
const narrowed = computed(() => period.value !== 'all' || requiredOnly.value)
const reset = () => {
  period.value = 'all'
  requiredOnly.value = false
}

// Phones and tablets get five rows so the catalog below stays close to the top.
const expanded = ref(false)
</script>

<template>
  <!-- UCard, not AppCard: the header holds a description and a wrapping controls row, which
       AppCard's title + actions slot can't lay out on phones. -->
  <UCard data-testid="top-skills">
    <template #header>
      <div class="space-y-3">
        <div>
          <h2 class="font-semibold text-highlighted">Most requested skills</h2>
          <p class="text-sm text-muted">Across the listings you've saved.</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <USelect
            v-model="period"
            :items="PERIODS"
            aria-label="Period"
            class="w-40"
            data-testid="top-skills-period"
          />
          <USwitch v-model="requiredOnly" label="Required only" data-testid="top-skills-required" />
        </div>
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :description="ERROR_MESSAGES.generic"
      :actions="[
        { label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => refresh() }
      ]"
    />
    <!-- Skeletons only before the first answer; a control change keeps the old rows meanwhile. -->
    <div v-else-if="!data && status !== 'success'" class="space-y-2">
      <USkeleton v-for="i in 5" :key="i" class="h-11 w-full" />
    </div>
    <div
      v-else-if="!rows.length"
      class="flex flex-col items-center gap-3 py-8 text-center"
      data-testid="top-skills-empty"
    >
      <UIcon name="i-lucide-chart-bar" class="size-10 text-muted" />
      <template v-if="narrowed">
        <p class="text-sm text-muted">
          {{
            requiredOnly
              ? 'No required skills in listings from this period.'
              : 'No skills in listings from this period.'
          }}
        </p>
        <UButton color="neutral" variant="subtle" @click="reset">Show all time</UButton>
      </template>
      <template v-else>
        <p class="text-sm text-muted">
          No skills yet. They show up here once your saved listings list some.
        </p>
        <UButton color="neutral" variant="subtle" icon="i-lucide-plus" to="/listings/add"
          >Add listing</UButton
        >
      </template>
    </div>
    <template v-else>
      <!-- grid-cols-1 (minmax(0, 1fr)) so a long name truncates instead of widening the column. -->
      <ul class="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
        <li
          v-for="(r, i) in rows"
          :key="r.skill.id"
          :class="{ 'max-xl:hidden': i >= 5 && !expanded }"
          data-testid="top-skills-row"
        >
          <ULink
            :to="{ path: '/listings', query: { skill: r.skill.name } }"
            class="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 hover:bg-elevated"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-highlighted" :title="r.skill.name">
                {{ r.skill.name }}
              </p>
              <p v-if="r.skill.category" class="truncate text-xs text-muted">
                {{ r.skill.category.name }}
              </p>
            </div>
            <span class="shrink-0 text-sm text-muted"
              >{{ r.listingCount }} {{ r.listingCount === 1 ? 'listing' : 'listings' }}</span
            >
            <UBadge
              v-if="r.skill.profileLevel != null"
              color="success"
              variant="subtle"
              icon="i-lucide-check"
              class="shrink-0"
              >On profile</UBadge
            >
            <UBadge v-else color="neutral" variant="outline" class="shrink-0"
              >Not on profile</UBadge
            >
          </ULink>
        </li>
      </ul>
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <!-- The /listings default view hides expired and rejected listings, so a count can be
             higher than the list it opens. -->
        <p class="text-xs text-muted">Counts include expired and rejected listings.</p>
        <UButton
          v-if="rows.length > 5"
          color="neutral"
          variant="link"
          class="xl:hidden"
          data-testid="top-skills-toggle"
          @click="expanded = !expanded"
          >{{ expanded ? 'Show top 5' : `Show top ${rows.length}` }}</UButton
        >
      </div>
    </template>
  </UCard>
</template>
