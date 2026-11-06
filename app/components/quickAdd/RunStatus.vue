<script setup lang="ts">
import type { QuickAddPaste } from '~/composables/useQuickAddPaste'

// Progress of a collected jobs run, and what to do when a batch fails or the run ends.
const { paste } = defineProps<{ paste: QuickAddPaste; saving: boolean }>()
defineEmits<{ edit: []; restart: [] }>()

const { prepared, needsConfirm, safetyMessage } = paste
const { status, batches, completed, total, currentBatch, skipped, unprocessed, error, errorCode } =
  paste.batchRun
const title = computed(() => {
  if (status.value === 'stopped') return 'Processing incomplete'
  if (status.value === 'paused') return 'Processing paused'
  if (status.value === 'finished')
    return skipped.value ? 'Finished with skipped jobs' : 'Processing complete'
  return 'Processing jobs'
})
</script>

<template>
  <UCard data-testid="quick-add-processing">
    <div class="space-y-3">
      <h2 class="font-semibold text-highlighted">{{ title }}</h2>
      <UProgress
        :model-value="completed"
        :max="total"
        :get-value-label="() => 'Processing jobs'"
        :get-value-text="(value, max) => `${value ?? 0} of ${max} jobs processed`"
        data-testid="quick-add-progress"
      />
      <p
        role="status"
        aria-live="polite"
        class="text-sm text-muted"
        data-testid="quick-add-progress-status"
      >
        {{ completed }} of {{ total }} jobs processed · Batch {{ currentBatch }} of
        {{ batches.length }}
      </p>
      <p v-if="prepared" class="text-sm text-muted">
        {{ prepared.remaining + prepared.skipped }} collected · {{ prepared.skipped }} skipped
        before AI · {{ prepared.remaining }} ready
      </p>
      <AppAiRetryConfirm
        v-if="status === 'paused' && needsConfirm"
        :message="safetyMessage"
        @retry="paste.retryConfirmed()"
      />
      <UAlert
        v-else-if="status === 'paused'"
        color="error"
        icon="i-lucide-circle-alert"
        :title="`Batch ${currentBatch} failed`"
        :description="error"
        data-testid="quick-add-batch-error"
      >
        <template v-if="errorCode === 'daily-limit-reached'" #actions>
          <AppAiLimitLink />
        </template>
      </UAlert>
      <div v-if="status === 'paused'" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <UButton v-if="!needsConfirm" data-testid="quick-add-retry" @click="paste.batchRun.retry()"
          >Retry batch</UButton
        >
        <UButton
          color="neutral"
          variant="subtle"
          data-testid="quick-add-skip"
          @click="paste.batchRun.skip()"
          >Skip batch and continue</UButton
        >
        <UButton
          color="neutral"
          variant="ghost"
          data-testid="quick-add-stop"
          @click="paste.batchRun.stop()"
          >Stop and review</UButton
        >
      </div>
      <template v-if="status === 'finished' || status === 'stopped'">
        <p class="text-sm text-muted" data-testid="quick-add-terminal-counts">
          {{ completed }} processed · {{ skipped }} skipped after failure ·
          {{ unprocessed }} unprocessed
        </p>
        <p v-if="completed" class="text-sm text-muted">Review the drafts below, then save.</p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="saving"
            data-testid="quick-add-edit-collected"
            @click="$emit('edit')"
            >Edit collected jobs</UButton
          >
          <UButton
            color="neutral"
            variant="subtle"
            :disabled="saving"
            data-testid="quick-add-restart"
            @click="$emit('restart')"
            >Restart processing</UButton
          >
        </div>
      </template>
    </div>
  </UCard>
</template>
