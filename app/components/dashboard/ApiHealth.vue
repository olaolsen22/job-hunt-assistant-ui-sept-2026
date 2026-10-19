<script setup lang="ts">
// The page owns the check, because an unhealthy API also changes what it shows below the header.
defineProps<{ state: 'checking' | 'healthy' | 'databaseDown' | 'unreachable' }>()
defineEmits<{ recheck: [] }>()

const BADGES = {
  checking: { label: 'Checking API…', color: 'neutral', icon: 'i-lucide-clock' },
  healthy: { label: 'API healthy', color: 'success', icon: 'i-lucide-circle-check' },
  databaseDown: { label: 'Database down', color: 'warning', icon: 'i-lucide-database' },
  unreachable: { label: 'API unreachable', color: 'error', icon: 'i-lucide-unplug' }
} as const
</script>

<template>
  <div class="flex items-center gap-1">
    <UBadge
      :color="BADGES[state].color"
      :icon="BADGES[state].icon"
      variant="subtle"
      data-testid="api-health"
      >{{ BADGES[state].label }}</UBadge
    >
    <UButton
      icon="i-lucide-refresh-cw"
      color="neutral"
      variant="ghost"
      size="sm"
      aria-label="Recheck API status"
      :disabled="state === 'checking'"
      data-testid="api-health-recheck"
      @click="$emit('recheck')"
    />
  </div>
</template>
