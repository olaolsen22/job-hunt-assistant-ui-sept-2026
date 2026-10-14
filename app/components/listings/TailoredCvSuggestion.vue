<script setup lang="ts">
// One AI suggestion for a section, compared with the current text. Accept/Dismiss only touch the
// editor.
defineProps<{ label?: string; current: string; suggested: string }>()
const emit = defineEmits<{ accept: []; dismiss: [] }>()
</script>

<template>
  <div
    class="space-y-3 rounded-md border border-default bg-elevated p-3"
    data-testid="tailored-cv-suggestion"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge color="primary" variant="subtle" icon="i-lucide-sparkles">Suggested by AI</UBadge>
      <span v-if="label" class="text-sm font-medium text-highlighted">{{ label }}</span>
    </div>
    <AppCompareBlock :current="current" :suggested="suggested" />
    <div class="flex gap-2 sm:justify-end">
      <UButton
        color="neutral"
        variant="subtle"
        class="flex-1 justify-center sm:flex-none"
        data-testid="tailored-cv-dismiss"
        @click="emit('dismiss')"
        >Dismiss</UButton
      >
      <UButton
        class="flex-1 justify-center sm:flex-none"
        data-testid="tailored-cv-accept"
        @click="emit('accept')"
        >Accept</UButton
      >
    </div>
  </div>
</template>
