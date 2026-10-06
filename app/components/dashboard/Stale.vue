<script setup lang="ts">
// Saved with no dated deadline, posted 14-45 days ago. No expiry clause on purpose: the server
// treats an ASAP listing as expired 14 days after posting, so the usual "hide expired" rule would
// hide exactly the listings this widget is for. Past 45 days they are written off, not nagged about.
const STALE = graphql(`
  query DashboardStale($from: LocalDate!, $to: LocalDate!) {
    listings(
      take: 5
      where: {
        status: { eq: SAVED }
        deadlineType: { neq: DATE }
        postedOn: { gte: $from, lte: $to }
      }
      order: [{ postedOn: ASC }]
    ) {
      items {
        id
        title
        postedOn
        company {
          name
        }
      }
      totalCount
    }
  }
`)

const { data, status, error, refresh } = useAsyncData(
  'dashboard-stale',
  () => gql(STALE, { from: daysAgoIso(45), to: daysAgoIso(14) }),
  { server: false }
)
const items = computed(() => data.value?.listings?.items ?? [])
const total = computed(() => data.value?.listings?.totalCount ?? 0)
</script>

<template>
  <DashboardWidget
    title="Stale listings"
    icon="i-lucide-hourglass"
    icon-class="text-warning"
    :to="{ path: '/listings', query: { status: 'SAVED' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="Nothing has been sitting for long."
    :total="total > items.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="l in items" :key="l.id">
        <DashboardRow :id="l.id" :title="l.title" :company="l.company.name">
          {{ -daysFromToday(l.postedOn) }} days old
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
