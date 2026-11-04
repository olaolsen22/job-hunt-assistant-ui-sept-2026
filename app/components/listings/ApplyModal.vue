<script setup lang="ts">
import { print } from '@0no-co/graphql.web'
import type { ResultOf } from 'gql.tada'
import type { ListingDetail } from '~/composables/useListing'

// `cvDocumentId` preselects a CV, e.g. the PDF just generated for this listing. The newest unsent
// cover letter is preselected, since one written for this listing is the one to send.
const { listing, cvDocumentId = undefined } = defineProps<{
  listing: ListingDetail
  cvDocumentId?: number
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const UPLOAD_DOCUMENT = graphql(`
  mutation UploadDocument($input: UploadDocumentInput!) {
    uploadDocument(input: $input) {
      document {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const APPLY = graphql(`
  mutation ApplyToListing($input: ApplyToListingInput!) {
    applyToListing(input: $input) {
      listing {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

type Kind = ListingDetail['documents'][number]['kind']

// Same shared fetch as the listing's Tailored CV card, so opening the modal costs no request.
const { data: tailoredCv, status: tailoredCvStatus } = useTailoredCvDraftQuery(listing.id)
const offerTailoring = computed(() => tailoredCvStatus.value === 'success' && !tailoredCv.value)

const unsent = (kind: Kind) => listing.documents.filter((d) => d.kind === kind && !d.sentAt)

const cvId = ref<number>()
const cvFile = ref<File | null>(null)
const cvVersionId = ref<number>()
const coverId = ref<number>()
const coverFile = ref<File | null>(null)
const appliedAt = ref('')
const now = ref('')
const note = ref('')

// Declared before resetForm, which the immediate `open` watcher below calls during setup.
let generated: { versionId: number; documentId: number } | undefined
const initialized = ref(false)
const resetForm = () => {
  cvId.value = cvDocumentId
  coverId.value = latestUnsentDocument(listing.documents, 'COVER_LETTER')?.id
  cvFile.value = coverFile.value = null
  cvVersionId.value = undefined
  generated = undefined
  appliedAt.value = toDateTimeLocal()
  note.value = ''
}

// Preserve cancelled input while this page stays mounted; reset only after success.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    now.value = toDateTimeLocal()
    if (initialized.value) return
    resetForm()
    initialized.value = true
  },
  { immediate: true }
)

// Uploads are GraphQL multipart requests, which the JSON-only `gql` helper doesn't send.
// The API requires the preflight header on them as CSRF protection.
const upload = async (kind: Kind, file: File) => {
  const body = new FormData()
  body.append(
    'operations',
    JSON.stringify({
      query: print(UPLOAD_DOCUMENT),
      variables: { input: { listingId: listing.id, kind, file: null } }
    })
  )
  body.append('map', JSON.stringify({ 0: ['variables.input.file'] }))
  body.append('0', file)
  const res = await $fetch<{ data?: ResultOf<typeof UPLOAD_DOCUMENT> }>('/graphql', {
    method: 'POST',
    body,
    headers: { 'GraphQL-Preflight': '1' }
  })
  if (!res.data) throw new Error('Upload response has no data')
  return res.data.uploadDocument
}

const { run, loading } = useMutation(() => emit('changed'))

// A CV template version becomes a document only now, so an abandoned dialog leaves none behind.
// The made document is remembered for that version, so a retry after a failed apply doesn't make
// another, while the picker keeps showing the template the owner chose.
const generateCv = async () => {
  const versionId = cvVersionId.value
  if (!versionId || generated?.versionId === versionId) return []
  const { generateBaseCvDocument } = await gql(GENERATE_BASE_CV_DOCUMENT, {
    listingId: listing.id,
    baseCvVersionId: versionId
  })
  const document = generateBaseCvDocument.document
  if (document) generated = { versionId, documentId: document.id }
  return generateBaseCvDocument.errors ?? []
}

const submit = async () => {
  const ok = await run(async () => {
    const generateErrors = await generateCv()
    if (generateErrors.length) return generateErrors
    const results = await Promise.allSettled([
      cvFile.value ? upload('CV', cvFile.value) : null,
      coverFile.value ? upload('COVER_LETTER', coverFile.value) : null
    ])
    const uploadErrors: { __typename: string; message: string }[] = []
    results.forEach((result, index) => {
      const label = index === 0 ? 'CV' : 'Cover letter'
      if (result.status === 'rejected') {
        uploadErrors.push({
          __typename: 'UploadError',
          message: `${label} upload failed. Try again; successful uploads are kept.`
        })
        return
      }
      const payload = result.value
      if (payload?.document) {
        if (index === 0) [cvId.value, cvFile.value] = [payload.document.id, null]
        else [coverId.value, coverFile.value] = [payload.document.id, null]
      }
      uploadErrors.push(...(payload?.errors ?? []))
    })
    if (uploadErrors.length) return uploadErrors

    const { applyToListing } = await gql(APPLY, {
      input: {
        listingId: listing.id,
        cvDocumentId: (cvVersionId.value ? generated?.documentId : cvId.value) ?? null,
        coverLetterDocumentId: coverId.value ?? null,
        appliedAt: new Date(appliedAt.value).toISOString(),
        note: note.value
      }
    })
    return applyToListing.errors
  })
  if (!ok) return
  resetForm()
  initialized.value = false
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    title="Record application"
    confirm-label="Record application"
    :loading="loading"
    description="Apply through the original ad, then record the date and documents here."
    :disabled="!appliedAt"
    @confirm="submit"
  >
    <div class="space-y-4">
      <p
        v-if="offerTailoring"
        class="flex flex-wrap items-center gap-x-1 text-sm text-muted"
        data-testid="apply-tailor-cv"
      >
        No tailored CV for this listing.
        <ULink :to="`/listings/${listing.id}/cv`" class="text-primary" @click="open = false"
          >Tailor a CV first</ULink
        >
      </p>
      <ListingsDocumentPicker
        v-model:document-id="cvId"
        v-model:file="cvFile"
        v-model:base-cv-version-id="cvVersionId"
        base-cvs
        label="CV"
        help="Optional. No CV? Say how you applied in the note."
        :documents="unsent('CV')"
      />
      <ListingsDocumentPicker
        v-model:document-id="coverId"
        v-model:file="coverFile"
        label="Cover letter"
        :documents="unsent('COVER_LETTER')"
      />
      <UFormField label="Applied at" required>
        <UInput v-model="appliedAt" type="datetime-local" :max="now" class="w-full" />
      </UFormField>
      <AppMarkdownEditor v-model="note" label="Note" />
    </div>
  </AppConfirmModal>
</template>
