<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" :dismissible="!loading">
    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="open = false"
          >Cancel</UButton
        >
        <UButton :loading="loading" data-testid="confirm-modal-confirm" @click="emit('confirm')">{{
          confirmLabel ?? 'Confirm'
        }}</UButton>
      </div>
    </template>
  </UModal>
</template>
