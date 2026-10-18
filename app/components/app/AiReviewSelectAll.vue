<script setup lang="ts">
// "N of M selected" with Select all / none, above a review list whose rows have an include tick.
defineProps<{ selected: number; total: number; disabled?: boolean }>()
const emit = defineEmits<{ all: []; none: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
    <span data-testid="review-selected">{{ selected }} of {{ total }} selected</span>
    <UButton
      size="xs"
      color="neutral"
      variant="link"
      :disabled="disabled || selected === total"
      data-testid="review-select-all"
      @click="emit('all')"
      >Select all</UButton
    >
    <UButton
      size="xs"
      color="neutral"
      variant="link"
      :disabled="disabled || !selected"
      data-testid="review-select-none"
      @click="emit('none')"
      >Select none</UButton
    >
  </div>
</template>
