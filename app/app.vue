<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `Job Hunt - ${title}` : 'Job Hunt')
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
