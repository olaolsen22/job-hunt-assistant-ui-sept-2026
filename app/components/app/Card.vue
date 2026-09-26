<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <UCard>
    <template v-if="title" #header>
      <h2 class="font-semibold">{{ title }}</h2>
    </template>

    <slot />
  </UCard>
</template>
