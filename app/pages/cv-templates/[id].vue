<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS, languageLabel, type Language } from '~/constants/listing'

definePageMeta({ title: 'CV template' })

// One CV template in the shared CV editor, without a listing or per-section AI. Each language has
// its own tab and versions: saving changed content makes that language's next version, and versions
// never change, so any one can still be previewed from History. A missing language is added as an
// unsaved translation of another, with what's still untranslated flagged on its cards. "Draft with
// AI" fills the editor from the owner's own AI, also unsaved.
const route = useRoute()
const id = Number(route.params.id)

const editor = useBaseCvEditor(id)
const { baseCv, cv, dirty, language, latest, draft, flagged, aiDrafted } = editor
const { status, error: loadError, refresh } = editor.query
const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const busy = computed(() => editor.saving.value || editor.reloading.value)

const backTo = computed(() =>
  baseCv.value?.archivedAt ? '/cv-templates?archived=1' : '/cv-templates'
)

const toast = useToast()
const toastSuccess = useSuccessToast()
const note = ref('')
const label = computed(() => (language.value ? languageLabel(language.value) : ''))
// Unchanged content returns the latest version, so only a new number counts as a new version.
const save = async () => {
  const result = await editor.save(note.value)
  if (!result) return
  note.value = ''
  const name = languageLabel(result.language)
  if (result.isNew) toastSuccess(`Saved as ${name} v${result.number}`)
  else toast.add({ title: `No changes. Still ${name} v${result.number}`, icon: 'i-lucide-check' })
}

// A tab per saved language (plus one being added), and an Add button per missing language.
const tabs = computed(() => {
  if (!baseCv.value) return []
  const langs = [...baseCv.value.languages]
  if (draft.value && !langs.includes(draft.value.language)) langs.push(draft.value.language)
  return langs.map((lang) => {
    const version = latestIn(baseCv.value!.versions, lang)
    return {
      label: `${languageLabel(lang)} ${version ? `v${version.number}` : '· not saved'}`,
      value: lang
    }
  })
})
const missingLanguages = computed(() =>
  LANGUAGE_OPTIONS.map((o) => o.value).filter((lang) => !tabs.value.some((t) => t.value === lang))
)
// Unsaved edits (or an unsaved new language) are only one version per page, so switching asks.
const switchTarget = ref<Language>()
const switchOpen = computed({
  get: () => !!switchTarget.value,
  set: (isOpen) => {
    if (!isOpen) switchTarget.value = undefined
  }
})
const requestSwitch = (lang: Language) => {
  if (lang === language.value) return
  if (dirty.value) switchTarget.value = lang
  else editor.switchTo(lang)
}
const confirmSwitch = () => {
  editor.switchTo(switchTarget.value!)
  switchTarget.value = undefined
}
const tab = computed({
  get: () => language.value,
  set: (lang) => lang && requestSwitch(lang)
})
const addLanguage = async (lang: Language) => {
  if (dirty.value) {
    toast.add({ title: 'Save or discard your changes first.', icon: 'i-lucide-circle-alert' })
    return
  }
  await editor.addLanguage(lang)
}
const discardDraft = () => editor.switchTo(baseCv.value!.languages[0]!)

const aiOpen = ref(false)
const aiOpened = useOpenedOnce(aiOpen)
// Content the same as the saved version has nothing to check or save.
const showAiDraft = computed(() => aiDrafted.value && dirty.value)
// An AI draft on an unsaved language discards that language too, so there's no version to go back to.
const discardAiDraft = () => (draft.value ? discardDraft() : editor.switchTo(language.value!))
// Flagged cards carry data-flagged; go to the first one below the top of the screen, else the first.
const nextFlagged = () => {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-flagged]')]
  const next = cards.find((el) => el.getBoundingClientRect().top > 120) ?? cards[0]
  next?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
const fromLabel = computed(() => (draft.value ? languageLabel(draft.value.fromLanguage) : ''))
const flaggedLabel = computed(
  () =>
    `${flagged.value.length} ${flagged.value.length === 1 ? 'part is' : 'parts are'} still in ${fromLabel.value}`
)
const saveStatus = computed(() =>
  showAiDraft.value
    ? 'AI draft: check bullets before saving'
    : draft.value && flagged.value.length
      ? flaggedLabel.value
      : dirty.value
        ? 'Unsaved changes'
        : `Saved as ${label.value} v${latest.value?.number}`
)

const reloadOpen = ref(false)
const reload = async () => {
  reloadOpen.value = false
  if (await editor.reloadFromProfile())
    toast.add({
      title: 'Reloaded from your profile',
      description: 'Remove what you don’t need, then save it as a new version.',
      icon: 'i-lucide-rotate-ccw'
    })
}
// Untouched content is still the latest version, so there is nothing to lose by reloading.
const requestReload = () => {
  if (dirty.value) reloadOpen.value = true
  else reload()
}

