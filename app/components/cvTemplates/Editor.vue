<script setup lang="ts">
import type { BaseCvEditor } from '~/composables/useBaseCvs'
import type { CvEditorAi, TailoredCvSectionKey } from '~/utils/tailoredCv'
import { languageLabel } from '~/constants/listing'

// The body both template pages share: the content (or, on a new template, the two ways to start it),
// the one status banner, AI drafts reviewed as suggestions, the Layout card and the save bar. The
// page brings its header, its save-bar buttons (`#actions`, `#above`) and, in `#intro`, a line on
// what edits here change. `allowLeave` lets the page navigate away after a save or delete.
const { editor, allowLeave = false } = defineProps<{
  editor: BaseCvEditor
  allowLeave?: boolean
}>()

const { cv, dirty, draft, flagged, suggestions, aiDrafted, language, latest, isNew } = editor
const busy = computed(
  () => editor.saving.value || editor.loadingProfile.value || editor.translating.value
)
const label = computed(() => (language.value ? languageLabel(language.value) : ''))

const aiOpen = ref(false)
const aiOpened = useOpenedOnce(aiOpen)
// An AI draft is reviewed against the profile when there's nothing to compare it with yet.
const draftWithAi = async () => {
  if (!cv.value && !(await editor.startFromProfile())) return
  aiOpen.value = true
}
defineExpose({ openAi: () => (aiOpen.value = true) })

// The shared editor's cards show suggestions with Accept and Dismiss; templates have no
// per-section AI, so there's no analyze.
const suggestionsFor = (key: TailoredCvSectionKey) =>
  suggestions.value
    .filter((s) => s.key === key)
    .map((s) => ({
      key,
      current: cvSectionText(key, cv.value && getCvSection(cv.value, key), cv.value?.contentStyle),
      suggested: cvSectionText(key, s.value, cv.value?.contentStyle),
      removal: s.value == null
    }))
const review = (key: TailoredCvSectionKey) => ({
  suggestions: suggestionsFor(key),
  onAccept: editor.accept,
  onDismiss: editor.dismiss
})
const reviewAi: CvEditorAi = { review, section: review }
const wholeList = computed(() =>
  suggestions.value.some((s) => ['experiences', 'educations', 'projects'].includes(s.key))
)

