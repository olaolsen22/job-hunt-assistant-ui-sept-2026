<script setup lang="ts">
// "Avoided company" on listing surfaces, so it doesn't read as a listing state.
// Warning, not error: red already means Rejected.
const { label = 'Avoided' } = defineProps<{ label?: string }>()
</script>

<template>
  <UBadge color="warning" variant="subtle" icon="i-lucide-ban" data-testid="company-avoided">{{
    label
  }}</UBadge>
</template>
