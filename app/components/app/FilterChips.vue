<script setup lang="ts">
// One removable chip per active filter, so a deep link or a forgotten filter stays visible, then
// Clear all (/listings and /companies).
defineProps<{
  chips: readonly { key: string; label: string; clear: () => void }[]
  testidPrefix: string
}>()
const emit = defineEmits<{ clearAll: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" :data-testid="`${testidPrefix}-active`">
    <UButton
      v-for="chip in chips"
      :key="chip.key"
      color="neutral"
      variant="soft"
      size="sm"
      trailing-icon="i-lucide-x"
      :aria-label="`Remove filter ${chip.label}`"
      :data-testid="`${testidPrefix}-chip-${chip.key}`"
      @click="chip.clear"
      >{{ chip.label }}</UButton
    >
    <UButton
      color="neutral"
      variant="link"
      size="sm"
      :data-testid="`${testidPrefix}-filters-clear`"
      @click="emit('clearAll')"
      >Clear all</UButton
    >
  </div>
</template>
