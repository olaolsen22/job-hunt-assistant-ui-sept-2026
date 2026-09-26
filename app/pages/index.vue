<script setup lang="ts">
useHead({ title: 'Dashboard' })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-muted">Sample page. Features come later.</p>
    </div>

    <DashboardApiHealth />
  </div>
</template>
