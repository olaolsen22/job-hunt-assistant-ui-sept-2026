<script setup lang="ts">
const FAVORITE_COMPANIES = graphql(`
  query DashboardFavoriteCompanies {
    companies(first: 5, where: { favoritedAt: { neq: null } }, order: [{ favoritedAt: DESC }]) {
      nodes {
        id
        name
      }
      totalCount
    }
  }
`)

// One request for every company's open listings (Saved, not archived, not past due), grouped below,
// instead of one per company. Same expiry clause as the /listings default.
const OPEN_LISTINGS = graphql(`
  query DashboardCompanyOpenListings($ids: [Int!]!, $today: LocalDate!) {
    listings(
      take: 30
      where: {
        and: [
          { or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }] }
          { companyId: { in: $ids } }
          { status: { eq: SAVED } }
        ]
      }
    ) {
      items {
        id
        title
        companyId
        dueOn
      }
    }
  }
`)

const MAX_PER_COMPANY = 3

// The second request needs the first one's ids, so they run in sequence inside one widget.
const { data, status, error, refresh } = useAsyncData(
  'dashboard-favorite-companies',
  async () => {
    const { companies } = await gql(FAVORITE_COMPANIES)
    const nodes = companies?.nodes ?? []
    if (!nodes.length) return { companies: [], total: 0 }
    const { listings } = await gql(OPEN_LISTINGS, {
      ids: nodes.map((c) => c.id),
      today: todayIso()
    })
    const open = listings?.items ?? []
    return {
      companies: nodes.map((c) => ({ ...c, open: open.filter((l) => l.companyId === c.id) })),
      total: companies?.totalCount ?? 0
    }
  },
  { server: false }
)
const companies = computed(() => data.value?.companies ?? [])
const total = computed(() => data.value?.total ?? 0)
</script>

<template>
  <DashboardWidget
    title="Favorited companies"
    icon="i-lucide-building-2"
    icon-class="text-warning"
    to="/companies"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="companies.length === 0"
    empty-text="No favorite companies yet. Star one on the Companies page."
    :total="total > companies.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <li v-for="c in companies" :key="c.id" data-testid="dashboard-company">
        <div class="flex items-center justify-between gap-2">
          <NuxtLink
            :to="`/companies/${c.id}`"
            class="truncate font-medium text-highlighted hover:underline"
            >{{ c.name }}</NuxtLink
          >
          <UBadge color="neutral" variant="subtle">{{ c.open.length }} open</UBadge>
        </div>
        <p v-if="!c.open.length" class="text-sm text-muted">No open listings</p>
        <ul v-else class="ml-3 divide-y divide-default border-l border-default pl-3">
          <li v-for="l in c.open.slice(0, MAX_PER_COMPANY)" :key="l.id">
            <DashboardRow :id="l.id" :title="l.title" :subtitle="c.name">
              {{ l.dueOn ? formatDate(l.dueOn) : '' }}
            </DashboardRow>
          </li>
          <li v-if="c.open.length > MAX_PER_COMPANY" class="py-2 text-sm">
            <!-- The company's active listings; that list also shows the ones already applied for. -->
            <ULink
              :to="{ path: '/listings', query: { company: c.id } }"
              class="text-muted hover:text-default"
              data-testid="dashboard-company-more"
              >+{{ c.open.length - MAX_PER_COMPANY }} more</ULink
            >
          </li>
        </ul>
      </li>
    </ul>
  </DashboardWidget>
</template>
