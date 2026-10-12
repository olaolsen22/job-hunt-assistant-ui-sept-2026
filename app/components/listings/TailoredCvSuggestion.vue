<script setup lang="ts">
// One AI suggestion for a section: the current and suggested text side by side from lg, stacked
// (suggestion first, as that's what's being decided) below it. Accept/Dismiss only touch the editor.
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
    <div class="grid gap-3 lg:grid-cols-2">
      <div class="space-y-1 lg:order-2">
        <p class="text-xs text-muted">Suggested</p>
        <p class="whitespace-pre-line break-words text-sm">{{ suggested || 'Nothing' }}</p>
      </div>
      <div class="space-y-1 lg:order-1">
        <p class="text-xs text-muted">Current</p>
        <p class="whitespace-pre-line break-words text-sm text-muted">{{ current || 'Nothing' }}</p>
      </div>
    </div>
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
