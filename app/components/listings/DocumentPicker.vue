<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'

const { documents, help = '' } = defineProps<{
  label: string
  required?: boolean
  help?: string
  documents: ListingDetail['documents']
}>()
// Either an already uploaded document or a new file to upload on submit, never both.
const documentId = defineModel<number | undefined>('documentId')
const file = defineModel<File | null>('file', { default: null })

const items = computed(() => documents.map((d) => ({ label: d.fileName, value: d.id })))
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
        @update:model-value="file = null"
      />
      <UFileUpload
        v-model="file"
        accept="application/pdf"
        :label="items.length ? 'Or upload a new PDF' : 'Upload a PDF'"
        description="Max 5 MB"
        class="min-h-28 w-full"
        @update:model-value="documentId = undefined"
      />
    </div>
  </UFormField>
</template>
