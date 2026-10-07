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
    <!-- Same widths as the row controls below, so the headers line up from sm up. -->
    <div v-else class="hidden gap-3 text-xs text-muted sm:flex" aria-hidden="true">
      <span class="flex-1">Language</span>
      <span class="w-28">Level</span>
      <span class="w-24">Required</span>
      <span class="w-9" />
    </div>
    <!-- Phones: language and remove on the first line, level and Required on the second. -->
    <div
      v-for="(lang, i) in languages"
      :key="i"
      class="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:gap-3"
      data-testid="language-row"
    >
      <USelect
        v-model="lang.language"
        :items="[...LANGUAGE_OPTIONS]"
        aria-label="Language"
        class="min-w-32 sm:flex-1"
      />
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :aria-label="`Remove ${LANGUAGE_OPTIONS.find((o) => o.value === lang.language)?.label ?? 'language'}`"
        class="sm:order-last"
        @click="languages.splice(i, 1)"
      />
      <div class="col-span-2 flex flex-wrap items-center gap-2 sm:contents">
        <USelectMenu
          v-model="lang.level"
          :items="[...CEFR_LEVELS]"
          :search-input="false"
          clear
          placeholder="Any level"
          aria-label="Level"
          class="w-28 sm:shrink-0"
        />
        <div class="sm:w-24 sm:shrink-0">
          <USwitch v-model="lang.isRequired" label="Required" />
        </div>
      </div>
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
