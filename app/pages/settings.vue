<script setup lang="ts">
definePageMeta({ title: 'Settings' })

// Provider keys and their limits are the owner's; a guest only picks among the app's models.
const auth = useAuthStore()
const isOwner = computed(() => auth.user?.role === 'Owner')
</script>

<template>
  <div class="flex justify-center">
    <!-- One card per setting group. -->
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6">
      <SettingsAiModelSection />
      <template v-if="isOwner">
        <SettingsProviderKeysSection />
        <SettingsDailyLimitsSection />
      </template>
    </div>
  </div>
</template>