const detailsOpen = ref(false)
const detailsOpened = useOpenedOnce(detailsOpen)
const deleteOpen = ref(false)
const deleted = ref(false)
const { setArchived } = useBaseCvActions()
const archive = async (isArchived: boolean) => {
  if (!(await setArchived(id, isArchived))) return
  toastSuccess(isArchived ? 'Template archived' : 'Template restored')
  await refresh()
}
const onDeleted = async () => {
  deleted.value = true
  toastSuccess('Template deleted')
  await navigateTo('/cv-templates', { replace: true })
}
const onArchived = async () => {
  toastSuccess('Template archived')
  await refresh()
}

// A menu keeps the header narrow on phones.
const moreItems = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Edit details',
    icon: 'i-lucide-pencil',
    onSelect: () => (detailsOpen.value = true)
  },
  {
    label: 'Reload from profile…',
    icon: 'i-lucide-rotate-ccw',
    disabled: busy.value,
    onSelect: requestReload
  },
  { type: 'separator' },
  {
    label: baseCv.value?.archivedAt ? 'Restore' : 'Archive',
    icon: baseCv.value?.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive',
    onSelect: () => archive(!baseCv.value?.archivedAt)
  },
  {
    label: 'Delete…',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => (deleteOpen.value = true)
  }
])

// Preview renders a saved version, so the latest one only matches the editor without unsaved edits.
const historyOpen = ref(false)
const history = computed(() =>
  baseCv.value && language.value ? versionsIn(baseCv.value.versions, language.value) : []
)
const previewed = ref<{ id: number; number: number; language: Language }>()
const pdfOpen = ref(false)
const preview = (version: { id: number; number: number; language: Language }) => {
  previewed.value = version
  pdfOpen.value = true
}

