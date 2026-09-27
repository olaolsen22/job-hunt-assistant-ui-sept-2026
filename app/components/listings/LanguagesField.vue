<script setup lang="ts">
import { CEFR_LEVELS, LANGUAGE_OPTIONS } from '~/constants/listing'
import type { ListingLanguage } from '~/composables/useListingForm'

const languages = defineModel<ListingLanguage[]>({ required: true })

const unusedLanguage = computed(
  () => LANGUAGE_OPTIONS.find((o) => !languages.value.some((l) => l.language === o.value))?.value
)

const addLanguage = () => {
  if (unusedLanguage.value) {
    languages.value.push({ language: unusedLanguage.value, isRequired: true })
  }
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="!languages.length" class="text-sm text-muted">No languages required.</p>
    <div
      v-for="(lang, i) in languages"
      :key="i"
      class="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4"
      data-testid="language-row"
    >
      <USelect v-model="lang.language" :items="[...LANGUAGE_OPTIONS]" class="min-w-32 flex-1" />
      <USelect v-model="lang.level" :items="[...CEFR_LEVELS]" placeholder="Level" class="w-24" />
      <USwitch v-model="lang.isRequired" label="Required" />
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" @click="languages.splice(i, 1)" />
    </div>
    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      :disabled="!unusedLanguage"
      class="w-full justify-center sm:w-auto"
      @click="addLanguage"
    >
      Add language
    </UButton>
  </div>
</template>
