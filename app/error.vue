<script setup lang="ts">
import type { NuxtError } from '#app'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// Replaces app.vue while an error is shown. The installed app has no address bar or browser
// Back, so without this page an unknown route or a thrown error would be a dead end.
const props = defineProps<{ error: NuxtError }>()

const route = useRoute()
const notFound = computed(() => props.error.statusCode === 404)

// The service worker can start the app offline; the first API call then fails and lands here.
// onLine false is reliable (true isn't), so only false means offline.
const offline = ref(false)
const view = computed(() => {
  if (offline.value)
    return {
      icon: 'i-lucide-wifi-off',
      heading: "You're offline",
      text: 'Job Hunt needs a connection to load your listings. Check your connection and try again.'
    }
  if (notFound.value)
    return {
      icon: 'i-lucide-map-pin-off',
      heading: 'Page not found',
      text: 'This page does not exist.'
    }
  return {
    icon: 'i-lucide-circle-alert',
    heading: 'Something went wrong',
    text: ERROR_MESSAGES.generic
  }
})

useHead({ title: computed(() => formatBrowserTitle(view.value.heading)) })

const retrying = ref(false)
// Re-runs the route (and its auth check) without location.reload(), which the leave guard
// would interrupt with "Leave site?".
const tryAgain = async () => {
  retrying.value = true
  await clearError({ redirect: route.fullPath })
  retrying.value = false
}
const goHome = () => clearError({ redirect: '/' })

const syncOnline = () => (offline.value = !navigator.onLine)
const onOnline = () => {
  syncOnline()
  tryAgain()
}
onMounted(() => {
  syncOnline()
  window.addEventListener('offline', syncOnline)
  window.addEventListener('online', onOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('offline', syncOnline)
  window.removeEventListener('online', onOnline)
})
</script>

<template>
  <UApp>
    <NuxtLayout name="auth">
      <div class="flex flex-col items-center gap-3 py-12 text-center">
        <UIcon :name="view.icon" class="size-10 text-muted" />
        <h1 class="text-xl font-semibold text-highlighted">{{ view.heading }}</h1>
        <p class="text-sm text-muted">{{ view.text }}</p>
        <div class="flex flex-col items-center gap-2">
          <UButton
            v-if="!notFound || offline"
            icon="i-lucide-rotate-cw"
            :loading="retrying"
            data-testid="error-retry"
            @click="tryAgain"
          >
            Try again
          </UButton>
          <!-- Offline, the dashboard would fail the same way. -->
          <UButton
            v-if="!offline"
            icon="i-lucide-house"
            :color="notFound ? 'primary' : 'neutral'"
            :variant="notFound ? 'solid' : 'ghost'"
            data-testid="error-home"
            @click="goHome"
          >
            Go to dashboard
          </UButton>
        </div>
      </div>
    </NuxtLayout>
  </UApp>
</template>
