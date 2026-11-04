<script setup lang="ts">
import type { BaseCvListItem } from '~/composables/useBaseCvs'
import type { ListingDetail } from '~/composables/useListing'
import { languageLabel } from '~/constants/listing'

const {
  documents,
  help = '',
  baseCvs = false
} = defineProps<{
  label: string
  required?: boolean
  help?: string
  documents: ListingDetail['documents']
  // CVs only: also offer a CV template version, which the parent turns into a document on submit.
  baseCvs?: boolean
}>()
// One of an already uploaded document, a new file to upload, or a template version, never two.
const documentId = defineModel<number | undefined>('documentId')
const file = defineModel<File | null>('file', { default: null })
const baseCvVersionId = defineModel<number | undefined>('baseCvVersionId')

const items = computed(() => documents.map((d) => ({ label: d.fileName, value: d.id })))

// Active templates only; archived ones are hidden from sending. The prop never changes on a mounted
// picker, so only the CV picker fetches them.
const { data: templates } = baseCvs
  ? useAsyncData(
      'base-cvs-picker',
      () => gql(BASE_CV_LIST, { archived: false }).then((r) => r.baseCvs),
      { server: false }
    )
  : { data: ref<BaseCvListItem[]>() }
const templateItems = computed(() =>
  (templates.value ?? []).map((t) => ({
    label: `${t.name} · ${languageLabel(t.language)}`,
    value: t.id
  }))
)
const templateId = ref<number>()
const template = computed(() => templates.value?.find((t) => t.id === templateId.value))
const versionItems = computed(() =>
  (template.value?.versions ?? []).map((v, i) => ({
    label: i === 0 ? `v${v.number} (latest)` : `v${v.number}`,
    value: v.id
  }))
)
// Picking a template picks its latest version (versions come newest first).
const pickTemplate = (id: number | undefined) => {
  templateId.value = id
  baseCvVersionId.value = template.value?.latestVersion.id
  documentId.value = undefined
  file.value = null
}
// The parent clears the version once it has made the document, so the template choice goes too.
watch(baseCvVersionId, (id) => {
  if (id === undefined) templateId.value = undefined
})
const version = computed(() => template.value?.versions.find((v) => v.id === baseCvVersionId.value))
const previewOpen = ref(false)
// Choosing a file or an upload drops the other choices; programmatic resets don't count.
const pickOther = (clear: () => void) => {
  clear()
  baseCvVersionId.value = undefined
}
</script>

<template>
  <UFormField :label="label" :required="required" :help="help">
    <div class="space-y-2">
      <USelect
        v-if="items.length"
        v-model="documentId"
        :items="items"
        placeholder="Pick an uploaded file"
        class="w-full"
        @update:model-value="(id) => id !== undefined && pickOther(() => (file = null))"
      />
      <div v-if="templateItems.length" class="space-y-2" data-testid="document-picker-templates">
        <USelect
          :model-value="templateId"
          :items="templateItems"
          placeholder="Or use a CV template"
          class="w-full"
          data-testid="document-picker-template"
          @update:model-value="pickTemplate"
        />
        <div v-if="template" class="flex items-center gap-2">
          <USelect
            v-model="baseCvVersionId"
            :items="versionItems"
            aria-label="Template version"
            class="min-w-0 flex-1"
            data-testid="document-picker-version"
          />
          <UButton
            icon="i-lucide-eye"
            color="neutral"
            variant="subtle"
            :disabled="!version"
            data-testid="document-picker-preview"
            @click="previewOpen = true"
            >Preview</UButton
          >
        </div>
        <p v-if="template" class="text-xs text-muted">
          A PDF of this version is added to the listing when you record the application.
        </p>
      </div>
      <UFileUpload
        v-model="file"
        accept="application/pdf"
        :label="items.length || templateItems.length ? 'Or upload a new PDF' : 'Upload a PDF'"
        description="Max 5 MB"
        class="min-h-28 w-full"
        @update:model-value="(chosen) => chosen && pickOther(() => (documentId = undefined))"
      />
    </div>
    <LazyListingsTailoredCvPdfModal
      v-if="template && version"
      v-model:open="previewOpen"
      :url="baseCvPdfUrl(version.id)"
      :file-name="`${template.name} v${version.number}.pdf`"
    />
  </UFormField>
</template>
