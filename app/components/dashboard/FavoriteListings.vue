<script setup lang="ts">
const FAVORITE_LISTINGS = graphql(`
  query DashboardFavoriteListings {
    listings(
      take: 5
      where: { favoritedAt: { neq: null }, status: { neq: REJECTED } }
      order: [{ favoritedAt: DESC }]
    ) {
      items {
        id
        title
        status
        company {
          name
        }
      }
      totalCount
    }
  }
`)

// Rejected applications are left out, like on /listings (which "View all" opens).
const { data, status, error, refresh } = useAsyncData(
  'dashboard-favorite-listings',
  () => gql(FAVORITE_LISTINGS),
  { server: false }
)
const items = computed(() => data.value?.listings?.items ?? [])
const total = computed(() => data.value?.listings?.totalCount ?? 0)
</script>

<template>
  <DashboardWidget
    title="Favorited listings"
    icon="i-lucide-star"
    icon-class="text-warning"
    :to="{ path: '/listings', query: { favorites: '1' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="No favorites yet. Star a listing to keep it here."
    :total="total > items.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="l in items" :key="l.id">
        <DashboardRow :id="l.id" :title="l.title" :subtitle="l.company.name">
          <ListingsStatusBadge :status="l.status" />
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
