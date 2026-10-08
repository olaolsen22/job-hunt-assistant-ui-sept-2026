<script setup lang="ts">
// 'YYYY-MM-01' or null. Two controls because desktop Firefox/Safari show <input type="month"> as a
// plain text box. Emits a date only when both parts are set, so a half-cleared value can't survive.
const { disabled } = defineProps<{ disabled?: boolean }>()
const model = defineModel<string | null>({ default: null })

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, i, 1)),
  value: i + 1
}))

const toIso = (m?: number, y?: number) => {
  if (!m || !y) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
}

const month = ref<number>()
const year = ref<number>()

watch(
  model,
  (value) => {
    // Our own emit comes back through here; only a different outside value should reset the parts.
    if (value === toIso(month.value, year.value)) return
    month.value = value ? Number(value.slice(5, 7)) : undefined
    year.value = value ? Number(value.slice(0, 4)) : undefined
  },
  { immediate: true }
)

watch([month, year], ([m, y]) => {
  model.value = toIso(m, y)
})
</script>

<template>
  <div class="flex gap-2">
    <USelect
      v-model="month"
      :items="MONTHS"
      :disabled="disabled"
      placeholder="Month"
      aria-label="Month"
      class="flex-1"
    />
    <UInputNumber
      v-model="year"
      :disabled="disabled"
      :min="1900"
      :max="2100"
      :increment="false"
      :decrement="false"
      placeholder="Year"
      aria-label="Year"
      class="w-28"
    />
  </div>
</template>
