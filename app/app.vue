<script setup lang="ts">
const colorMode = useColorMode()
// Phone status bar matches the navbar (--ui-bg: white, or neutral-950 in dark; see main.css).
// Follows the in-app toggle, which a prefers-color-scheme media pair would not.
const themeColor = computed(() => (colorMode.value === 'dark' ? '#020617' : '#ffffff'))

useHead({
  titleTemplate: (title) => (title ? `Job Hunt - ${title}` : 'Job Hunt'),
  meta: [{ name: 'theme-color', content: themeColor }]
})
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtPwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
