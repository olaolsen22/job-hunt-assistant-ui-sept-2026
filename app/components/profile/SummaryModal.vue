<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const summary = ref('')

watch(open, (isOpen) => {
  if (isOpen) summary.value = profile.summary ?? ''
})

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
    <AppMarkdownEditor v-model="summary" label="Summary" data-testid="summary-text" />
  </AppFormModal>
</template>
