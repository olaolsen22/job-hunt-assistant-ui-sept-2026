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

const refineOpen = ref(false)
const refineOpened = useOpenedOnce(refineOpen)
const { profile } = useProfile()
</script>

<template>
  <li class="py-3 first:pt-0 last:pb-0" data-testid="profile-entry">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="break-words font-medium text-highlighted">{{ title }}</p>
        <p v-if="subtitle" class="break-words text-sm">{{ subtitle }}</p>
        <!-- The title's translation sits right under the original it translates. -->
        <slot name="translation" />
        <p v-if="dates" class="text-sm text-muted">{{ dates }}</p>
        <slot />
      </div>
      <ProfileRowActions
        :name="title"
        :refine="!!bullets.length"
        testid="profile-entry-actions"
        @edit="emit('edit')"
        @remove="emit('delete')"
        @refine="refineOpen = true"
      />
    </div>
    <ProfileBullets
      :kind="kind"
      :entry-id="entryId"
      :bullets="bullets"
      @changed="emit('changed')"
    />
    <LazyProfileBulletRefinementModal
      v-if="refineOpened && profile"
      v-model:open="refineOpen"
      :profile="profile"
      :scope="{ kind, entryId }"
      :scope-name="title"
      @changed="emit('changed')"
    />
  </li>
</template>
