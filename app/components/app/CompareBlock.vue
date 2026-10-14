<script setup lang="ts">
// A saved value next to the one replacing it (AI suggestion or CV import), always current first:
// side by side from sm, stacked below. `#suggested` swaps the plain text for an editable field;
// the screen keeps its own controls (include, dismiss, remove) and labels its inputs.
// `compare: false` renders only `#suggested`, for a new item with nothing saved to compare against.
withDefaults(
  defineProps<{
    current?: string | null
    suggested?: string | null
    currentLabel?: string
    suggestedLabel?: string
    compare?: boolean
  }>(),
  {
    current: null,
    suggested: null,
    currentLabel: 'Current',
    suggestedLabel: 'Suggested',
    compare: true
  }
)
</script>

<template>
  <div v-if="compare" class="grid gap-3 sm:grid-cols-2">
    <div class="min-w-0 space-y-1">
      <p class="text-xs text-muted">{{ currentLabel }}</p>
      <p
        class="whitespace-pre-line break-words text-sm text-muted"
        :class="{ italic: !current }"
        data-testid="compare-current"
      >
        {{ current || 'Empty' }}
      </p>
    </div>
    <div class="min-w-0 space-y-1" data-testid="compare-suggested">
      <p class="text-xs text-muted">{{ suggestedLabel }}</p>
      <slot name="suggested">
        <p
          class="whitespace-pre-line break-words text-sm"
          :class="suggested ? 'text-highlighted' : 'italic text-muted'"
        >
          {{ suggested || 'Empty' }}
        </p>
      </slot>
    </div>
  </div>
  <div v-else><slot name="suggested" /></div>
</template>
