<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `Job Hunt - ${title}` : 'Job Hunt')
})
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
