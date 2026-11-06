<script setup lang="ts">
import type { TailoredCv } from '~/utils/tailoredCv'

// A template's top card: the way to an AI draft (the slot explains it), then the CV's layout choices.
const cv = defineModel<TailoredCv>('cv', { required: true })
defineProps<{ busy: boolean }>()
defineEmits<{ draft: [] }>()
</script>

<template>
  <AppCard>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-muted"><slot /></p>
      <UButton
        icon="i-lucide-sparkles"
        class="shrink-0 justify-center"
        :disabled="busy"
        data-testid="cv-template-draft-ai"
        @click="$emit('draft')"
        >Draft with AI</UButton
      >
    </div>
    <div class="mt-3 grid gap-3 border-t border-default pt-3 md:grid-cols-2">
      <CvStyleFields v-model:cv="cv" />
      <CvPdfLayoutField v-model:cv="cv" class="md:col-span-2" />
    </div>
  </AppCard>
</template>
