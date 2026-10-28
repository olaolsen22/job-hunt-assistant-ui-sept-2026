<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TailoredCvBullet, TailoredCvSectionKey } from '~/utils/tailoredCv'

// One experience/education/certification/project of the tailored CV. Read view by default, since
// entries can have many bullets; Edit opens its fields (the `fields` slot) and bullets in place.
// Edits go straight into the candidate, so a collapsed entry keeps them for Save draft.
// `analyzable` adds "Tailor with AI" to its menu; that call's error and suggestion show under the
// header, like a section's.
const props = defineProps<{
  contentStyle: 'BULLETS' | 'PARAGRAPH'
  title: string
  subtitle?: string | null
  dates?: string
  location?: string | null
  // Project type, shown as a badge by the title.
  badge?: string
  technologies?: string[] | null
  analyzable?: boolean
  analyzing?: boolean
  disabled?: boolean
  error?: string
  errorDetail?: string
  suggestions?: { key: TailoredCvSectionKey; current: string; suggested: string }[]
}>()
const bullets = defineModel<TailoredCvBullet[]>('bullets', { required: true })
const paragraph = defineModel<string | null>('paragraph')
const emit = defineEmits<{
  remove: []
  analyze: []
  accept: [key: TailoredCvSectionKey]
  dismiss: [key: TailoredCvSectionKey]
}>()
const editing = ref(false)

// AI and Remove share a menu, so the trash can isn't one mis-tap away from Edit.
const items = computed<DropdownMenuItem[]>(() => [
  ...(props.analyzable
    ? [
        {
          label: 'Tailor with AI',
          icon: 'i-lucide-sparkles',
          disabled: props.disabled,
          onSelect: () => emit('analyze')
        }
      ]
    : []),
  {
    label: 'Remove from this CV',
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: () => emit('remove')
  }
])
</script>

<template>
  <li class="py-3 first:pt-0 last:pb-0" data-testid="tailored-cv-entry">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="break-words font-medium text-highlighted">
          {{ title }}
          <UBadge
            v-if="badge"
            color="neutral"
            variant="subtle"
            size="sm"
            class="ml-1 align-middle"
            >{{ badge }}</UBadge
          >
        </p>
        <p v-if="subtitle" class="break-words text-sm">{{ subtitle }}</p>
        <p v-if="dates || location" class="break-words text-sm text-muted">
          {{ [dates, location].filter(Boolean).join(' · ') }}
        </p>
        <p
          v-if="technologies?.length"
          class="break-words text-sm text-muted"
          data-testid="tailored-cv-entry-technologies"
        >
          {{ technologies.join(', ') }}
        </p>
      </div>
      <UButton
        :icon="editing ? 'i-lucide-check' : 'i-lucide-pencil'"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="editing ? `Done editing ${title}` : `Edit ${title}`"
        :aria-expanded="editing"
        data-testid="tailored-cv-entry-edit"
        @click="editing = !editing"
      />
      <UDropdownMenu :items="items" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="analyzing"
          :aria-label="`Actions for ${title}`"
          class="shrink-0"
          data-testid="tailored-cv-entry-actions"
        />
      </UDropdownMenu>
    </div>

    <div v-if="error || suggestions?.length" class="mt-3 space-y-3">
      <AppAiErrorAlert
        v-if="error"
        :title="error"
        :detail="errorDetail"
        data-testid="tailored-cv-entry-error"
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
        :current="s.current"
        :suggested="s.suggested"
        @accept="emit('accept', s.key)"
        @dismiss="emit('dismiss', s.key)"
      />
    </div>

    <div v-if="editing" class="mt-3 space-y-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <slot name="fields" />
      </div>
      <UFormField v-if="contentStyle === 'PARAGRAPH'" label="Paragraph">
        <UTextarea
          :model-value="paragraph ?? ''"
          :rows="4"
          autoresize
          class="w-full"
          placeholder="Summarize the relevant experience, or tailor it with AI."
          data-testid="tailored-cv-entry-paragraph-input"
          @update:model-value="paragraph = $event"
        />
      </UFormField>
      <fieldset v-else class="space-y-2">
        <legend class="mb-2 text-sm font-medium">Bullets</legend>
        <div v-for="(bullet, i) in bullets" :key="i" class="flex items-start gap-2">
          <UTextarea
            v-model="bullet.text"
            :rows="1"
            autoresize
            class="flex-1"
            :aria-label="`Bullet ${i + 1}`"
          />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Remove bullet ${i + 1}`"
            @click="bullets.splice(i, 1)"
          />
        </div>
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="bullets.push({ text: '', sourceBulletId: null })"
          >Add bullet</UButton
        >
      </fieldset>
      <!-- The header's check scrolls away on long entries, so the panel ends with its own. -->
      <UButton
        icon="i-lucide-check"
        color="neutral"
        variant="subtle"
        size="sm"
        data-testid="tailored-cv-entry-done"
        @click="editing = false"
        >Done editing</UButton
      >
    </div>
    <template v-else-if="contentStyle === 'PARAGRAPH'">
      <p
        v-if="paragraph?.trim()"
        class="mt-2 whitespace-pre-wrap break-words text-sm"
        data-testid="tailored-cv-entry-paragraph"
      >
        {{ paragraph }}
      </p>
      <p v-else class="mt-2 text-sm text-muted">No paragraph yet.</p>
    </template>
    <ul v-else-if="bullets.length" class="mt-2 list-disc space-y-1 pl-5 text-sm">
      <li v-for="(bullet, i) in bullets" :key="i" class="break-words">{{ bullet.text }}</li>
    </ul>
  </li>
</template>