const { open: leaveOpen, leave } = useLeaveConfirm(() => dirty.value && !deleted.value)
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6">
      <div class="space-y-2">
        <UButton :to="backTo" icon="i-lucide-arrow-left" variant="ghost" color="neutral"
          >CV templates</UButton
        >
        <div v-if="baseCv" class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1
                class="break-words text-xl font-semibold text-highlighted"
                data-testid="cv-template-title"
              >
                {{ baseCv.name }}
              </h1>
              <UBadge
                v-if="baseCv.archivedAt"
                color="neutral"
                variant="outline"
                icon="i-lucide-archive"
                >Archived</UBadge
              >
            </div>
            <p v-if="baseCv.description" class="break-words text-sm text-muted">
              {{ baseCv.description }}
            </p>
          </div>
          <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              :loading="editor.reloading.value"
              aria-label="More template actions"
              data-testid="cv-template-more"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UAlert
        v-if="loadError"
        color="error"
        :description="ERROR_MESSAGES.generic"
        data-testid="cv-template-load-error"
      />

      <div v-else-if="loading && !cv" class="space-y-4" data-testid="cv-template-loading">
        <USkeleton class="h-28 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>

      <UAlert
        v-else-if="!baseCv || !cv"
        color="error"
        title="Template not found"
        description="It may have been deleted."
        :actions="[
          {
            label: 'Back to CV templates',
            to: '/cv-templates',
            color: 'neutral',
            variant: 'outline'
          }
        ]"
        data-testid="cv-template-not-found"
      />

      <template v-else>
        <UAlert
          v-if="editor.invalidContent.value"
          color="error"
          variant="subtle"
          title="Something in this CV is no longer in your profile"
          :description="`${editor.invalidContent.value} Reload from your profile, then save.`"
          :actions="[
            {
              label: 'Reload from profile',
              color: 'neutral',
              variant: 'outline',
              onClick: requestReload
            }
          ]"
          data-testid="cv-template-invalid"
        />

        <!-- Everything below the tabs (versions, History, Preview, Save) is this language's. -->
        <div class="flex flex-wrap items-center gap-2">
          <UTabs
            v-model="tab"
            :items="tabs"
            :content="false"
            variant="pill"
            aria-label="Language"
            data-testid="cv-template-languages"
          />
          <UButton
            v-for="lang in missingLanguages"
            :key="lang"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            :loading="editor.translating.value"
            :disabled="busy"
            :data-testid="`cv-template-add-${languageCode(lang).toLowerCase()}`"
            @click="addLanguage(lang)"
            >Add {{ languageLabel(lang) }}</UButton
          >
        </div>

        <CvTemplatesAiDraftAlert v-if="showAiDraft" @discard="discardAiDraft" />

        <UAlert
          v-else-if="draft"
          :color="flagged.length ? 'info' : 'success'"
          variant="subtle"
          icon="i-lucide-languages"
          :title="`Translated from ${fromLabel}. Not saved yet.`"
          :description="
            flagged.length
              ? `${flaggedLabel}: edit each flagged card. Names and tech terms can stay as they are.`
              : 'Every flagged part has been edited. Save it as v1.'
          "
          :actions="[
            ...(flagged.length
              ? [
                  {
                    label: 'Next untranslated',
                    color: 'neutral' as const,
                    variant: 'outline' as const,
                    onClick: nextFlagged
                  }
                ]
              : []),
            {
              label: 'Discard',
              color: 'neutral' as const,
              variant: 'ghost' as const,
              onClick: discardDraft
            }
          ]"
          data-testid="cv-template-draft"
        />

        <CvTemplatesOptionsCard v-model:cv="cv" :busy="busy" @draft="aiOpen = true">
          Draft this language for a target role with your own AI, or edit it by hand. Edits here
          change this template only, not your profile.
        </CvTemplatesOptionsCard>

        <CvContentEditor
          v-model:cv="cv"
          v-model:flagged="flagged"
          :flag-language="fromLabel"
          :source="editor.source.value"
          :disabled="busy"
        />

        <AppSaveBar
          :status="saveStatus"
          status-testid="cv-template-save-status"
          :changed="dirty"
          :warn="dirty"
          align="start"
          data-testid="cv-template-save-bar"
        >
          <template #above>
            <UInput
              v-if="dirty"
              v-model="note"
              placeholder="What changed? (optional)"
              aria-label="Version note"
              class="w-full"
              data-testid="cv-template-note"
            />
          </template>
          <template v-if="draft && flagged.length" #status>
            <UButton color="neutral" variant="link" size="sm" class="sm:hidden" @click="nextFlagged"
              >Next</UButton
            >
          </template>
          <UButton
            icon="i-lucide-history"
            color="neutral"
            variant="subtle"
            class="w-full justify-center sm:w-auto"
            data-testid="cv-template-history"
            @click="historyOpen = true"
            >History</UButton
          >
          <UButton
            icon="i-lucide-eye"
            color="neutral"
            variant="subtle"
            :disabled="dirty || !latest"
            class="w-full justify-center sm:w-auto"
            data-testid="cv-template-preview"
            @click="latest && preview(latest)"
            >Preview PDF</UButton
          >
          <UButton
            v-if="dirty"
            icon="i-lucide-save"
            :loading="editor.saving.value"
            :disabled="busy"
            class="col-span-2 w-full justify-center sm:col-auto sm:w-auto"
            data-testid="cv-template-save"
            @click="save"
            >{{ draft ? `Save ${label} v1` : `Save ${label} version` }}</UButton
          >
        </AppSaveBar>
      </template>

      <USlideover v-if="baseCv" v-model:open="historyOpen" :title="`${label} versions`">
        <template #body>
          <ul class="divide-y divide-default" data-testid="cv-template-versions">
            <li
              v-for="v in history"
              :key="v.id"
              class="flex items-start justify-between gap-3 py-3"
            >
              <div class="min-w-0">
                <p class="font-medium text-highlighted">
                  v{{ v.number }}
                  <span class="font-normal text-muted">· {{ formatDateTime(v.createdAt) }}</span>
                </p>
                <p v-if="v.note" class="break-words text-sm text-muted">{{ v.note }}</p>
              </div>
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="subtle"
                size="sm"
                :aria-label="`Preview v${v.number}`"
                @click="preview(v)"
                >Preview</UButton
              >
            </li>
          </ul>
        </template>
      </USlideover>

      <LazyListingsTailoredCvPdfModal
        v-if="baseCv && previewed"
        v-model:open="pdfOpen"
        :url="baseCvPdfUrl(previewed.id)"
        :file-name="`${baseCv.name} (${languageCode(previewed.language)}) v${previewed.number}.pdf`"
      />

      <LazyCvTemplatesAiDraftModal
        v-if="baseCv && cv && aiOpened"
        v-model:open="aiOpen"
        :editor="editor"
      />

      <LazyCvTemplatesDetailsModal
        v-if="baseCv && detailsOpened"
        v-model:open="detailsOpen"
        :base-cv="baseCv"
        @saved="refresh"
      />
      <CvTemplatesDeleteModal
        v-if="baseCv"
        v-model:open="deleteOpen"
        :base-cv="baseCv"
        @deleted="onDeleted"
        @archived="onArchived"
      />

      <AppConfirmModal
        v-model:open="reloadOpen"
        :title="`Reload ${label} from your profile?`"
        :description="`Your unsaved edits are replaced with your current profile in ${label}. The saved versions stay as they are.`"
        confirm-label="Reload"
        :loading="editor.reloading.value"
        @confirm="reload"
      />
      <AppConfirmModal
        v-model:open="switchOpen"
        :title="
          draft ? `Discard the unsaved ${label} version?` : `Discard unsaved changes to ${label}?`
        "
        description="Your changes in this language are lost. Saved versions stay as they are."
        confirm-label="Discard changes"
        @confirm="confirmSwitch"
      />
      <AppConfirmModal
        v-model:open="leaveOpen"
        title="Leave without saving?"
        description="This CV template has unsaved changes. They will be lost."
        confirm-label="Leave"
        @confirm="leave"
      />
    </div>
  </div>
</template>
