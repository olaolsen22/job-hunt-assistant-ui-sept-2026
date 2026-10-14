<script setup lang="ts">
// A card of the tailored CV editor: its own AI action and error, so one failed AI call
// stays in its section, and its pending suggestions above the editable content.
defineProps<{
  title: string
  testid: string
  error?: string
  errorDetail?: string
  analyzable?: boolean
  analyzing?: boolean
  disabled?: boolean
  emptyMessage?: string
}>()
const emit = defineEmits<{ analyze: [] }>()
</script>

<template>
  <AppCard :title="title" :data-testid="testid">
    <template v-if="analyzable" #actions>
      <UButton
        icon="i-lucide-sparkles"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="analyzing"
        :disabled="disabled"
        :aria-label="`Optimize ${title.toLowerCase()} with AI`"
        :data-testid="`${testid}-analyze`"
        @click="emit('analyze')"
        ><span class="max-sm:sr-only">AI</span></UButton
      >
    </template>

    <div class="space-y-4">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        :description="errorDetail"
        :ui="{ description: 'text-xs break-words' }"
        :actions="
          analyzable
            ? [
                {
                  label: 'Retry',
                  color: 'neutral',
                  variant: 'outline',
                  onClick: () => emit('analyze')
                }
              ]
            : undefined
        "
        :data-testid="`${testid}-error`"
      />
      <slot name="suggestions" />
      <div
        v-if="emptyMessage"
        class="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted"
        :data-testid="`${testid}-empty`"
      >
        <UIcon name="i-lucide-inbox" class="size-6" />
        {{ emptyMessage }}
      </div>
      <slot />
    </div>
  </AppCard>
</template>
