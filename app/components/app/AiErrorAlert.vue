<script setup lang="ts">
// One look for every AI failure: the message, its technical reason (small, when known), and the
// Settings link when the daily limit stopped it. The default slot adds a feature's own action;
// #description replaces the detail line.
const { code = undefined, detail = undefined } = defineProps<{
  title: string
  code?: string
  detail?: string
}>()
const slots = defineSlots<{ default?: () => unknown; description?: () => unknown }>()
</script>

<template>
  <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="title">
    <template v-if="detail || slots.description" #description>
      <slot name="description">
        <!-- Muted red: the reason behind a generic message, secondary to the title. -->
        <p class="text-xs break-words text-error/75" data-testid="ai-error-detail">{{ detail }}</p>
      </slot>
    </template>
    <template v-if="code === 'daily-limit-reached' || slots.default" #actions>
      <AppAiLimitLink v-if="code === 'daily-limit-reached'" />
      <slot v-else />
    </template>
  </UAlert>
</template>
