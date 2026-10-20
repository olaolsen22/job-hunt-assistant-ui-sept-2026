<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const summary = ref('')
const aiOpen = ref(false)
// Set when the text came from the AI, so the owner knows it still needs saving.
const drafted = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  summary.value = profile.summary ?? ''
  drafted.value = false
})

const useSuggestion = (text: string) => {
  summary.value = text
  drafted.value = true
}

const { save, loading } = useProfileUpdate(() => emit('changed'))

const submit = async () => {
  const saved = await save(profile, { summary: summary.value.trim() || null })
  if (!saved) return
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="profile.summary ? 'Edit summary' : 'Add summary'"
    :state="{ summary }"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-2">
      <UButton
        icon="i-lucide-sparkles"
        color="neutral"
        variant="soft"
        :disabled="loading"
        data-testid="summary-generate"
        @click="aiOpen = true"
        >Generate with AI</UButton
      >
      <AppMarkdownEditor v-model="summary" label="Summary" data-testid="summary-text" />
      <p v-if="drafted" class="text-sm text-muted" data-testid="summary-drafted">
        AI draft. Review it, then save.
      </p>
    </div>
  </AppFormModal>
  <ProfileSummaryAiModal v-model:open="aiOpen" :current="summary" @use="useSuggestion" />
</template>
