<script setup lang="ts">
// The latest generated PDF under an editor: its name and date, Preview, and Delete while unsent.
defineProps<{
  pdf: { fileName: string; createdAt: string; sentAt?: string | null }
  // False when the editor's content is newer than the PDF; `older-than` names that content.
  current: boolean
  olderThan: string
  testidPrefix: string
}>()
defineEmits<{ preview: []; delete: [] }>()
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-2"
    :data-testid="`${testidPrefix}-latest-pdf`"
  >
    <!-- Name and date on their own lines, so a narrow column (phones, the 2xl aside) keeps the
         name readable; whether the PDF is current is a badge, since it decides the next step. -->
    <div class="min-w-0 flex-1 text-sm">
      <p class="flex min-w-0 items-center gap-2">
        <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
        <span class="truncate" :title="pdf.fileName">{{ pdf.fileName }}</span>
      </p>
      <p class="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted">
        {{ formatDateTime(pdf.createdAt) }}
        <UBadge v-if="!current" color="warning" variant="subtle" size="sm"
          >Older than the {{ olderThan }}</UBadge
        >
      </p>
    </div>
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-eye"
        color="neutral"
        variant="subtle"
        size="sm"
        :data-testid="`${testidPrefix}-latest-pdf-preview`"
        @click="$emit('preview')"
        >Preview</UButton
      >
      <UButton
        v-if="!pdf.sentAt"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        aria-label="Delete unsent PDF"
        :data-testid="`${testidPrefix}-delete-pdf`"
        @click="$emit('delete')"
      />
    </div>
  </div>
</template>
