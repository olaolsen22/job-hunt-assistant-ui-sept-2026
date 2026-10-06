<script setup lang="ts">
const APPLIED = graphql(`
  query DashboardAppliedThisWeek($since: DateTime!) {
    listings(
      take: 5
      where: { status: { eq: APPLIED }, statusChangedAt: { gte: $since } }
      order: [{ statusChangedAt: DESC }]
    ) {
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

// Today and the six days before it. Rough by design: a listing that has moved on to
// Interviewing no longer has status Applied, so it drops out of this count.
const { data, status, error, refresh } = useAsyncData(
  'dashboard-applied-this-week',
  () => gql(APPLIED, { since: localDayStartIso(6) }),
  { server: false }
)
const items = computed(() => data.value?.listings?.items ?? [])
const total = computed(() => data.value?.listings?.totalCount ?? 0)
</script>

<template>
  <DashboardWidget
    title="Applied this week"
    icon="i-lucide-send"
    :to="{ path: '/listings', query: { status: 'APPLIED' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="No applications in the last 7 days."
    @retry="refresh()"
  >
    <p class="mb-2 text-3xl font-semibold text-highlighted" data-testid="dashboard-applied-total">
      {{ total }}
    </p>
    <ul class="divide-y divide-default">
      <li v-for="l in items" :key="l.id">
        <DashboardRow :id="l.id" :title="l.title" :company="l.company.name">
          <template v-if="l.statusChangedAt">{{
            formatDate(l.statusChangedAt.slice(0, 10))
          }}</template>
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
