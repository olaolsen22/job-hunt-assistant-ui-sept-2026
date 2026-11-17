<script setup lang="ts">
import type { BulletDiffRow, ChipDiffRow, SuggestionDiff } from '~/utils/tailoredCvDiff'

// One AI suggestion as a diff: each bullet, skill or technology marked with a text badge (never
// colour alone), the old wording struck through. Paragraphs and other details use the plain compare.
const { diff } = defineProps<{ diff: SuggestionDiff }>()
const entry = computed(() => (diff.kind === 'entry' ? diff : undefined))
const chips = computed(() => (diff.kind === 'skills' ? diff.chips : diff.technologies))
// Order, grouping or whitespace changes leave every row unmarked, so say what changed instead.
const unmarked = computed(
  () =>
    !entry.value?.details &&
    !entry.value?.paragraph &&
    !entry.value?.bullets?.some((r) => r.kind !== 'kept') &&
    !chips.value?.some((c) => c.kind !== 'kept')
)

const BULLET_BADGES: Record<BulletDiffRow['kind'], string | undefined> = {
  kept: undefined,
  reworded: 'Reworded',
  new: 'New',
  removed: 'Removed'
}
const CHIP_BADGES: Record<ChipDiffRow['kind'], string | undefined> = {
  kept: undefined,
  added: 'Added',
  removed: 'Removed'
}
</script>

<template>
  <div class="space-y-3 text-sm" data-testid="tailored-cv-diff">
    <p v-if="unmarked" class="text-muted" data-testid="tailored-cv-diff-unmarked">
      {{
        diff.kind === 'skills'
          ? 'Only the order, categories or groups changed.'
          : 'Only the order of the bullets changed.'
      }}
    </p>
    <AppCompareBlock
      v-if="entry?.details"
      contained
      :current="entry.details.current"
      :suggested="entry.details.suggested"
    />

    <ul v-if="entry?.bullets" class="space-y-2">
      <li
        v-for="(row, i) in entry.bullets"
        :key="i"
        class="flex items-start gap-2"
        :data-kind="row.kind"
        data-testid="tailored-cv-diff-bullet"
      >
        <span
          class="mt-2 size-1.5 shrink-0 rounded-full bg-current text-muted"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1 space-y-0.5 break-words">
          <p v-if="row.kind === 'reworded'" class="text-muted line-through">{{ row.old }}</p>
          <p :class="row.kind === 'removed' ? 'text-muted line-through' : ''">
            {{ row.text }}
            <UBadge
              v-if="BULLET_BADGES[row.kind]"
              :color="row.kind === 'removed' ? 'neutral' : 'primary'"
              variant="subtle"
              size="sm"
              class="ml-1 align-middle no-underline"
              >{{ BULLET_BADGES[row.kind] }}</UBadge
            >
          </p>
        </div>
      </li>
      <li v-if="!entry.bullets.length" class="text-muted">No bullets.</li>
    </ul>

    <AppCompareBlock
      v-if="entry?.paragraph"
      contained
      :current="entry.paragraph.current"
      :suggested="entry.paragraph.suggested"
    />

    <div v-if="chips" class="space-y-1">
      <p v-if="entry" class="text-xs text-muted">Technologies</p>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="chip in chips"
          :key="`${chip.kind}-${chip.name}`"
          :data-kind="chip.kind"
          data-testid="tailored-cv-diff-chip"
        >
          <UBadge
            :color="chip.kind === 'added' ? 'primary' : 'neutral'"
            :variant="chip.kind === 'kept' ? 'outline' : 'subtle'"
          >
            <span :class="chip.kind === 'removed' ? 'text-dimmed line-through' : ''">{{
              chip.name
            }}</span>
            <span v-if="CHIP_BADGES[chip.kind]" class="text-xs text-muted"
              >· {{ CHIP_BADGES[chip.kind] }}</span
            >
          </UBadge>
        </li>
      </ul>
    </div>
  </div>
</template>
