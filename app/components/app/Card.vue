<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <UCard>
    <template v-if="title || $slots.actions || $slots.header" #header>
      <slot name="header">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ title }}</h2>
          <slot name="actions" />
        </div>
      </slot>
    </template>

    <slot />
  </UCard>
</template>
