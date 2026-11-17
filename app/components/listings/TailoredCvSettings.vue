<script setup lang="ts">
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import { CONTENT_STYLE_OPTIONS, SECTION_ORDER_OPTIONS, TEMPLATE_OPTIONS } from '~/constants/cv'
import type { TailoredCv } from '~/utils/tailoredCv'

// The tailored CV's layout choices in one place: a summary line, and a panel to change them. Style,
// entry format and PDF layout apply when picked; another language only offers a rebuild from the
// profile, since that replaces the content (the page confirms when there are edits). The default
// slot adds rows under the summary (style nudge, latest PDF).
// Rebuild closes the panel first: the page's confirm modal would otherwise open underneath it and
// leave the panel unclickable, and either way the result shows on the page, not in here.
const { disabled = false, resetting = false } = defineProps<{
  disabled?: boolean
  resetting?: boolean
}>()
const cv = defineModel<TailoredCv>('cv', { required: true })
const emit = defineEmits<{ rebuild: [language: Language] }>()

const label = (options: readonly { label: string; value: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value
const summary = computed(() =>
  [
    label(LANGUAGE_OPTIONS, cv.value.language),
    label(TEMPLATE_OPTIONS, cv.value.template),
    label(CONTENT_STYLE_OPTIONS, cv.value.contentStyle),
    `${label(SECTION_ORDER_OPTIONS, cv.value.sectionOrder)} layout`
  ].join(' · ')
)

// A side panel from tablet up, a bottom sheet on phones. Decided when it opens, like AppFilterSheet.
const open = ref(false)
const side = ref<'right' | 'bottom'>('right')
// The picked language; the CV keeps its own until the rebuild succeeds.
const language = ref<Language>(cv.value.language)
watch(open, (isOpen) => {
  if (!isOpen) return
  side.value = window.matchMedia('(min-width: 768px)').matches ? 'right' : 'bottom'
  language.value = cv.value.language
})
// After a rebuild the CV is in the picked language, so the warning goes away by itself.
watch(
  () => cv.value.language,
  (value) => (language.value = value)
)
const languageName = computed(() => label(LANGUAGE_OPTIONS, language.value))
</script>

<template>
  <AppCard data-testid="tailored-cv-settings">
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p class="min-w-0 text-sm text-highlighted" data-testid="tailored-cv-settings-summary">
        {{ summary }}
      </p>
      <UButton
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="subtle"
        size="sm"
        :disabled="disabled"
        data-testid="tailored-cv-settings-open"
        @click="open = true"
        >Change settings</UButton
      >
    </div>
    <slot />

    <USlideover
      v-model:open="open"
      :side="side"
      title="CV settings"
      description="Applies to this CV only."
    >
      <template #body>
        <div class="space-y-6">
          <section class="space-y-4" aria-labelledby="tailored-cv-settings-content">
            <div>
              <h3 id="tailored-cv-settings-content" class="font-medium text-highlighted">
                Content
              </h3>
              <p class="text-sm text-muted">
                These change the text. Tailor again afterwards to update the AI wording.
              </p>
            </div>
            <UFormField label="Language" help="Section headings in the PDF stay in English.">
              <URadioGroup
                v-model="language"
                :items="[...LANGUAGE_OPTIONS]"
                orientation="horizontal"
                :disabled="disabled || resetting"
                data-testid="tailored-cv-language"
              />
            </UFormField>
            <!-- Warning text on the subtle warning background is too faint, so the border and icon
               carry the colour and the text uses the regular tones. -->
            <UAlert
              v-if="language !== cv.language"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :ui="{ title: 'text-highlighted', description: 'text-toned' }"
              :title="`Switching to ${languageName} rebuilds this CV from your ${languageName} profile`"
              description="Your edits in this CV are replaced. Nothing is saved until you save."
              :actions="[
                {
                  label: `Rebuild in ${languageName}`,
                  color: 'neutral',
                  variant: 'solid',
                  size: 'md',
                  loading: resetting,
                  onClick: () => {
                    open = false
                    emit('rebuild', language)
                  }
                }
              ]"
              data-testid="tailored-cv-language-warning"
            />
            <CvStyleFields v-model:cv="cv" :disabled="disabled" />
          </section>
          <USeparator />
          <section class="space-y-4" aria-labelledby="tailored-cv-settings-pdf">
            <div>
              <h3 id="tailored-cv-settings-pdf" class="font-medium text-highlighted">PDF only</h3>
              <p class="text-sm text-muted">Changes how the PDF looks, not the text you edit.</p>
            </div>
            <CvPdfLayoutField v-model:cv="cv" :disabled="disabled" />
          </section>
        </div>
      </template>
      <template #footer>
        <UButton class="ml-auto" data-testid="tailored-cv-settings-done" @click="open = false"
          >Done</UButton
        >
      </template>
    </USlideover>
  </AppCard>
</template>
