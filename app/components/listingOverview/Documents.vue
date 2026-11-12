<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'

const { documents } = defineProps<{ documents: ListingOverview['documents'] }>()

const KIND_LABEL = { CV: 'CV', COVER_LETTER: 'Cover letter' } as const

const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const sorted = computed(() =>
  documents.toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
)
</script>

<template>
  <ul class="space-y-3">
    <li
      v-for="doc in sorted"
      :key="doc.id"
      class="flex items-start gap-2"
      data-testid="overview-document"
    >
      <UIcon name="i-lucide-file-text" class="mt-0.5 size-4 shrink-0 text-muted" />
      <div class="min-w-0 space-y-1">
        <p class="text-sm font-medium break-all">{{ doc.fileName }}</p>
        <p class="text-xs text-muted">
          {{
            [KIND_LABEL[doc.kind], documentOriginLabel(doc), size(doc.sizeBytes)]
              .filter(Boolean)
              .join(' · ')
          }}
        </p>
        <p class="flex flex-wrap items-center gap-2 text-xs text-muted">
          <UBadge v-if="doc.sentAt" color="success" variant="subtle" size="sm" icon="i-lucide-send"
            >Sent {{ formatDateTime(doc.sentAt) }}</UBadge
          >
          <span v-else>Not sent</span>
          <span>Created {{ formatDateTime(doc.createdAt) }}</span>
        </p>
      </div>
    </li>
  </ul>
</template>
