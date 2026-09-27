<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [draft: Record<string, unknown>] }>()

const PROMPT_QUERY = `query ListingParsePrompt { listingParsePrompt { instructions } }`

// Built-in parsing needs `llmParseAvailable` / `parseListing`, which the API doesn't have yet.
const MODES = [
  { label: 'Paste JSON reply', value: 'paste' },
  { label: 'Built-in parse (coming soon)', value: 'builtin', disabled: true }
]

const toast = useToast()
const instructions = ref('')
const ad = ref('')
const json = ref('')
const jsonError = ref('')
const mode = ref('paste')
const copied = ref(false)

// Fetched on open, not on click: browsers can refuse a clipboard write that follows an await.
watch(open, async (isOpen) => {
  if (!isOpen) return
  try {
    const data = await gql<{ listingParsePrompt: { instructions: string } }>(PROMPT_QUERY)
    instructions.value = data.listingParsePrompt.instructions
  } catch {
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error', icon: 'i-lucide-circle-alert' })
  }
})

watch(json, () => (jsonError.value = ''))

const copyPrompt = async () => {
  await navigator.clipboard.writeText(
    `${instructions.value}\n\n<posting>\n${ad.value.trim()}\n</posting>`
  )
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const apply = () => {
  // AIs often wrap the JSON in a code fence or a sentence, so take the outermost object.
  const raw = json.value.slice(json.value.indexOf('{'), json.value.lastIndexOf('}') + 1)
  let draft: Record<string, unknown>
  try {
    draft = JSON.parse(raw)
  } catch {
    jsonError.value = 'That doesn’t look like valid JSON.'
    return
  }
  emit('apply', draft)
  ad.value = ''
  json.value = ''
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Parse listing from ad"
    description="Paste the ad, run the prompt in ChatGPT, Gemini or Claude, then paste back its reply."
  >
    <template #body>
      <div class="space-y-6">
        <div class="space-y-3">
          <UFormField label="1. Paste the ad">
            <UTextarea
              v-model="ad"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The full job ad text"
              class="w-full"
              data-testid="parse-ad"
            />
          </UFormField>
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="copied ? 'success' : 'primary'"
            variant="subtle"
            :loading="!instructions"
            :disabled="!ad.trim()"
            data-testid="parse-copy-prompt"
            @click="copyPrompt"
          >
            {{ copied ? 'Copied' : 'Copy prompt' }}
          </UButton>
        </div>

        <USeparator />

        <div class="space-y-3">
          <UFormField label="2. Paste the reply">
            <URadioGroup v-model="mode" orientation="horizontal" :items="MODES" />
          </UFormField>
          <UFormField
            help="The ad URL isn’t included; add it in the form."
            :error="jsonError || undefined"
          >
            <UTextarea
              v-model="json"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The JSON the AI returned"
              class="w-full font-mono"
              data-testid="parse-json"
            />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
        <UButton :disabled="!json.trim()" data-testid="parse-apply" @click="apply"
          >Use this JSON</UButton
        >
      </div>
    </template>
  </UModal>
</template>
