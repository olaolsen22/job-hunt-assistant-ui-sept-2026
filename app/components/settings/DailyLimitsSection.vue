<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { LlmCallLimit } from '~/composables/useProviderKeys'

// A cap per personal key, so a busy day can't run up its bill. The app's shared key isn't listed:
// the API doesn't limit it per user.
const { limits, status, error, saving, setLimit } = useLlmCallLimits()

const editing = ref<LlmCallLimit>()
const editOpen = ref(false)
const edit = (limit: LlmCallLimit) => {
  editing.value = limit
  editOpen.value = true
}

const summary = (limit: LlmCallLimit) => {
  if (limit.dailyRequestLimit == null) return `No limit · ${limit.requestsConsumed} used today`
  if (limit.dailyRequestLimit === 0) return 'Paused'
  return `${limit.requestsConsumed} of ${limit.dailyRequestLimit} used · ${limit.remainingRequests ?? 0} left`
}
</script>

<template>
  <AppCard title="Daily limits" data-testid="settings-daily-limits">
    <p class="mb-4 text-sm text-muted">
      Caps built-in AI requests per day on each of your own keys. The app’s shared Gemini key has no
      limit here.
    </p>
    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />
    <div v-else-if="status === 'idle' || status === 'pending'" class="space-y-3">
      <USkeleton v-for="i in 2" :key="i" class="h-10 w-full" />
    </div>
    <div
      v-else-if="!limits.length"
      class="py-6 text-center text-muted"
      data-testid="daily-limits-empty"
    >
      <UIcon name="i-lucide-gauge" class="mb-2 size-8" />
      <p>Add a provider key to set a daily limit.</p>
    </div>
    <ul v-else class="divide-y divide-default">
      <li
        v-for="limit in limits"
        :key="limit.provider"
        class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        data-testid="daily-limit-row"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <span class="font-medium text-highlighted">{{ providerLabel(limit.provider) }}</span>
          <p class="text-sm text-muted" data-testid="daily-limit-summary">{{ summary(limit) }}</p>
          <UProgress
            v-if="limit.dailyRequestLimit"
            :model-value="limit.requestsConsumed"
            :max="limit.dailyRequestLimit"
            size="sm"
            class="max-w-xs"
          />
          <p v-if="limit.dailyRequestLimit !== null" class="text-xs text-muted">
            Resets {{ formatDateTime(limit.resetsAt) }}
          </p>
        </div>
        <UButton
          color="neutral"
          variant="subtle"
          data-testid="daily-limit-edit"
          @click="edit(limit)"
          >Edit limit</UButton
        >
      </li>
    </ul>

    <SettingsDailyLimitModal
      v-if="editing"
      v-model:open="editOpen"
      :limit="editing"
      :save="setLimit"
      :saving="saving"
    />
  </AppCard>
</template>
