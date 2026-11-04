<script setup lang="ts">
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'

// Previews a generated PDF with the browser's own PDF reader in an iframe. The file is fetched and
// framed as a local blob, so the API's Content-Disposition can never turn the preview into a
// download; Download stays a separate, manual action. An iframe gives no error event, so a slow or
// failed preview is handled with timers and the fetch result, surfacing Open PDF instead.
// A browser without a built-in PDF viewer (phones, or one set to download PDFs) would still save a
// framed PDF on its own, so it gets a notice instead of the frame. `applicable` offers Apply with
// this CV (Saved listings). `url` is the PDF's same-origin path: a stored document or a rendered
// CV template version.
const {
  url,
  fileName,
  applicable = false
} = defineProps<{
  url: string
  fileName: string
  applicable?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [] }>()

// Only read in the browser, where the dialog's body renders (it's closed during SSR).
const viewer = import.meta.client ? navigator.pdfViewerEnabled !== false : true
// An app added to the iOS Home Screen ignores `download` links, so Download does nothing there;
// it saves through the share sheet (Save to Files) instead. `standalone` exists only on iOS.
const shareToSave = import.meta.client
  ? (navigator as Navigator & { standalone?: boolean }).standalone === true
  : false

const SLOW_MS = 10_000
const GIVE_UP_MS = 30_000

const file = ref<File>()
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
  file.value = undefined
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
      const data = await $fetch<Blob>(url, { responseType: 'blob' })
      if (current !== request || !open.value) return
      file.value = new File([data], fileName, { type: 'application/pdf' })
      blobUrl.value = URL.createObjectURL(file.value)
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
// Shares the previewed copy, or fetches one when the preview hasn't got it.
const toast = useToast()
const save = async () => {
  try {
    const pdf =
      file.value ??
      new File([await $fetch<Blob>(url, { responseType: 'blob' })], fileName, {
        type: 'application/pdf'
      })
    await navigator.share({ files: [pdf] })
  } catch (error) {
    // Closing the share sheet without choosing anything.
    if (error instanceof DOMException && error.name === 'AbortError') return
    toast.add({
      color: 'error',
      title: "Couldn't save the PDF",
      description: 'Open the PDF and save it from there.'
    })
  }
}

// Apply stays the one primary action; without it a stuck preview promotes Open PDF.
const promoteOpen = computed(() => (slow.value || gaveUp.value) && !applicable)
</script>

<template>
  <!-- A fixed height on larger screens (full screen on phones) lets the frame fill the body; the
       frame has no content height of its own. Phones drop the body padding so the PDF gets the
       whole width. Shared by CVs and cover letters, hence the neutral title. -->
  <UModal
    v-model:open="open"
    title="PDF preview"
    :description="fileName"
    :ui="{
      content: `${viewer ? 'sm:max-w-5xl sm:h-[85dvh]' : ''} ${PHONE_FULLSCREEN_MODAL}`,
      body: 'flex flex-col max-sm:p-0'
    }"
  >
    <template #body>
      <div
        v-if="!viewer || (gaveUp && !loaded)"
        class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
        :data-testid="viewer ? 'cv-pdf-gave-up' : 'cv-pdf-no-viewer'"
      >
        <UIcon
          :name="viewer ? 'i-lucide-file-warning' : 'i-lucide-file-text'"
          class="size-10 text-dimmed"
        />
        <p class="font-medium text-highlighted">
          {{ viewer ? 'The preview is not loading' : "This browser can't show the PDF here" }}
        </p>
        <p class="text-sm text-muted">
          {{
            viewer ? 'Open the PDF in a new tab instead.' : 'Download it or open it in a new tab.'
          }}
        </p>
      </div>
      <div v-else class="relative flex-1">
        <USkeleton v-if="!loaded" class="absolute inset-0" data-testid="cv-pdf-loading" />
        <iframe
          v-if="blobUrl"
          :src="blobUrl"
          title="PDF preview"
          class="absolute inset-0 size-full border-0 sm:rounded-md"
          data-testid="cv-pdf-frame"
          @load="onLoad"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p v-if="slow && !loaded && !gaveUp" class="text-sm text-muted">
          Taking a while. You can open the PDF in a new tab.
        </p>
        <span v-else class="max-sm:hidden" />
        <!-- Phones: Download and Open PDF share a row, Record spans below it within thumb reach;
             the header's X replaces Close. -->
        <div class="grid grid-cols-2 gap-2 sm:flex">
          <!-- external: a plain <a>, since NuxtLink would route to /api/... instead of downloading. -->
          <UButton
            v-if="shareToSave"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            class="justify-center"
            data-testid="cv-pdf-download"
            @click="save"
            >Download</UButton
          >
          <UButton
            v-else
            :to="url"
            external
            :download="fileName"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            class="justify-center"
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
            class="justify-center"
            data-testid="cv-pdf-open"
            >Open PDF</UButton
          >
          <UButton color="neutral" variant="ghost" class="max-sm:hidden" @click="open = false"
            >Close</UButton
          >
          <UButton
            v-if="applicable"
            icon="i-lucide-check"
            class="col-span-2 justify-center"
            data-testid="cv-pdf-apply"
            @click="emit('apply')"
            >Record with this CV</UButton
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
