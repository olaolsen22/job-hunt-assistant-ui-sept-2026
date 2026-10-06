<script setup lang="ts">
const OFFERS = graphql(`
  query DashboardOffers {
    listings(take: 5, where: { status: { eq: OFFER } }, order: [{ statusChangedAt: DESC }]) {
      items {
        id
        title
        statusChangedAt
        company {
          name
        }
      }
      totalCount
    }
  }
`)

const { data, status, error, refresh } = useAsyncData('dashboard-offers', () => gql(OFFERS), {
  server: false
})
const items = computed(() => data.value?.listings?.items ?? [])
const total = computed(() => data.value?.listings?.totalCount ?? 0)
</script>

<template>
  <DashboardWidget
    title="Offers to answer"
    icon="i-lucide-handshake"
    icon-class="text-warning"
    :to="{ path: '/listings', query: { status: 'OFFER' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="No open offers."
    :total="total > items.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="l in items" :key="l.id">
        <DashboardRow :id="l.id" :title="l.title" :company="l.company.name">
          <template v-if="l.statusChangedAt"
            >since {{ formatDate(l.statusChangedAt.slice(0, 10)) }}</template
          >
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