// Flagged cards carry data-flagged, suggestions their own testid; go to the next one below the
// middle of the screen, else back to the first.
const scrollToNext = (selector: string) => {
  const items = [...document.querySelectorAll<HTMLElement>(selector)]
  const next =
    items.find((el) => el.getBoundingClientRect().top > window.innerHeight / 2) ?? items[0]
  next?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

const fromLabel = computed(() =>
  draft.value?.fromLanguage ? languageLabel(draft.value.fromLanguage) : ''
)
const translation = computed(() =>
  draft.value?.fromLanguage ? { from: fromLabel.value, flagged: flagged.value.length } : undefined
)
// Back to the saved version, or with a draft language to the first saved one. A new template goes
// back to the profile, which is what the draft was compared against.
const discardTranslation = () => editor.switchTo(editor.baseCv.value!.languages[0]!)
const discardAi = () =>
  isNew
    ? editor.startFromProfile()
    : draft.value
      ? discardTranslation()
      : editor.switchTo(language.value!)

const replaceOpen = ref(false)
const replaceWithProfile = async () => {
  replaceOpen.value = false
  if (await editor.startFromProfile())
    useAppToast().success('Replaced with your profile', {
      description: 'Remove what you don’t need, then save.',
      icon: 'i-lucide-rotate-ccw'
    })
}
// Untouched content is still the latest version, so there's nothing to lose by replacing it.
const requestReplace = () => {
  if (dirty.value) replaceOpen.value = true
  else replaceWithProfile()
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const status = computed(() => {
  if (suggestions.value.length)
    return `${plural(suggestions.value.length, 'suggestion', 'suggestions')} not applied`
  if (aiDrafted.value && dirty.value) return 'AI draft: check bullets before saving'
  if (translation.value?.flagged)
    return `${plural(translation.value.flagged, 'part is', 'parts are')} still in ${fromLabel.value}`
  if (isNew) return 'Nothing is created until you save'
  if (dirty.value) return 'Unsaved changes'
  return `Saved as ${label.value} v${latest.value?.number}`
})

// Unreviewed suggestions count too: on a clean template they leave `dirty` false.
const { open: leaveOpen, leave } = useLeaveConfirm(
  () => (dirty.value || suggestions.value.length > 0) && !allowLeave
)
</script>

<template>
  <!-- From lg: content in the main column, settings in a sticky rail beside it. Below lg both
       columns are `contents`, so their children keep the single-column order (rail slot first,
       Layout after the content, the save bar last) and the save bar stays sticky to the page. -->
  <div
    class="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]"
    data-testid="cv-template-columns"
  >
    <div class="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
      <AppCard v-if="!cv" data-testid="cv-template-start">
        <div class="flex flex-col items-center gap-3 py-6 text-center">
          <UIcon name="i-lucide-file-text" class="size-10 text-muted" />
          <p>Start the content from your profile, or have your own AI draft it for a role.</p>
          <p class="text-sm text-muted">
            An AI draft is shown against your profile, so you review it company by company.
          </p>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <UButton
              icon="i-lucide-sparkles"
              class="justify-center"
              :loading="editor.loadingProfile.value && !aiOpen"
              :disabled="busy"
              data-testid="cv-template-start-ai"
              @click="draftWithAi"
              >Draft with my AI</UButton
            >
            <UButton
              icon="i-lucide-user"
              color="neutral"
              variant="subtle"
              class="justify-center"
              :disabled="busy"
              data-testid="cv-template-start-profile"
              @click="editor.startFromProfile()"
              >Start from my profile</UButton
            >
          </div>
        </div>
      </AppCard>

      <template v-else>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p class="text-sm text-muted sm:flex-1"><slot name="intro" /></p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <UButton
              icon="i-lucide-sparkles"
              class="justify-center"
              :disabled="busy"
              data-testid="cv-template-draft-ai"
              @click="draftWithAi"
              >Draft with AI</UButton
            >
            <UButton
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="subtle"
              class="justify-center"
              :loading="editor.loadingProfile.value"
              :disabled="busy"
              data-testid="cv-template-replace-profile"
              @click="requestReplace"
              >Replace with my profile</UButton
            >
          </div>
        </div>

        <CvTemplatesStatusBanner
          :invalid="editor.invalidContent.value"
          :suggestions="suggestions.length"
          :whole-list="wholeList"
          :ai-drafted="aiDrafted && dirty"
          :translation="translation"
          @replace-with-profile="requestReplace"
          @next-suggestion="scrollToNext('[data-testid=&quot;tailored-cv-suggestion&quot;]')"
          @accept-all="editor.acceptAll"
          @dismiss-all="editor.dismissAll"
          @discard-ai="discardAi"
          @next-flagged="scrollToNext('[data-flagged]')"
          @discard-translation="discardTranslation"
        />

        <CvContentEditor
          v-model:cv="cv"
          v-model:flagged="flagged"
          :flag-language="fromLabel"
          :source="editor.source.value"
          :disabled="busy"
          :ai="reviewAi"
        />

        <AppSaveBar
          class="order-last lg:order-none"
          :status="status"
          status-testid="cv-template-save-status"
          :changed="dirty || !!suggestions.length"
          :warn="dirty"
          align="start"
          data-testid="cv-template-save-bar"
        >
          <template #above>
            <slot name="above" />
          </template>
          <template v-if="suggestions.length || translation?.flagged" #status>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              class="sm:hidden"
              @click="
                scrollToNext(
                  suggestions.length
                    ? '[data-testid=&quot;tailored-cv-suggestion&quot;]'
                    : '[data-flagged]'
                )
              "
              >Next</UButton
            >
          </template>
          <slot name="actions" :busy="busy" />
        </AppSaveBar>
      </template>
    </div>

    <!-- Scrolls on its own when taller than the window, so no rail control is out of reach; p-px
         keeps the cards' borders inside its clipped box. -->
    <aside
      class="contents lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100dvh-2rem)] lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-px"
      data-testid="cv-template-rail"
    >
      <div v-if="$slots.rail" class="order-first lg:order-none"><slot name="rail" /></div>
      <!-- Two columns on tablet; one in the narrow rail. -->
      <AppCard v-if="cv" title="Layout" data-testid="cv-template-layout">
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          <CvStyleFields v-model:cv="cv" />
          <CvPdfLayoutField v-model:cv="cv" class="md:col-span-2 lg:col-span-1" />
        </div>
      </AppCard>
    </aside>
  </div>

  <LazyCvTemplatesAiDraftModal v-if="cv && aiOpened" v-model:open="aiOpen" :editor="editor" />

  <AppConfirmModal
    v-model:open="replaceOpen"
    :title="`Replace ${label} with your profile?`"
    :description="
      isNew
        ? 'The content is replaced with your current profile.'
        : `Your unsaved edits are replaced with your current profile in ${label}. The saved versions stay as they are.`
    "
    confirm-label="Replace"
    :loading="editor.loadingProfile.value"
    @confirm="replaceWithProfile"
  />
  <AppConfirmModal
    v-model:open="leaveOpen"
    title="Leave without saving?"
    :description="
      suggestions.length
        ? 'Your unsaved changes and the AI suggestions you haven’t reviewed will be lost.'
        : isNew
          ? 'This CV template hasn’t been saved. It will be lost.'
          : 'This CV template has unsaved changes. They will be lost.'
    "
    confirm-label="Leave"
    @confirm="leave"
  />
</template>
