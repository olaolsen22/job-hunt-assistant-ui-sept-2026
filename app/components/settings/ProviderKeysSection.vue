<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// The owner's own API keys, one row per provider the API supports. Only the last four characters
// ever come back.
const { keys, status, error, saving, setKey, removing, removeKey } = useProviderKeys()

const editing = ref<{ provider: string; replacing: boolean }>()
const keyOpen = ref(false)
const edit = (provider: string, replacing: boolean) => {
  editing.value = { provider, replacing }
  keyOpen.value = true
}

const removeTarget = ref<string>()
const removeOpen = ref(false)
const askRemove = (provider: string) => {
  removeTarget.value = provider
  removeOpen.value = true
}
const remove = async () => {
  if (removeTarget.value && (await removeKey(removeTarget.value))) removeOpen.value = false
}
</script>

<template>
  <AppCard title="Provider keys" data-testid="settings-provider-keys">
    <p class="mb-4 text-sm text-muted">
      Run built-in AI on your own account with a provider. Its models then show under AI model, and
      runs on them are billed to that account.
    </p>
    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />
    <div v-else-if="status === 'idle' || status === 'pending'" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
    </div>
    <ul v-else class="divide-y divide-default">
      <li
        v-for="key in keys"
        :key="key.provider"
        class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        data-testid="provider-key-row"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-highlighted">{{ providerLabel(key.provider) }}</span>
            <UBadge v-if="key.configured" color="success" variant="subtle"
              >Key •••• {{ key.last4 }}</UBadge
            >
            <UBadge v-else color="neutral" variant="subtle">Not set</UBadge>
          </div>
          <p v-if="key.configured && key.createdAt" class="text-sm text-muted">
            Added {{ formatDateTime(key.createdAt) }}
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            :data-testid="`provider-key-${key.configured ? 'replace' : 'set'}`"
            @click="edit(key.provider, key.configured)"
            >{{ key.configured ? 'Replace' : 'Set key' }}</UButton
          >
          <UButton
            v-if="key.configured"
            color="error"
            variant="ghost"
            data-testid="provider-key-remove"
            @click="askRemove(key.provider)"
            >Remove</UButton
          >
        </div>
      </li>
    </ul>

    <SettingsProviderKeyModal
      v-if="editing"
      v-model:open="keyOpen"
      :provider="editing.provider"
      :replacing="editing.replacing"
      :save="setKey"
      :saving="saving"
    />
    <AppConfirmModal
      v-model:open="removeOpen"
      :title="`Remove the ${providerLabel(removeTarget ?? '')} key?`"
      description="Models that run on this key stop being available until you set a key again."
      confirm-label="Remove"
      :loading="removing"
      @confirm="remove"
    />
  </AppCard>
</template>
