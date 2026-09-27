<script setup lang="ts">
defineProps<{ label: string }>()
const model = defineModel<string>({ required: true })

// The API rejects longer notes.
const MAX_LENGTH = 10_000
</script>

<template>
  <UFormField :label="label" :hint="`${model.length} / ${MAX_LENGTH}`" help="Markdown supported">
    <UTextarea v-model="model" :maxlength="MAX_LENGTH" :rows="4" autoresize class="w-full" />
  </UFormField>
</template>
