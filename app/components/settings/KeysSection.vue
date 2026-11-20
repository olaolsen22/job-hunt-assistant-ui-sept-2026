<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { LlmCallLimit } from '~/composables/useProviderKeys'

// Owner only: one row per provider the API supports, with its key and its daily limit. Only the
// last four characters of a key ever come back.
const { keys, error, refresh, saving, setKey, removing, removeKey } = useProviderKeys()
const {
  limits,
  status: limitsStatus,
  error: limitsError,
  refresh: refreshLimits,
  saving: savingLimit,
  setLimit
} = useLlmCallLimits()
// Until limits load, a row can't tell "no limit" from "not known yet", so editing waits.
const limitsReady = computed(() => !!limits.value.length)
const { defaultModel, label } = useLlmModels()
const toast = useAppToast()

const limitFor = (provider: string) => limits.value.find((l) => l.provider === provider)

const editing = ref<{ provider: string; replacing: boolean }>()
const keyOpen = ref(false)
const editKey = (provider: string, replacing: boolean) => {
  editing.value = { provider, replacing }
  keyOpen.value = true
}

// The API lists every provider's limit, so one can be set before the first key.
const editingLimit = ref<LlmCallLimit>()
const limitOpen = ref(false)
const editLimit = (provider: string) => {
  editingLimit.value = limitFor(provider)
  limitOpen.value = !!editingLimit.value
}

const removeTarget = ref<string>()
const removeOpen = ref(false)
const askRemove = (provider: string) => {
  removeTarget.value = provider
  removeOpen.value = true
}
const remove = async () => {
  const before = defaultModel.value
  if (!removeTarget.value || !(await removeKey(removeTarget.value))) return
  removeOpen.value = false
  toast.success(`${providerLabel(removeTarget.value)} key removed`)
  // The server falls back to the app default without saying so; say it here.
  if (defaultModel.value && defaultModel.value !== before)
    toast.info(`Default is now ${label(defaultModel.value)} (app’s key)`)
}
</script>

<template>
  <AppCard id="keys" title="Your keys" class="scroll-mt-20" data-testid="settings-provider-keys">
    <p class="mb-4 text-sm text-muted">
      Your own key bills that provider directly and lets you set a daily cap.
    </p>
    <div v-if="error" class="space-y-3">
      <UAlert color="error" :description="ERROR_MESSAGES.generic" />
      <UButton color="neutral" variant="subtle" icon="i-lucide-refresh-cw" @click="refresh()"
        >Try again</UButton
      >
    </div>
    <!-- Only the first load: the refetch after a key change keeps the rows in place. -->
    <div v-else-if="!keys.length" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-14 w-full" />
    </div>
    <ul v-else class="divide-y divide-default">
      <SettingsProviderRow
        v-for="key in keys"
        :key="key.provider"
        :provider-key="key"
        :limit="limitFor(key.provider)"
        :limit-disabled="!limitsReady"
        @connect="editKey(key.provider, false)"
        @replace="editKey(key.provider, true)"
        @remove="askRemove(key.provider)"
        @limit="editLimit(key.provider)"
      />
    </ul>
    <UAlert
      v-if="limitsError && limitsStatus !== 'pending'"
      color="error"
      variant="subtle"
      class="mt-4"
      description="Daily limits couldn’t load."
      :actions="[
        { label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => refreshLimits() }
      ]"
      data-testid="settings-limits-error"
    />

    <SettingsProviderKeyModal
      v-if="editing"
      v-model:open="keyOpen"
      :provider="editing.provider"
      :replacing="editing.replacing"
      :save="setKey"
      :saving="saving"
    />
    <SettingsDailyLimitModal
      v-if="editingLimit"
      v-model:open="limitOpen"
      :limit="editingLimit"
      :save="setLimit"
      :saving="savingLimit"
    />
    <AppConfirmModal
      v-model:open="removeOpen"
      :title="`Remove the ${providerLabel(removeTarget ?? '')} key?`"
      description="Its models stop working. If one is your default, AI switches to the app default until you reconnect. Your daily limit is kept."
      confirm-label="Remove key"
      :loading="removing"
      @confirm="remove"
    />
  </AppCard>
</template>
