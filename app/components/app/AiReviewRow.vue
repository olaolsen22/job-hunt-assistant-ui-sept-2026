<script setup lang="ts">
// One reviewed AI suggestion, the same in every in-modal review: an optional include tick or a
// change badge, an optional remove button, and the current value next to the suggested one.
// `#suggested` swaps the plain suggested text for editable fields; Remove is for changes that
// aren't just left out (a tick covers those).
const {
  label = undefined,
  badge = undefined,
  invalid = false,
  note = undefined,
  description = undefined,
  current = null,
  suggested = null,
  removeLabel = undefined,
  disabled = false,
  currentLabel = undefined,
  suggestedLabel = undefined,
  testidPrefix
} = defineProps<{
  label?: string
  badge?: string
  invalid?: boolean
  note?: string
  description?: string
  current?: string | null
  suggested?: string | null
  removeLabel?: string
  disabled?: boolean
  currentLabel?: string
  suggestedLabel?: string
  testidPrefix: string
}>()
// default: undefined, or Vue turns a missing Boolean prop into false and every row shows a tick.
const include = defineModel<boolean | undefined>('include', { default: undefined })
const emit = defineEmits<{ remove: [] }>()
defineSlots<{ suggested?: () => unknown }>()
</script>

<template>
  <li
    class="space-y-3 rounded-md border border-default p-3"
    :class="{ 'border-error': invalid }"
    :data-testid="`${testidPrefix}-row`"
  >
    <div class="flex items-center gap-2">
      <UCheckbox
        v-if="include !== undefined"
        v-model="include"
        :label="label"
        :description="description"
        :disabled="disabled"
        class="min-w-0 flex-1"
        :data-testid="`${testidPrefix}-include`"
      />
      <!-- A labelled row without a tick (saved, nothing to apply) keeps its label where the
           ticked rows have theirs, so a numbered list still lines up; the badge follows it. -->
      <p v-else-if="label" class="min-w-0 flex-1 ps-6 text-sm">
        {{ label }}
        <UBadge
          :color="invalid ? 'error' : 'neutral'"
          :variant="invalid ? 'subtle' : 'outline'"
          class="ms-1 align-middle"
          >{{ badge }}</UBadge
        >
      </p>
      <template v-else>
        <UBadge :color="invalid ? 'error' : 'neutral'" :variant="invalid ? 'subtle' : 'outline'">{{
          badge
        }}</UBadge>
        <span class="min-w-0 flex-1 text-sm text-muted">{{ note }}</span>
      </template>
      <UButton
        v-if="removeLabel"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        :aria-label="removeLabel"
        :data-testid="`${testidPrefix}-remove`"
        @click="emit('remove')"
      />
    </div>
    <AppCompareBlock
      :current="current"
      :suggested="suggested"
      :current-label="currentLabel"
      :suggested-label="suggestedLabel"
    >
      <template v-if="$slots.suggested" #suggested><slot name="suggested" /></template>
    </AppCompareBlock>
  </li>
</template>
