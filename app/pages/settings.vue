<script setup lang="ts">
import { until } from '@vueuse/core'

definePageMeta({ title: 'Settings' })

// Keys, limits and usage are the owner's; a guest gets one model from the API and only sees it.
const auth = useAuthStore()
const isOwner = computed(() => auth.user?.role === 'Owner')

// Other pages link to #model, #keys and #usage. The sections load client-side after navigation
// and the layout scrolls its own container, so the router's hash scroll can't land them: scroll
// once the cards above the target have their final height, and again on in-page hash links.
// useNuxtData only reads what the sections fetch; it asks for nothing itself.
const route = useRoute()
const { data: models } = useNuxtData('llm-models')
const { data: keys } = useNuxtData('provider-keys')
const { data: limits } = useNuxtData('llm-call-limits')
const ready = computed(() => !!models.value && (!isOwner.value || (!!keys.value && !!limits.value)))
const scrollToHash = async () => {
  const id = route.hash.slice(1)
  if (!id) return
  await nextTick()
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
}
onMounted(async () => {
  await until(ready).toBe(true, { timeout: 10_000 })
  await scrollToHash()
})
watch(() => route.hash, scrollToHash)
</script>

<template>
  <div class="flex justify-center">
    <!-- One card per setting group; AI ones have ids so other pages link straight to them. -->
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6">
      <SettingsModelSection :owner="isOwner" />
      <template v-if="isOwner">
        <SettingsKeysSection />
        <SettingsUsageSection />
      </template>
      <SettingsRemindersSection />
    </div>
  </div>
</template>
