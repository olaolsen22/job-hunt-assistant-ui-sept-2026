<script setup lang="ts">
import type { SuggestionDiff } from '~/utils/tailoredCvDiff'

// One AI suggestion for a section, compared with the current text. Accept/Dismiss only touch the
// editor. `removal` is an entry the AI reply left out: Accept removes it, Dismiss keeps it.
// `review` (the tailored CV page): a `diff` replaces the text compare and the actions read Keep
// current / Accept. Without it (CV templates) it is the plain compare with Dismiss.
const {
  review = false,
  label = undefined,
  diff = undefined
} = defineProps<{
  label?: string
  current: string
  suggested: string
  removal?: boolean
  review?: boolean
  diff?: SuggestionDiff | null
}>()
const emit = defineEmits<{ accept: []; dismiss: [] }>()

const dismissLabel = (removal?: boolean) =>
  removal ? (review ? 'Keep in CV' : 'Keep') : review ? 'Keep current' : 'Dismiss'
</script>

<template>
  <!-- The scroll margin keeps the actions clear of the sticky review bar when stepped to. -->
  <div
    class="@container scroll-mb-40 space-y-3 rounded-md border border-default bg-elevated p-3"
    data-testid="tailored-cv-suggestion"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge color="primary" variant="subtle" icon="i-lucide-sparkles">{{
        review ? 'AI change' : 'Suggested by AI'
      }}</UBadge>
      <span v-if="removal" class="text-sm font-medium text-highlighted">{{
        review ? 'The AI suggests leaving this out' : 'Not in the AI draft'
      }}</span>
      <span v-else-if="label" class="text-sm font-medium text-highlighted">{{ label }}</span>
    </div>
    <template v-if="!(removal && review)">
      <ListingsTailoredCvDiff v-if="review && diff" :diff="diff" />
      <AppCompareBlock
        v-else
        contained
        :current="current"
        :suggested="removal ? 'Leave it out of this CV' : suggested"
      />
    </template>
    <div class="flex gap-2 sm:justify-end">
      <UButton
        color="neutral"
        :variant="review ? 'outline' : 'subtle'"
        class="flex-1 justify-center sm:flex-none"
        data-testid="tailored-cv-dismiss"
        @click="emit('dismiss')"
        >{{ dismissLabel(removal) }}</UButton
      >
      <UButton
        class="flex-1 justify-center sm:flex-none"
        data-testid="tailored-cv-accept"
        @click="emit('accept')"
        >{{ removal ? 'Remove' : 'Accept' }}</UButton
      >
    </div>
  </div>
</template>
