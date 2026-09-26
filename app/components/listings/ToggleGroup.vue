<script setup lang="ts" generic="T extends string">
defineProps<{ options: readonly { label: string; value: T }[] }>()
const model = defineModel<T>()

// Clicking the active option clears it: the fields using this are optional.
const toggle = (value: T) => (model.value = model.value === value ? undefined : value)
</script>

<template>
  <UFieldGroup class="w-full">
    <UButton
      v-for="o in options"
      :key="o.value"
      :label="o.label"
      color="neutral"
      class="flex-1"
      :variant="model === o.value ? 'solid' : 'outline'"
      @click="toggle(o.value)"
    />
  </UFieldGroup>
</template>
