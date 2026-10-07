<script setup lang="ts">
// Listing.interviews can only be ordered, not filtered, and there is no top-level interviews query.
// So this fetches the Interviewing listings that have a future interview and flattens them here.
const INTERVIEWS = graphql(`
  query DashboardInterviews($now: DateTime!) {
    listings(
      take: 10
      where: { status: { eq: INTERVIEWING }, interviews: { some: { scheduledAt: { gte: $now } } } }
    ) {
      items {
        id
        title
        company {
          name
        }
        interviews(order: [{ scheduledAt: ASC }]) {
          id
          scheduledAt
        }
      }
    }
  }
`)

const { data, status, error, refresh } = useAsyncData(
  'dashboard-interviews',
  () => gql(INTERVIEWS, { now: new Date().toISOString() }),
  { server: false }
)
const rows = computed(() => {
  const now = Date.now()
  return (data.value?.listings?.items ?? [])
    .flatMap((l) =>
      l.interviews
        .filter((i) => new Date(i.scheduledAt).getTime() >= now)
        .map((i) => ({ key: i.id, listing: l, scheduledAt: i.scheduledAt }))
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 5)
})
</script>

<template>
  <DashboardWidget
    title="Upcoming interviews"
    icon="i-lucide-calendar-clock"
    icon-class="text-primary"
    :to="{ path: '/listings', query: { status: 'INTERVIEWING' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="rows.length === 0"
    empty-text="No interviews scheduled."
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="r in rows" :key="r.key">
        <DashboardRow
          :id="r.listing.id"
          :title="r.listing.title"
          :subtitle="r.listing.company.name"
        >
          {{ formatDateTime(r.scheduledAt) }}
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
