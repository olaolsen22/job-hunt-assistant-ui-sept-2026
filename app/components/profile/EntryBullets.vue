<script setup lang="ts">
import type { ProfileBullet } from '~/composables/useProfile'

// The bullets block of an entry form. A bullet needs a saved entry to belong to, so a new entry
// gets a note instead.
defineProps<{
  kind: 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'PROJECT'
  entry: { id: number; bullets: readonly ProfileBullet[] } | null
}>()
const emit = defineEmits<{ changed: [] }>()
</script>

<template>
  <div>
    <ProfileBullets
      v-if="entry"
      editable
      :kind="kind"
      :entry-id="entry.id"
      :bullets="entry.bullets"
      @changed="emit('changed')"
    />
    <p v-else class="text-sm text-muted" data-testid="profile-bullets-after-save">
      You can add bullets after saving.
    </p>
  </div>
</template>
