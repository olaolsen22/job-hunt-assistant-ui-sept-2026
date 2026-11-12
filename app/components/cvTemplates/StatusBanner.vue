<script setup lang="ts">
// The template editor's one status message, the first that applies: content the API rejected, AI
// suggestions to review, an AI draft loaded as is, then a translated language still being checked.
const props = defineProps<{
  invalid?: string
  // Pending AI suggestions, and whether one covers a whole list (entries added or reordered).
  suggestions: number
  wholeList: boolean
  aiDrafted: boolean
  // A translated language not saved yet: its source language and what's still untranslated.
  translation?: { from: string; flagged: number }
}>()
const emit = defineEmits<{
  replaceWithProfile: []
  nextSuggestion: []
  acceptAll: []
  dismissAll: []
  discardAi: []
  nextFlagged: []
  discardTranslation: []
}>()

const dismissOpen = ref(false)
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const flaggedLabel = computed(() =>
  props.translation
    ? `${plural(props.translation.flagged, 'part is', 'parts are')} still in ${props.translation.from}`
    : ''
)
</script>

<template>
  <UAlert
    v-if="invalid"
    color="error"
    variant="subtle"
    title="Something in this CV is no longer in your profile"
    :description="`${invalid} Replace it with your profile, then save.`"
    :actions="[
      {
        label: 'Replace with my profile',
        color: 'neutral',
        variant: 'outline',
        onClick: () => emit('replaceWithProfile')
      }
    ]"
    data-testid="cv-template-invalid"
  />

  <UAlert
    v-else-if="suggestions"
    color="primary"
    variant="subtle"
    icon="i-lucide-sparkles"
    :title="`${plural(suggestions, 'suggestion', 'suggestions')} to review`"
    :description="
      wholeList
        ? 'The AI added or reordered entries, so that list is reviewed as one block. The rest is per entry.'
        : 'Accept or dismiss each one on its card. What you don’t accept isn’t saved.'
    "
    :actions="[
      {
        label: 'Next',
        color: 'neutral',
        variant: 'outline',
        onClick: () => emit('nextSuggestion')
      },
      {
        label: 'Accept all',
        color: 'neutral',
        variant: 'subtle',
        onClick: () => emit('acceptAll')
      },
      {
        label: 'Dismiss all',
        color: 'neutral',
        variant: 'ghost',
        onClick: () => (dismissOpen = true)
      }
    ]"
    data-testid="cv-template-suggestions"
  />

  <UAlert
    v-else-if="aiDrafted"
    color="warning"
    variant="subtle"
    icon="i-lucide-sparkles"
    title="AI draft loaded. Check your bullets before saving."
    description="A bullet whose wording doesn’t match your profile goes back to your original text without notice. Combined bullets are the most likely to change. Nothing is saved until you save."
    :actions="[
      { label: 'Discard', color: 'neutral', variant: 'ghost', onClick: () => emit('discardAi') }
    ]"
    data-testid="cv-template-ai-draft"
  />

  <UAlert
    v-else-if="translation"
    :color="translation.flagged ? 'info' : 'success'"
    variant="subtle"
    icon="i-lucide-languages"
    :title="`Translated from ${translation.from}. Not saved yet.`"
    :description="
      translation.flagged
        ? `${flaggedLabel}: edit each flagged card. Names and tech terms can stay as they are.`
        : 'Every flagged part has been edited. Save it as v1.'
    "
    :actions="[
      ...(translation.flagged
        ? [
            {
              label: 'Next untranslated',
              color: 'neutral' as const,
              variant: 'outline' as const,
              onClick: () => emit('nextFlagged')
            }
          ]
        : []),
      {
        label: 'Discard',
        color: 'neutral' as const,
        variant: 'ghost' as const,
        onClick: () => emit('discardTranslation')
      }
    ]"
    data-testid="cv-template-draft"
  />

  <AppConfirmModal
    v-model:open="dismissOpen"
    title="Dismiss every suggestion?"
    description="The AI’s remaining suggestions are dropped. Your content stays as it is."
    confirm-label="Dismiss all"
    @confirm="
      () => {
        dismissOpen = false
        emit('dismissAll')
      }
    "
  />
</template>
