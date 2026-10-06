<script setup lang="ts">
import { APPLICATION_STATUS_OPTIONS } from '~/constants/listing'

// One aliased count per status in a single request, like the filter counts on /listings.
const PIPELINE = graphql(`
  query DashboardPipeline {
    SAVED: listings(take: 1, where: { status: { eq: SAVED } }) {
      totalCount
    }
    APPLIED: listings(take: 1, where: { status: { eq: APPLIED } }) {
      totalCount
    }
    INTERVIEWING: listings(take: 1, where: { status: { eq: INTERVIEWING } }) {
      totalCount
    }
    OFFER: listings(take: 1, where: { status: { eq: OFFER } }) {
      totalCount
    }
    ACCEPTED: listings(take: 1, where: { status: { eq: ACCEPTED } }) {
      totalCount
    }
    REJECTED: listings(take: 1, where: { status: { eq: REJECTED } }) {
      totalCount
    }
    WITHDRAWN: listings(take: 1, where: { status: { eq: WITHDRAWN } }) {
      totalCount
    }
  }
`)

const { data, status, error, refresh } = useAsyncData('dashboard-pipeline', () => gql(PIPELINE), {
  server: false
})
const cells = computed(() =>
  APPLICATION_STATUS_OPTIONS.map((o) => ({
    status: o.value,
    count: data.value?.[o.value]?.totalCount ?? 0
  }))
)
</script>

<template>
  <DashboardWidget
    title="Pipeline"
    icon="i-lucide-kanban"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="false"
    empty-text=""
    @retry="refresh()"
  >
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      <NuxtLink
        v-for="c in cells"
        :key="c.status"
        :to="{ path: '/listings', query: { status: c.status } }"
        class="flex flex-col items-center gap-1 rounded-md bg-elevated p-3 hover:bg-accented"
        data-testid="dashboard-pipeline-cell"
      >
        <span class="text-2xl font-semibold" :class="c.count ? 'text-highlighted' : 'text-muted'">{{
          c.count
        }}</span>
        <ListingsStatusBadge :status="c.status" />
      </NuxtLink>
    </div>
  </DashboardWidget>
</template>
