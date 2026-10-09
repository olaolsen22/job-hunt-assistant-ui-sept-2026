<script setup lang="ts">
import { print } from '@0no-co/graphql.web'
import type { ResultOf } from 'gql.tada'
import type { ListingDetail } from '~/composables/useListing'

const { listing } = defineProps<{ listing: ListingDetail }>()
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

const unsent = (kind: Kind) => listing.documents.filter((d) => d.kind === kind && !d.sentAt)

const cvId = ref<number>()
const cvFile = ref<File | null>(null)
const coverId = ref<number>()
const coverFile = ref<File | null>(null)
const appliedAt = ref('')
const now = ref('')
const note = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  cvId.value = coverId.value = undefined
  cvFile.value = coverFile.value = null
  appliedAt.value = now.value = toDateTimeLocal()
  note.value = ''
})

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

const submit = async () => {
  const ok = await run(async () => {
    const [cv, cover] = await Promise.all([
      cvFile.value ? upload('CV', cvFile.value) : null,
      coverFile.value ? upload('COVER_LETTER', coverFile.value) : null
    ])
    // Keep what did upload, so a retry after the other one failed doesn't upload it twice.
    if (cv?.document) [cvId.value, cvFile.value] = [cv.document.id, null]
    if (cover?.document) [coverId.value, coverFile.value] = [cover.document.id, null]
    const uploadErrors = [...(cv?.errors ?? []), ...(cover?.errors ?? [])]
    if (uploadErrors.length) return uploadErrors

    const { applyToListing } = await gql(APPLY, {
      input: {
        listingId: listing.id,
        cvDocumentId: cvId.value ?? null,
        coverLetterDocumentId: coverId.value ?? null,
        appliedAt: new Date(appliedAt.value).toISOString(),
        note: note.value
      }
    })
    return applyToListing.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    title="Apply"
    confirm-label="Apply"
    :loading="loading"
    :disabled="!appliedAt"
    @confirm="submit"
  >
    <div class="space-y-4">
      <ListingsDocumentPicker
        v-model:document-id="cvId"
        v-model:file="cvFile"
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
