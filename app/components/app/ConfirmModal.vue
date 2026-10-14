<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  disabled?: boolean
  // `error` for actions that delete more than one row and can't be undone.
  color?: 'primary' | 'error'
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" :dismissible="!loading">
    <!-- Form modals put their fields here; a plain confirm has no body. -->
    <template v-if="$slots.default" #body>
      <slot />
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="open = false"
          >Cancel</UButton
        >
        <UButton
          :color="color"
          :loading="loading"
          :disabled="disabled"
          data-testid="confirm-modal-confirm"
          @click="emit('confirm')"
          >{{ confirmLabel ?? 'Confirm' }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
