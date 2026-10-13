<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// The model every built-in AI action runs on. Saves on change: it is the section's only field.
const { models, defaultModel, status, error, label, setDefault, saving } = useLlmModels()
const toast = useToast()

// A sentinel stands for "no model" because USelect values can't be null; it maps back to null on save.
const APP_DEFAULT = 'app-default'
const items = computed(() => [
  { label: 'Use app default', value: APP_DEFAULT },
  // A model on the owner's own key bills their provider account, not the app's.
  ...models.value.map((m) => ({
    label: m.keySource === 'USER' ? `${m.label} · your key` : m.label,
    value: m.id
  }))
])

// Follows the saved default: the first load, a save, and the refresh after an unknown model.
const choice = ref<string>()
watch(defaultModel, (id) => (choice.value = id), { immediate: true })

const save = async (value: string) => {
  const ok = await setDefault(value === APP_DEFAULT ? null : value)
  // A failed save already toasted its error; put the select back on what is actually saved.
  if (!ok) return void (choice.value = defaultModel.value)
  choice.value = defaultModel.value
  toast.add({
    title: value === APP_DEFAULT ? 'Using the app default model' : `Now using ${label(value)}`,
    color: 'success'
  })
}
</script>

<template>
  <AppCard title="AI model" data-testid="settings-ai-model">
    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />
    <USkeleton v-else-if="status === 'idle' || status === 'pending'" class="h-9 w-full sm:w-72" />
    <UFormField
      v-else
      label="Model"
      help="Used for every built-in AI action: analyzing ads, importing a CV and tailoring a CV."
    >
      <USelect
        :model-value="choice"
        :items="items"
        :disabled="saving || models.length < 2"
        class="w-full sm:w-72"
        data-testid="settings-llm-model"
        @update:model-value="save"
      />
    </UFormField>
  </AppCard>
</template>
