<script setup lang="ts">
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'

// Previews a generated PDF with the browser's own PDF reader in an iframe. An iframe gives no error
// event (an error page also fires `load`), so a slow or blocked preview is handled with timers
// that surface the Open PDF link instead.
const { documentId } = defineProps<{ documentId: number; fileName: string }>()
const open = defineModel<boolean>('open', { required: true })

const SLOW_MS = 10_000
const GIVE_UP_MS = 30_000

const loaded = ref(false)
const slow = ref(false)
const gaveUp = ref(false)
let timers: ReturnType<typeof setTimeout>[] = []
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}

// The iframe only exists while open, so every open fetches the file again.
watch(
  open,
  (isOpen) => {
    clearTimers()
    loaded.value = slow.value = gaveUp.value = false
    if (!isOpen) return
    timers = [
      setTimeout(() => (slow.value = true), SLOW_MS),
      setTimeout(() => (gaveUp.value = true), GIVE_UP_MS)
    ]
  },
  { immediate: true }
)
onScopeDispose(clearTimers)

const onLoad = () => {
  loaded.value = true
  clearTimers()
}
const url = computed(() => `/api/documents/${documentId}`)
</script>

<template>
  <UModal
    v-model:open="open"
    title="CV preview"
    :description="fileName"
    :ui="{ content: `max-w-4xl ${PHONE_FULLSCREEN_MODAL}` }"
  >
    <template #body>
      <!-- Fixed viewport-relative height: the frame has no content height of its own to size the body. -->
      <div class="relative h-[65dvh]">
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
            :src="url"
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
        <div class="flex gap-2">
          <UButton
            :to="url"
            target="_blank"
            icon="i-lucide-external-link"
            :color="slow || gaveUp ? 'primary' : 'neutral'"
            :variant="slow || gaveUp ? 'solid' : 'outline'"
            data-testid="cv-pdf-open"
            >Open PDF</UButton
          >
          <UButton color="neutral" variant="ghost" @click="open = false">Close</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
