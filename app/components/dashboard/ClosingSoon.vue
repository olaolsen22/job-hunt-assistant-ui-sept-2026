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
const items = computed(() => data.value?.listings?.items ?? [])
const total = computed(() => data.value?.listings?.totalCount ?? 0)

// Due today or tomorrow is the part worth a color; the rest is just a date.
const color = (dueOn: string) => (daysFromToday(dueOn) <= 2 ? 'warning' : 'neutral')
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
        <DashboardRow :id="l.id" :title="l.title" :company="l.company.name">
          <UBadge :color="color(l.dueOn)" variant="subtle">{{ formatDate(l.dueOn) }}</UBadge>
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
