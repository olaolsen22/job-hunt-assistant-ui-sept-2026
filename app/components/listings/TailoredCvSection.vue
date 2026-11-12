<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TailoredCvSectionKey } from '~/utils/tailoredCv'

// A card of the tailored CV editor: its own AI action and error, so one failed AI call
// stays in its section, and its pending suggestions above the content. `editable` adds an Edit
// button for the page's modal; `addItems` adds an Add menu for bringing removed profile items back.
defineProps<{
  title: string
  testid: string
  error?: string
  errorDetail?: string
  editable?: boolean
  analyzable?: boolean
  analyzing?: boolean
  disabled?: boolean
  emptyMessage?: string
  suggestions?: {
    key: TailoredCvSectionKey
    current: string
    suggested: string
    // An entry the AI reply left out: Accept removes it.
    removal?: boolean
  }[]
  // Names what a suggestion replaces when the card holds more than one thing.
  suggestionLabel?: string
  addItems?: DropdownMenuItem[]
  addLabel?: string
  // Text still in another language (a translated CV template), as a warning badge.
  warning?: string
}>()
const emit = defineEmits<{
  edit: []
  analyze: []
  accept: [key: TailoredCvSectionKey]
  dismiss: [key: TailoredCvSectionKey]
}>()
</script>

<template>
  <AppCard :title="title" :data-flagged="warning ? '' : undefined" :data-testid="testid">
    <template v-if="editable || analyzable || addItems" #actions>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UButton
          v-if="editable"
          icon="i-lucide-pencil"
          color="neutral"
          variant="subtle"
          size="sm"
          :disabled="analyzing"
          :aria-label="`Edit ${title.toLowerCase()}`"
          :data-testid="`${testid}-edit`"
          @click="emit('edit')"
          >Edit</UButton
        >
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
      <UBadge
        v-if="warning"
        color="warning"
        variant="subtle"
        icon="i-lucide-languages"
        :data-testid="`${testid}-warning`"
        >{{ warning }}</UBadge
      >
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
        :removal="s.removal"
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
