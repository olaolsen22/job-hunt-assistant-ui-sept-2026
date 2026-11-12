<script setup lang="ts">
// One AI suggestion for a section, compared with the current text. Accept/Dismiss only touch the
// editor. `removal` is an entry the AI reply left out: Accept removes it, Dismiss keeps it.
defineProps<{ label?: string; current: string; suggested: string; removal?: boolean }>()
const emit = defineEmits<{ accept: []; dismiss: [] }>()
</script>

<template>
  <div
    class="space-y-3 rounded-md border border-default bg-elevated p-3"
    data-testid="tailored-cv-suggestion"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge color="primary" variant="subtle" icon="i-lucide-sparkles">Suggested by AI</UBadge>
      <span v-if="removal" class="text-sm font-medium text-highlighted">Not in the AI draft</span>
      <span v-else-if="label" class="text-sm font-medium text-highlighted">{{ label }}</span>
    </div>
    <AppCompareBlock
      :current="current"
      :suggested="removal ? 'Leave it out of this CV' : suggested"
    />
    <div class="flex gap-2 sm:justify-end">
      <UButton
        color="neutral"
        variant="subtle"
        class="flex-1 justify-center sm:flex-none"
        data-testid="tailored-cv-dismiss"
        @click="emit('dismiss')"
        >{{ removal ? 'Keep' : 'Dismiss' }}</UButton
      >
      <UButton
        class="flex-1 justify-center sm:flex-none"
        data-testid="tailored-cv-accept"
        @click="emit('accept')"
        >{{ removal ? 'Remove' : 'Accept' }}</UButton
      >
    </div>
  </div>
</template>
