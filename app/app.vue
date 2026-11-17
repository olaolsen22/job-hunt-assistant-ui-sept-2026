<script setup lang="ts">
const colorMode = useColorMode()
// Phone status bar matches the navbar (--ui-bg: white, or neutral-950 in dark; see main.css).
// Follows the in-app toggle, which a prefers-color-scheme media pair would not.
const themeColor = computed(() => (colorMode.value === 'dark' ? '#020617' : '#ffffff'))

useHead({
  titleTemplate: formatBrowserTitle,
  meta: [{ name: 'theme-color', content: themeColor }]
})
</script>

<template>
  <!-- Bottom keeps toasts clear of the header and page actions; on phones the toaster is full
       width there. Kind colors, icons and durations come from useAppToast. The bottom offset rises
       above a sticky bottom bar (useToastClearance); Nuxt UI has no offset prop for it. -->
  <UApp
    :toaster="{
      position: 'bottom-right',
      progress: false,
      max: 3,
      ui: { viewport: 'bottom-[calc(1rem+var(--toast-clearance,0px))]' }
    }"
  >
    <NuxtPwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
