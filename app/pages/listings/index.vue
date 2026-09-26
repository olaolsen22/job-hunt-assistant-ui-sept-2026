<script setup lang="ts">
definePageMeta({ title: 'Job listings' })
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <UButton to="/listings/add" icon="i-lucide-plus">Add listing</UButton>
    </div>

    <p class="text-muted">The list comes later.</p>
  </div>
</template>
