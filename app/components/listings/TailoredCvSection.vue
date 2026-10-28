<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TailoredCvSectionKey } from '~/utils/tailoredCv'

// A card of the tailored CV editor: its own AI action and error, so one failed AI call
// stays in its section, and its pending suggestions above the editable content. `addItems` adds
// an Add menu for bringing removed profile items back.
defineProps<{
  title: string
  testid: string
  error?: string
  errorDetail?: string
  analyzable?: boolean
  analyzing?: boolean
  disabled?: boolean
  emptyMessage?: string
  suggestions?: { key: TailoredCvSectionKey; current: string; suggested: string }[]
  // Names what a suggestion replaces when the card holds more than one thing.
  suggestionLabel?: string
  addItems?: DropdownMenuItem[]
  addLabel?: string
}>()
const emit = defineEmits<{
  analyze: []
  accept: [key: TailoredCvSectionKey]
  dismiss: [key: TailoredCvSectionKey]
}>()
</script>

<template>
  <AppCard :title="title" :data-testid="testid">
    <template v-if="analyzable || addItems" #actions>
      <div class="flex items-center gap-2">
        <UDropdownMenu v-if="addItems" :items="addItems" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            size="sm"
            :aria-label="addLabel"
            :data-testid="`${testid}-add`"
            >Add</UButton
          >
        </UDropdownMenu>
        <UButton
          v-if="analyzable"
          icon="i-lucide-sparkles"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="analyzing"
          :disabled="disabled"
          :aria-label="`Tailor with AI: ${title}`"
          :data-testid="`${testid}-analyze`"
          @click="emit('analyze')"
          >Tailor with AI</UButton
        >
      </div>
    </template>

    <div class="space-y-4">
      <AppAiErrorAlert
        v-if="error"
        :title="error"
        :detail="errorDetail"
        :data-testid="`${testid}-error`"
      >
        <template v-if="analyzable" #default>
          <UButton color="neutral" variant="outline" :disabled="disabled" @click="emit('analyze')"
            >Retry</UButton
          >
        </template>
      </AppAiErrorAlert>
      <ListingsTailoredCvSuggestion
        v-for="s in suggestions"
        :key="s.key"
        :label="suggestionLabel"
        :current="s.current"
        :suggested="s.suggested"
        @accept="emit('accept', s.key)"
        @dismiss="emit('dismiss', s.key)"
      />
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
