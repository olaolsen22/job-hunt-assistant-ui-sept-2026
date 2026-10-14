<script setup lang="ts">
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'

// Previews a generated PDF with the browser's own PDF reader in an iframe. The file is fetched and
// framed as a local blob, so the API's Content-Disposition can never turn the preview into a
// download; Download stays a separate, manual action. An iframe gives no error event, so a slow or
// failed preview is handled with timers and the fetch result, surfacing Open PDF instead.
// A browser without a built-in PDF viewer (phones, or one set to download PDFs) would still save a
// framed PDF on its own, so it gets a notice instead of the frame. `applicable` offers Apply with
// this CV (Saved listings).
const { documentId, applicable = false } = defineProps<{
  documentId: number
  fileName: string
  applicable?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [] }>()

// Only read in the browser, where the dialog's body renders (it's closed during SSR).
const viewer = import.meta.client ? navigator.pdfViewerEnabled !== false : true
const url = computed(() => `/api/documents/${documentId}`)

const SLOW_MS = 10_000
const GIVE_UP_MS = 30_000

const blobUrl = ref<string>()
const loaded = ref(false)
const slow = ref(false)
const gaveUp = ref(false)
let timers: ReturnType<typeof setTimeout>[] = []
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}
const revoke = () => {
  if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
  blobUrl.value = undefined
}

// Every open fetches the file again; a reply for an earlier open is dropped.
let request = 0
watch(
  open,
  async (isOpen) => {
    clearTimers()
    revoke()
    loaded.value = slow.value = gaveUp.value = false
    if (!isOpen || !viewer) return
    const current = ++request
    timers = [
      setTimeout(() => (slow.value = true), SLOW_MS),
      setTimeout(() => (gaveUp.value = true), GIVE_UP_MS)
    ]
    try {
      const data = await $fetch<Blob>(url.value, { responseType: 'blob' })
      if (current !== request || !open.value) return
      blobUrl.value = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
    } catch {
      if (current !== request) return
      clearTimers()
      gaveUp.value = true
    }
  },
  { immediate: true }
)
onScopeDispose(() => {
  clearTimers()
  revoke()
})

const onLoad = () => {
  loaded.value = true
  clearTimers()
}
// Apply stays the one primary action; without it a stuck preview promotes Open PDF.
const promoteOpen = computed(() => (slow.value || gaveUp.value) && !applicable)
</script>

<template>
  <UModal
    v-model:open="open"
    title="CV preview"
    :description="fileName"
    :ui="{ content: `max-w-4xl ${PHONE_FULLSCREEN_MODAL}` }"
  >
    <template #body>
      <UAlert
        v-if="!viewer"
        color="info"
        variant="subtle"
        icon="i-lucide-file-text"
        title="This browser can't show the PDF here"
        description="Download it or open it in a new tab."
        data-testid="cv-pdf-no-viewer"
      />
      <!-- Fixed viewport-relative height: the frame has no content height of its own to size the body. -->
      <div v-else class="relative h-[65dvh]">
        <UAlert
          v-if="gaveUp && !loaded"
          color="warning"
          variant="subtle"
          title="The preview is not loading"
          description="Open the PDF in a new tab instead."
          data-testid="cv-pdf-gave-up"
        />
        <template v-else>
          <USkeleton v-if="!loaded" class="absolute inset-0" data-testid="cv-pdf-loading" />
          <iframe
            v-if="blobUrl"
            :src="blobUrl"
            title="Tailored CV PDF preview"
            class="relative size-full rounded-md border-0"
            data-testid="cv-pdf-frame"
            @load="onLoad"
          />
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <p v-if="slow && !loaded && !gaveUp" class="text-sm text-muted">
          Taking a while. You can open the PDF in a new tab.
        </p>
        <span v-else />
        <div class="flex flex-wrap gap-2">
          <UButton
            :to="url"
            download
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            data-testid="cv-pdf-download"
            >Download</UButton
          >
          <!-- The fetched copy when there is one, so the new tab shows the PDF instead of saving it. -->
          <UButton
            :to="blobUrl ?? url"
            external
            target="_blank"
            icon="i-lucide-external-link"
            :color="promoteOpen ? 'primary' : 'neutral'"
            :variant="promoteOpen ? 'solid' : 'outline'"
            data-testid="cv-pdf-open"
            >Open PDF</UButton
          >
          <UButton color="neutral" variant="ghost" @click="open = false">Close</UButton>
          <UButton
            v-if="applicable"
            icon="i-lucide-check"
            data-testid="cv-pdf-apply"
            @click="emit('apply')"
            >Record with this CV</UButton
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
