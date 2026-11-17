<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS, languageLabel, type Language } from '~/constants/listing'

definePageMeta({ title: 'CV template' })

// One CV template. Each language has its own tab and versions: saving changed content makes that
// language's next version, and versions never change, so any one can still be previewed from
// Versions. A missing language is added unsaved, translated from another or as the profile for an
// AI draft. The shared Editor holds the content, its review and the save bar.
const route = useRoute()
const id = Number(route.params.id)

const editor = useBaseCvEditor(id)
const { baseCv, cv, dirty, language, latest, draft } = editor
const { status, error: loadError, refresh } = editor.query
const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const busy = computed(
  () => editor.saving.value || editor.loadingProfile.value || editor.translating.value
)
const editorRef = useTemplateRef('editorRef')

const backTo = computed(() =>
  baseCv.value?.archivedAt ? '/cv-templates?archived=1' : '/cv-templates'
)
useBackLink({ to: backTo, label: 'CV templates' })

const notify = useAppToast()
const toastSuccess = notify.success
const note = ref('')
const label = computed(() => (language.value ? languageLabel(language.value) : ''))
// Unchanged content returns the latest version, so only a new number counts as a new version.
const save = async () => {
  const result = await editor.save(note.value)
  if (!result) return
  note.value = ''
  const name = languageLabel(result.language)
  const version = { id: result.id, number: result.number, language: result.language }
  const action = { label: 'Preview PDF', onClick: () => preview(version) }
  if (result.isNew) notify.success(`Saved as ${name} v${result.number}`, { action })
  else notify.info(`No changes, still ${name} v${result.number}`, { action })
}

// A tab per saved language (plus one being added), and an Add menu for the missing ones.
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
// Adding works on a clean editor only: a page holds one unsaved version at a time.
const canAdd = () => {
  if (!dirty.value) return true
  notify.warning('Save or discard your changes first')
  return false
}
const addItems = computed<DropdownMenuItem[][]>(() =>
  missingLanguages.value.map((lang) => [
    { type: 'label', label: languageLabel(lang) },
    {
      label: `Translate from ${label.value}`,
      icon: 'i-lucide-languages',
      onSelect: () => canAdd() && editor.addLanguage(lang)
    },
    {
      label: 'Draft with my AI',
      icon: 'i-lucide-sparkles',
      onSelect: async () => {
        if (canAdd() && (await editor.startLanguage(lang))) editorRef.value?.openAi()
      }
    }
  ])
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

const moreItems = computed<DropdownMenuItem[]>(() => [
  { label: 'Edit details', icon: 'i-lucide-pencil', onSelect: () => (detailsOpen.value = true) },
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

// Preview renders a saved version only, so with unsaved edits it shows the last saved one and says so.
const versionsOpen = ref(false)
const versions = computed(() =>
  baseCv.value && language.value ? versionsIn(baseCv.value.versions, language.value) : []
)
const previewed = ref<{ id: number; number: number; language: Language }>()
const pdfOpen = ref(false)
const preview = (version: { id: number; number: number; language: Language }) => {
  previewed.value = version
  pdfOpen.value = true
}
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 pb-4 sm:space-y-6 lg:max-w-none">
      <div v-if="baseCv">
        <div class="flex flex-wrap items-start justify-between gap-3">
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
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-history"
              color="neutral"
              variant="subtle"
              :disabled="!versions.length"
              data-testid="cv-template-history"
              @click="versionsOpen = true"
              >Versions</UButton
            >
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="subtle"
              :disabled="!latest"
              data-testid="cv-template-preview"
              @click="latest && preview(latest)"
              >{{ dirty && latest ? 'Preview last saved' : 'Preview PDF' }}</UButton
            >
            <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                aria-label="More template actions"
                data-testid="cv-template-more"
              />
            </UDropdownMenu>
          </div>
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
        <!-- Everything below the tabs (versions, preview, save) is this language's. -->
        <div class="flex flex-wrap items-center gap-2">
          <UTabs
            v-model="tab"
            :items="tabs"
            :content="false"
            variant="pill"
            aria-label="Language"
            data-testid="cv-template-languages"
          />
          <UDropdownMenu v-if="missingLanguages.length" :items="addItems">
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              :loading="editor.translating.value"
              :disabled="busy"
              data-testid="cv-template-add-language"
              >Add language</UButton
            >
          </UDropdownMenu>
        </div>

        <CvTemplatesEditor ref="editorRef" :editor="editor" :allow-leave="deleted">
          <template #intro
            >Edits change this template only, not your profile. Send it from a listing’s Apply
            dialog.</template
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
          <template #actions>
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
          </template>
        </CvTemplatesEditor>
      </template>

      <USlideover v-if="baseCv" v-model:open="versionsOpen" :title="`${label} versions`">
        <template #body>
          <ul class="divide-y divide-default" data-testid="cv-template-versions">
            <li
              v-for="v in versions"
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
        v-model:open="switchOpen"
        :title="
          draft ? `Discard the unsaved ${label} version?` : `Discard unsaved changes to ${label}?`
        "
        description="Your changes in this language are lost. Saved versions stay as they are."
        confirm-label="Discard changes"
        @confirm="confirmSwitch"
      />
    </div>
  </div>
</template>
