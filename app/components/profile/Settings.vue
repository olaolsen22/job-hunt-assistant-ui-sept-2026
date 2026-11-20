<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'

// The profile's language strip, laid out like the tailored CV's settings card: which version is
// shown (written language or its translation), how far the translation has got, and a panel for
// the written language. `translating` is the page's other-language view.
const {
  contentLanguage,
  target,
  progress,
  staleCount,
  hasTranslations,
  loading = false
} = defineProps<{
  contentLanguage: Language
  target: Language
  progress: { done: number; total: number }
  staleCount: number
  hasTranslations: boolean
  loading?: boolean
}>()
const translating = defineModel<boolean>('translating', { required: true })
const emit = defineEmits<{ 'change-language': [language: Language]; 'translate-ai': [] }>()

const label = (language: Language) =>
  LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language
const sourceLabel = computed(() => label(contentLanguage))
const targetLabel = computed(() => label(target))
const todo = computed(() => progress.total - progress.done)

const tabs = computed<TabsItem[]>(() => [
  { label: sourceLabel.value, value: 'source' },
  {
    label: targetLabel.value,
    value: 'target',
    // Items still to translate, so an unfinished translation shows from the written view too.
    badge: todo.value
      ? { label: String(todo.value), color: 'neutral', variant: 'subtle' }
      : undefined
  }
])
const view = computed({
  get: () => (translating.value ? 'target' : 'source'),
  set: (value: string | number) => (translating.value = value === 'target')
})

// Skills, languages and hobbies aren't translated item by item, so a profile can have content and
// still nothing to translate.
const progressLine = computed(() =>
  !progress.total
    ? `${targetLabel.value}: nothing to translate yet`
    : todo.value
      ? `${targetLabel.value}: ${progress.done} of ${progress.total} translated`
      : `${targetLabel.value}: all ${progress.total} translated`
)
const staleLine = computed(() => (staleCount ? `${staleCount} outdated` : ''))

// A side panel from tablet up, a bottom sheet on phones, decided when it opens (as TailoredCvSettings).
const open = ref(false)
const side = ref<'right' | 'bottom'>('right')
watch(open, (isOpen) => {
  if (isOpen) side.value = window.matchMedia('(min-width: 768px)').matches ? 'right' : 'bottom'
})
</script>

<template>
  <AppCard data-testid="profile-settings">
    <div class="space-y-3">
      <UTabs
        v-model="view"
        :items="tabs"
        :content="false"
        class="w-full"
        data-testid="profile-language-view"
      />

      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p class="min-w-0 text-sm text-highlighted" data-testid="profile-settings-summary">
          <template v-if="!translating">Written in {{ sourceLabel }} · </template>{{ progressLine
          }}<span
            v-if="staleLine"
            class="whitespace-nowrap text-warning"
            data-testid="profile-settings-stale"
          >
            · {{ staleLine }}</span
          >
        </p>
        <UButton
          v-if="!translating"
          icon="i-lucide-sliders-horizontal"
          color="neutral"
          variant="subtle"
          size="sm"
          class="w-full justify-center sm:w-auto"
          data-testid="profile-settings-open"
          @click="open = true"
          >Change settings</UButton
        >
      </div>

      <template v-if="translating">
        <UProgress
          v-if="progress.total"
          :model-value="progress.done"
          :max="progress.total"
          size="sm"
          data-testid="profile-translate-progress"
        />
        <p class="text-sm text-muted">
          Summary, job titles, education and bullets. Names, dates and other sections are used as
          written. Tailored CVs in {{ targetLabel }} start from this.
        </p>
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="outline"
          size="sm"
          class="w-full justify-center sm:w-auto"
          data-testid="profile-translate-ai"
          @click="emit('translate-ai')"
          >Translate with AI</UButton
        >
      </template>
    </div>

    <USlideover
      v-model:open="open"
      :side="side"
      title="Profile settings"
      description="Applies to your whole profile."
    >
      <template #body>
        <UFormField
          label="Written in"
          :help="
            hasTranslations
              ? 'Delete all translations before changing the language the profile is written in.'
              : `The other language is the translation. Import CV needs English.`
          "
        >
          <URadioGroup
            :model-value="contentLanguage"
            :items="[...LANGUAGE_OPTIONS]"
            orientation="horizontal"
            :disabled="hasTranslations || loading"
            data-testid="profile-content-language"
            @update:model-value="(value) => emit('change-language', value as Language)"
          />
        </UFormField>
      </template>
    </USlideover>
  </AppCard>
</template>
