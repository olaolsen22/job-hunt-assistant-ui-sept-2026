<script setup lang="ts">
import type { LlmCallLimit } from '~/composables/useProviderKeys'

// One provider's daily allowance. The API reads null as no limit and 0 as paused, which a plain
// number field can't say clearly, so those are choices of their own.
const {
  limit,
  save,
  saving = false
} = defineProps<{
  limit: LlmCallLimit
  save: (provider: string, dailyRequestLimit: number | null) => Promise<string | undefined>
  saving?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const { success: toastSuccess } = useAppToast()

type Mode = 'none' | 'paused' | 'daily'
const MODES = [
  { label: 'No limit', value: 'none' },
  { label: 'Pause', value: 'paused', description: 'No AI calls on this key until you change it.' },
  { label: 'Daily allowance', value: 'daily' }
]
const modeOf = (value: number | null): Mode =>
  value == null ? 'none' : value === 0 ? 'paused' : 'daily'

const state = reactive<{ mode: Mode; daily: number | undefined }>({
  mode: 'none',
  daily: undefined
})
const error = ref('')
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    state.mode = modeOf(limit.dailyRequestLimit)
    state.daily = limit.dailyRequestLimit || undefined
    error.value = ''
  },
  { immediate: true }
)

const validate = (s: Partial<typeof state>) =>
  s.mode === 'daily' && !(s.daily && s.daily >= 1)
    ? [{ name: 'daily', message: 'Enter at least 1 request' }]
    : []

const submit = async () => {
  const value = state.mode === 'none' ? null : state.mode === 'paused' ? 0 : state.daily!
  const message = await save(limit.provider, value)
  if (message) return void (error.value = message)
  open.value = false
  toastSuccess(`${providerLabel(limit.provider)} limit saved`)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="`${providerLabel(limit.provider)} daily limit`"
    description="Counts built-in AI requests on your own key. Resets every day."
    :state="state"
    :validate="validate"
    :loading="saving"
    @submit="submit"
  >
    <div class="space-y-4">
      <URadioGroup v-model="state.mode" :items="MODES" data-testid="daily-limit-mode" />
      <UFormField v-if="state.mode === 'daily'" label="Requests per day" name="daily">
        <UInputNumber
          v-model="state.daily"
          :min="1"
          :step="1"
          class="w-full sm:w-48"
          data-testid="daily-limit-input"
        />
      </UFormField>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        data-testid="daily-limit-error"
      />
    </div>
  </AppFormModal>
</template>
