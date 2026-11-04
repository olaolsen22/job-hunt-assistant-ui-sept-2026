<script setup lang="ts">
// People whose follow-up date has come, oldest first. `where` is inline: a filter variable trips
// the API's cost check.
const FOLLOW_UPS = graphql(`
  query DashboardFollowUps($today: LocalDate!) {
    contacts(first: 5, where: { followUpOn: { lte: $today } }, order: [{ followUpOn: ASC }]) {
      nodes {
        id
        name
        followUpOn
        company {
          name
        }
      }
      totalCount
    }
  }
`)

const { data, status, error, refresh } = useAsyncData(
  'dashboard-follow-ups',
  () => gql(FOLLOW_UPS, { today: todayIso() }),
  { server: false }
)
const items = computed(() => data.value?.contacts?.nodes ?? [])
const total = computed(() => data.value?.contacts?.totalCount ?? 0)
</script>

<template>
  <DashboardWidget
    title="Follow-ups due"
    icon="i-lucide-bell-ring"
    icon-class="text-warning"
    :to="{ path: '/contacts', query: { due: '1' } }"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="items.length === 0"
    empty-text="No follow-ups due."
    :total="total > items.length ? total : undefined"
    @retry="refresh()"
  >
    <ul class="divide-y divide-default">
      <li v-for="c in items" :key="c.id">
        <DashboardRow
          :id="c.id"
          :to="`/contacts/${c.id}`"
          :title="c.name"
          :subtitle="c.company.name"
        >
          <!-- The filter only returns contacts with a follow-up date. -->
          {{ followUpSummary(c.followUpOn!).label }}
        </DashboardRow>
      </li>
    </ul>
  </DashboardWidget>
</template>
