<script setup lang="ts">
// Same clause as the "to analyze" preset on /listings, so the numbers match the list it links to.
const TO_ANALYZE = graphql(`
  query DashboardToAnalyze($today: LocalDate!) {
    listings(
      take: 5
      where: {
        and: [
          { or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }] }
          { analyzedAt: { eq: null } }
        ]
      }
    ) {
      items {
        id
        title
        company {
          name
        }
      }
      totalCount
    }
  }
`)

const { data, status, error, refresh } = useAsyncData(
  'dashboard-to-analyze',
  () => gql(TO_ANALYZE, { today: todayIso() }),
  { server: false }
)
const items = computed(() => data.value?.listings?.items ?? [])
const total = computed(() => data.value?.listings?.totalCount ?? 0)
</script>

<template>
  <DashboardWidget
    title="To analyze"
    icon="i-lucide-clock"
    :to="{ path: '/listings', query: { filter: 'toAnalyze' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="Everything is analyzed."
    :total="total > items.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="l in items" :key="l.id">
        <DashboardRow :id="l.id" :title="l.title" :company="l.company.name" />
      </li>
    </ul>
  </DashboardWidget>
</template>
