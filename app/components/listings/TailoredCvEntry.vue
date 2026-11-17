<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useMediaQuery } from '@vueuse/core'
import type { TailoredCvBullet, TailoredCvSectionKey } from '~/utils/tailoredCv'
import type { CvSuggestionView } from '~/utils/tailoredCvDiff'

// One experience/education/certification/project of the tailored CV, read only: Edit asks the page
// to open the entry's modal. `analyzable` adds a Tailor button beside Edit (both in the menu on
// phones); that call's error and suggestion show under the header, like a section's.
const props = defineProps<{
  contentStyle: 'BULLETS' | 'PARAGRAPH'
  title: string
  subtitle?: string | null
  dates?: string
  location?: string | null
  // Project type, shown as a badge by the title.
  badge?: string
  // Text still in another language (a translated CV template), as a warning badge.
  warning?: string
  technologies?: string[] | null
  analyzable?: boolean
  analyzing?: boolean
  disabled?: boolean
  error?: string
  errorDetail?: string
  suggestions?: CvSuggestionView[]
  bullets: TailoredCvBullet[]
  paragraph?: string | null
}>()
const emit = defineEmits<{
  edit: []
  remove: []
  analyze: []
  accept: [key: TailoredCvSectionKey]
  dismiss: [key: TailoredCvSectionKey]
}>()

// Remove sits in the menu, so the trash can isn't one mis-tap away from Edit. On phones an
// analyzable entry's Edit and Tailor join it, keeping the header row to one button.
const wide = useMediaQuery('(min-width: 640px)')
const inMenu = computed(() => !!props.analyzable && !wide.value)
const items = computed<DropdownMenuItem[]>(() => [
  ...(inMenu.value
    ? [
        {
          label: 'Edit',
          icon: 'i-lucide-pencil',
          disabled: props.analyzing,
          onSelect: () => emit('edit')
        },
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
// A suggestion that replaces the content stands in for the bullets; one that removes the entry dims it.
const replaced = computed(() => props.suggestions?.some((s) => s.replaces && !s.removal))
const leavingOut = computed(() => props.suggestions?.some((s) => s.review && s.removal))
</script>

<template>
  <!-- data-flagged: the page's "Next untranslated" scrolls to these in page order. -->
  <li
    class="py-3 first:pt-0 last:pb-0"
    :data-flagged="warning ? '' : undefined"
    data-testid="tailored-cv-entry"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1" :class="{ 'opacity-50': leavingOut }">
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
          <UBadge
            v-if="warning"
            color="warning"
            variant="subtle"
            size="sm"
            icon="i-lucide-languages"
            class="ml-1 align-middle"
            data-testid="tailored-cv-entry-warning"
            >{{ warning }}</UBadge
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
      <template v-if="!inMenu">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="analyzing"
          :aria-label="`Edit ${title}`"
          class="shrink-0"
          data-testid="tailored-cv-entry-edit"
          @click="emit('edit')"
          >Edit</UButton
        >
        <UButton
          v-if="analyzable"
          icon="i-lucide-sparkles"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="analyzing"
          :disabled="disabled"
          :aria-label="`Tailor with AI: ${title}`"
          class="shrink-0"
          data-testid="tailored-cv-entry-analyze"
          @click="emit('analyze')"
          >Tailor</UButton
        >
      </template>
      <UDropdownMenu :items="items" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="analyzing && inMenu"
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
        :removal="s.removal"
        :review="s.review"
        :diff="s.diff"
        @accept="emit('accept', s.key)"
        @dismiss="emit('dismiss', s.key)"
      />
    </div>

    <div v-if="!replaced" :class="{ 'opacity-50': leavingOut }">
      <template v-if="contentStyle === 'PARAGRAPH'">
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
    </div>
  </li>
</template>
