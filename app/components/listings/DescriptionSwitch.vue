<script setup lang="ts">
import { languageLabel } from '~/constants/listing'
import type { Language } from '~/constants/listing'

// English / ad-language switch for a listing summary. Pages render it only when the listing has
// an original-language summary (`useDescriptionView().hasOriginal`). The choice is a reading aid, so it
// isn't persisted.
const view = defineModel<'en' | 'original'>({ required: true })
const { postingLanguage } = defineProps<{ postingLanguage: Language | null }>()

const items = computed(() => [
  { label: 'English', value: 'en' },
  // The API clears the original when the ad has no language; this only guards stale data.
  { label: postingLanguage ? languageLabel(postingLanguage) : 'Original', value: 'original' }
])
</script>

<template>
  <UTabs
    v-model="view"
    :items="items"
    :content="false"
    size="sm"
    aria-label="Summary language"
    data-testid="listing-description-language"
  />
</template>
