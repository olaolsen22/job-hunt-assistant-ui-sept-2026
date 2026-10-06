<script setup lang="ts">
definePageMeta({ title: 'Dashboard' })
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-muted uppercase">Urgent</h2>
      <div class="grid gap-4 lg:grid-cols-2">
        <DashboardClosingSoon />
        <DashboardInterviews />
        <DashboardOffers />
        <DashboardStale />
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-muted uppercase">Progress</h2>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="lg:col-span-2"><DashboardPipeline /></div>
        <DashboardAppliedThisWeek />
        <DashboardToAnalyze />
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-muted uppercase">Shortcuts</h2>
      <div class="grid gap-4 lg:grid-cols-2">
        <DashboardFavoriteListings />
        <DashboardFavoriteCompanies />
      </div>
    </section>

    <DashboardApiHealth />
  </div>
</template>
