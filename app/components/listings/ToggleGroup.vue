<script setup lang="ts" generic="T extends string | number">
const { clearable = true } = defineProps<{
  options: readonly { label: string; value: T }[]
  // Optional fields clear when the active option is clicked again; required ones (a level) don't.
  clearable?: boolean
  disabled?: boolean
}>()
const model = defineModel<T>()

const toggle = (value: T) => {
  if (model.value !== value) model.value = value
  else if (clearable) model.value = undefined
}
</script>

<template>
  <UFieldGroup class="w-full">
    <UButton
      v-for="o in options"
      :key="o.value"
      :label="o.label"
      color="neutral"
      class="flex-1 justify-center"
      :variant="model === o.value ? 'solid' : 'outline'"
      :aria-pressed="model === o.value"
      :disabled="disabled"
      @click="toggle(o.value)"
    />
  </UFieldGroup>
</template>
