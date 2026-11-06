<script setup lang="ts">
import type { TailoredCv } from '~/utils/tailoredCv'
import { SECTION_ORDER_HINTS, SECTION_ORDER_OPTIONS } from '~/constants/cv'

const cv = defineModel<TailoredCv>('cv', { required: true })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <UFormField label="PDF layout" :description="SECTION_ORDER_HINTS[cv.sectionOrder]">
    <URadioGroup
      v-model="cv.sectionOrder"
      :items="SECTION_ORDER_OPTIONS"
      orientation="horizontal"
      :disabled="disabled"
      data-testid="tailored-cv-section-order"
    />
  </UFormField>
</template>
