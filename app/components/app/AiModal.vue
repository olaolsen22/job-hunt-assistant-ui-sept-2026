<script setup lang="ts">
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'

// The frame every AI modal shares: full screen on phones (the footer stays above the keyboard),
// not closable while a run is busy, and one footer: Back and a count/problem line on the left,
// Cancel then the feature's primary action on the right (primary on top on phones).
// wide: for modals that review results inside them. close: runs instead of closing, e.g. to confirm
// discarding a review.
const {
  description = undefined,
  busy = false,
  wide = false,
  close = undefined
} = defineProps<{
  title: string
  description?: string
  busy?: boolean
  wide?: boolean
  close?: () => void
}>()
const open = defineModel<boolean>('open', { required: true })
defineSlots<{
  default: () => unknown
  actions: () => unknown
  'footer-top'?: () => unknown
  back?: () => unknown
  'footer-info'?: () => unknown
}>()

const requestClose = () => {
  if (busy) return
  if (close) close()
  else open.value = false
}
const modalOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!value) requestClose()
  }
})
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    :title="title"
    :description="description"
    :dismissible="!busy"
    :ui="{ content: `${wide ? 'max-w-4xl' : ''} ${PHONE_FULLSCREEN_MODAL}` }"
  >
    <template #body>
      <div class="space-y-4">
        <slot />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-3">
        <slot name="footer-top" />
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div class="flex min-w-0 flex-wrap items-center gap-2 sm:mr-auto">
            <slot name="back" />
            <slot name="footer-info" />
          </div>
          <div
            class="flex flex-col-reverse gap-2 max-sm:*:w-full max-sm:*:justify-center sm:flex-row"
          >
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="busy"
              data-testid="ai-modal-cancel"
              @click="requestClose"
              >Cancel</UButton
            >
            <slot name="actions" />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
