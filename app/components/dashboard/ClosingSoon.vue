<script setup lang="ts">
const CLOSING_SOON = graphql(`
  query DashboardClosingSoon {
    listings(take: 5, dueWithinDays: 7) {
      items {
        id
        title
        dueOn
        company {
          name
        }
      }
      totalCount
    }
  }
`)

const { data, status, error, refresh } = useAsyncData(
  'dashboard-closing-soon',
  () => gql(CLOSING_SOON),
  {
    server: false
  }
)
// dueWithinDays only returns listings with a due date.
const items = computed(() =>
  (data.value?.listings?.items ?? []).map((l) => ({ ...l, dueOn: l.dueOn! }))
)
const total = computed(() => data.value?.listings?.totalCount ?? 0)

// The next two days are the part worth a color and words; the rest is just a date.
const due = (dueOn: string) => {
  const days = daysFromToday(dueOn)
  if (days > 2) return { label: formatDate(dueOn), urgent: false }
  return { label: days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In 2 days', urgent: true }
}
</script>

<template>
  <DashboardWidget
    title="Closing soon"
    icon="i-lucide-alarm-clock"
    icon-class="text-warning"
    :to="{ path: '/listings', query: { filter: 'closingSoon' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="Nothing closes in the next 7 days."
    :total="total > items.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="l in items" :key="l.id">
        <DashboardRow :id="l.id" :title="l.title" :subtitle="l.company.name">
          <UBadge
            :color="due(l.dueOn).urgent ? 'error' : 'neutral'"
            :icon="due(l.dueOn).urgent ? 'i-lucide-clock' : undefined"
            variant="subtle"
            data-testid="dashboard-due"
          >
            <time :datetime="l.dueOn" :title="`Due ${formatDate(l.dueOn)}`">{{
              due(l.dueOn).label
            }}</time>
          </UBadge>
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
