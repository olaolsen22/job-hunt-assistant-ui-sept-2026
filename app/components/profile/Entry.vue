<script setup lang="ts">
import type { ProfileBullet } from '~/composables/useProfile'

// One entry of experience / education / certifications / projects: the row, its actions menu and
// its bullets (edited in the entry's form; translated here).
defineProps<{
  kind: 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'PROJECT'
  entryId: number
  title: string
  subtitle?: string | null
  dates?: string
  bullets: readonly ProfileBullet[]
}>()
const emit = defineEmits<{ edit: []; delete: []; changed: [] }>()
</script>

<template>
  <li class="py-3 first:pt-0 last:pb-0" data-testid="profile-entry">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="break-words font-medium text-highlighted">{{ title }}</p>
        <p v-if="subtitle" class="break-words text-sm">{{ subtitle }}</p>
        <p v-if="dates" class="text-sm text-muted">{{ dates }}</p>
        <slot />
      </div>
      <ProfileRowActions
        :name="title"
        testid="profile-entry-actions"
        @edit="emit('edit')"
        @remove="emit('delete')"
      />
    </div>
    <ProfileBullets
      :kind="kind"
      :entry-id="entryId"
      :bullets="bullets"
      @changed="emit('changed')"
    />
  </li>
</template>
