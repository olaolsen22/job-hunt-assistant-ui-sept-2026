<script setup lang="ts">
// Sets or replaces one provider's API key. The key lives only in this field while the modal is
// open: it goes up as a mutation variable and is cleared on close, saved or not.
// save returns the API's message, or nothing once saved.
const {
  provider,
  replacing = false,
  save,
  saving = false
} = defineProps<{
  provider: string
  replacing?: boolean
  save: (provider: string, apiKey: string) => Promise<string | undefined>
  saving?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const toastSuccess = useSuccessToast()

const state = reactive({ apiKey: '' })
const error = ref('')
watch(open, () => {
  state.apiKey = ''
  error.value = ''
})
watch(
  () => state.apiKey,
  () => (error.value = '')
)

const validate = (s: Partial<typeof state>) =>
  s.apiKey?.trim() ? [] : [{ name: 'apiKey', message: 'Enter the API key' }]

const submit = async () => {
  const message = await save(provider, state.apiKey.trim())
  if (message) return void (error.value = message)
  open.value = false
  toastSuccess(`${providerLabel(provider)} key saved`)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="`${replacing ? 'Replace' : 'Set'} ${providerLabel(provider)} key`"
    description="The key is stored encrypted and never shown again."
    :state="state"
    :validate="validate"
    :loading="saving"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="API key" name="apiKey">
        <UInput
          v-model="state.apiKey"
          type="password"
          autocomplete="off"
          class="w-full"
          data-testid="provider-key-input"
        />
      </UFormField>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        data-testid="provider-key-error"
      />
    </div>
  </AppFormModal>
</template>
