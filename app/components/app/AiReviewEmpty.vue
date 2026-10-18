<script setup lang="ts">
// The review has nothing to apply: a centered muted icon above the message, as in every empty list.
defineProps<{ icon: string; text: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 py-8 text-center text-muted">
    <UIcon :name="icon" class="size-8" />
    <p>{{ text }}</p>
  </div>
</template>
