<script setup lang="ts">
import type { TailoredCvBullet } from '~/utils/tailoredCv'

// One experience/education/certification/project of the tailored CV. Read view by default, since
// entries can have many bullets; Edit opens its fields (the `fields` slot) and bullets in place.
// Edits go straight into the candidate, so a collapsed entry keeps them for Save draft.
// `analyzable` adds a per-entry AI button; its error and suggestion go in the default slot.
defineProps<{
  title: string
  subtitle?: string | null
  dates?: string
  location?: string | null
  analyzable?: boolean
  analyzing?: boolean
  disabled?: boolean
}>()
const bullets = defineModel<TailoredCvBullet[]>('bullets', { required: true })
const contentStyle = defineModel<'BULLETS' | 'PARAGRAPH' | null>('contentStyle')
const paragraph = defineModel<string | null>('paragraph')
const emit = defineEmits<{ remove: []; analyze: [] }>()
const editing = ref(false)

const CONTENT_STYLE_OPTIONS = [
  { label: 'Bullets', value: 'BULLETS' },
  { label: 'Paragraph', value: 'PARAGRAPH' }
]

// Switching to paragraph starts from the bullets joined, so there is something to edit.
const setContentStyle = (value: string) => {
  contentStyle.value = value as 'BULLETS' | 'PARAGRAPH'
  if (value === 'PARAGRAPH' && !paragraph.value?.trim()) {
    paragraph.value = bullets.value.map((b) => b.text).join(' ')
  }
}
</script>

<template>
  <li class="py-3 first:pt-0 last:pb-0" data-testid="tailored-cv-entry">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="break-words font-medium text-highlighted">{{ title }}</p>
        <p v-if="subtitle" class="break-words text-sm">{{ subtitle }}</p>
        <p v-if="dates || location" class="break-words text-sm text-muted">
          {{ [dates, location].filter(Boolean).join(' · ') }}
        </p>
      </div>
      <UButton
        v-if="analyzable"
        icon="i-lucide-sparkles"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="analyzing"
        :disabled="disabled"
        :aria-label="`Optimize ${title} with AI`"
        data-testid="tailored-cv-entry-analyze"
        @click="emit('analyze')"
      />
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
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Remove ${title}`"
        data-testid="tailored-cv-entry-remove"
        @click="emit('remove')"
      />
    </div>

    <!-- empty:hidden drops the gap when the slot renders nothing (its v-if comments don't count). -->
    <div class="mt-3 space-y-3 empty:hidden"><slot /></div>

    <div v-if="editing" class="mt-3 space-y-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <slot name="fields" />
      </div>
      <!-- UTabs without content is a two-option segmented control: one tap, both options visible. -->
      <UTabs
        :model-value="contentStyle ?? 'BULLETS'"
        :items="CONTENT_STYLE_OPTIONS"
        :content="false"
        variant="pill"
        color="neutral"
        class="w-full sm:w-auto"
        aria-label="Content format"
        data-testid="tailored-cv-entry-content-style"
        @update:model-value="setContentStyle($event as string)"
      />
      <UFormField v-if="contentStyle === 'PARAGRAPH'" label="Paragraph">
        <UTextarea
          :model-value="paragraph ?? ''"
          :rows="4"
          autoresize
          class="w-full"
          placeholder="Summarize the relevant experience, or optimize with AI."
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
    </div>
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
  </li>
</template>
