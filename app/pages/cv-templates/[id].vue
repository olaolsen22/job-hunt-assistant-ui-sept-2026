<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CvContentStyle } from '~/utils/tailoredCv'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { languageLabel } from '~/constants/listing'
import {
  CONTENT_STYLE_DESCRIPTION,
  CONTENT_STYLE_OPTIONS,
  SECTION_ORDER_HINTS,
  SECTION_ORDER_OPTIONS,
  TEMPLATE_HINTS,
  TEMPLATE_OPTIONS
} from '~/constants/cv'

definePageMeta({ title: 'CV template' })

// One CV template in the shared CV editor, without AI or a listing. Saving changed content makes
// the next version; versions never change, so any one can still be previewed from History.
const route = useRoute()
const id = Number(route.params.id)

const { profile, error: profileError } = useProfile()
const editor = useBaseCvEditor(id)
const { baseCv, cv, dirty } = editor
const { status, error: loadError, refresh } = editor.query
const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const busy = computed(() => editor.saving.value || editor.reloading.value)

const entryStyle = computed(() => (cv.value ? cvEntryStyle(cv.value) : 'BULLETS'))
const backTo = computed(() =>
  baseCv.value?.archivedAt ? '/cv-templates?archived=1' : '/cv-templates'
)

const toast = useToast()
const toastSuccess = useSuccessToast()
const note = ref('')
// Unchanged content returns the latest version, so only a new number counts as a new version.
const save = async () => {
  const result = await editor.save(note.value)
  if (!result) return
  note.value = ''
  if (result.isNew) toastSuccess(`Saved as v${result.number}`)
  else toast.add({ title: `No changes. Still v${result.number}`, icon: 'i-lucide-check' })
}

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
const previewed = ref<{ id: number; number: number }>()
const pdfOpen = ref(false)
const preview = (version: { id: number; number: number }) => {
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
              <UBadge variant="subtle" data-testid="cv-template-version"
                >v{{ baseCv.latestVersion.number }}</UBadge
              >
              <UBadge color="neutral" variant="subtle">{{ languageLabel(baseCv.language) }}</UBadge>
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
        v-if="loadError || profileError"
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

        <AppCard title="Style">
          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="CV style" :description="TEMPLATE_HINTS[cv.template]">
              <URadioGroup
                v-model="cv.template"
                :items="TEMPLATE_OPTIONS"
                orientation="horizontal"
                data-testid="tailored-cv-template"
              />
            </UFormField>
            <UFormField label="Entry format" :description="CONTENT_STYLE_DESCRIPTION[cv.template]">
              <URadioGroup
                :model-value="entryStyle"
                :items="CONTENT_STYLE_OPTIONS"
                orientation="horizontal"
                :disabled="cv.template === 'CONCISE'"
                data-testid="tailored-cv-content-style"
                @update:model-value="setCvContentStyle(cv, $event as CvContentStyle)"
              />
            </UFormField>
            <UFormField
              label="PDF layout"
              :description="SECTION_ORDER_HINTS[cv.sectionOrder]"
              class="md:col-span-2"
            >
              <URadioGroup
                v-model="cv.sectionOrder"
                :items="SECTION_ORDER_OPTIONS"
                orientation="horizontal"
                data-testid="tailored-cv-section-order"
              />
            </UFormField>
          </div>
        </AppCard>

        <CvContentEditor v-model:cv="cv" :profile="profile" :disabled="busy" />

        <!-- Sticky like the tailored CV's bar, so saving stays in reach on long CVs. On phones the
             status and note take their own lines above equal buttons. -->
        <div
          class="sticky bottom-0 z-10 space-y-3 rounded-md border border-default bg-default/90 p-3 backdrop-blur"
          data-testid="cv-template-save-bar"
        >
          <UInput
            v-if="dirty"
            v-model="note"
            placeholder="What changed? (optional)"
            aria-label="Version note"
            class="w-full"
            data-testid="cv-template-note"
          />
          <div class="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap">
            <span
              class="order-first col-span-2 inline-flex items-center gap-1.5 text-sm text-muted sm:order-none sm:col-auto sm:flex-1"
            >
              <UIcon
                :name="dirty ? 'i-lucide-circle-dot' : 'i-lucide-check'"
                :class="dirty ? 'text-warning' : ''"
              />
              <span data-testid="cv-template-save-status">{{
                dirty ? 'Unsaved changes' : `Saved as v${baseCv.latestVersion.number}`
              }}</span>
            </span>
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
              :disabled="dirty"
              class="w-full justify-center sm:w-auto"
              data-testid="cv-template-preview"
              @click="preview(baseCv.latestVersion)"
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
              >Save version</UButton
            >
          </div>
        </div>
      </template>

      <USlideover v-if="baseCv" v-model:open="historyOpen" title="Versions">
        <template #body>
          <ul class="divide-y divide-default" data-testid="cv-template-versions">
            <li
              v-for="v in baseCv.versions"
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
        :file-name="`${baseCv.name} v${previewed.number}.pdf`"
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
        title="Reload from your profile?"
        description="Your unsaved edits are replaced with your current profile. The saved versions stay as they are."
        confirm-label="Reload"
        :loading="editor.reloading.value"
        @confirm="reload"
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
