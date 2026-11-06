<script setup lang="ts">
import type { CvContentStyle, TailoredCv } from '~/utils/tailoredCv'
import {
  CONTENT_STYLE_DESCRIPTION,
  CONTENT_STYLE_OPTIONS,
  TEMPLATE_HINTS,
  TEMPLATE_OPTIONS
} from '~/constants/cv'

// CV style and entry format, shared by the tailored CV and CV template editors. Two cells for the
// parent's grid.
const cv = defineModel<TailoredCv>('cv', { required: true })
defineProps<{ disabled?: boolean }>()

const entryStyle = computed(() => cvEntryStyle(cv.value))
</script>

<template>
  <UFormField label="CV style" :description="TEMPLATE_HINTS[cv.template]">
    <URadioGroup
      v-model="cv.template"
      :items="TEMPLATE_OPTIONS"
      orientation="horizontal"
      :disabled="disabled"
      data-testid="tailored-cv-template"
    />
  </UFormField>
  <UFormField label="Entry format" :description="CONTENT_STYLE_DESCRIPTION[cv.template]">
    <URadioGroup
      :model-value="entryStyle"
      :items="CONTENT_STYLE_OPTIONS"
      orientation="horizontal"
      :disabled="disabled || cv.template === 'CONCISE'"
      data-testid="tailored-cv-content-style"
      @update:model-value="setCvContentStyle(cv, $event as CvContentStyle)"
    />
  </UFormField>
</template>
