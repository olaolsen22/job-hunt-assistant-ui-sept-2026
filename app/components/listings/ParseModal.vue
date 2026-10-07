<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [draft: Record<string, unknown>] }>()

// listingId: set on the edit page. Parsing from the link reads the saved listing's URL on the API
// side, so that tab only exists for saved listings.
const props = defineProps<{ listingId?: number }>()

const { instructions, copied, load, copy, parsing, parse, parsingUrl, parseFromUrl } =
  useParsePrompt('listingParsePrompt')

// Fetched on open and after each parse, so the counter shows what this parse just used.
const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const tokens = new Intl.NumberFormat()
const usage = computed(() => usageData.value?.llmUsageToday)

type Tab = 'link' | 'paste' | 'ai'
const tab = ref<Tab>(props.listingId ? 'link' : 'paste')

// The pasted ad is shared by the Paste ad and Use your own AI tabs, so a failed parse keeps it
// when the user switches to the other method.
const ad = ref('')
const json = ref('')
const jsonError = ref('')
const urlError = ref('')
const builtInError = ref('')

const INVALID_JSON = 'That doesn’t look like valid JSON.'

// Closing mid-parse would throw the result away.
const busy = computed(() => parsing.value || parsingUrl.value)

const tabs = computed(() => [
  ...(props.listingId
    ? [{ label: 'From link', value: 'link', icon: 'i-lucide-link', disabled: busy.value }]
    : []),
  { label: 'Paste ad', value: 'paste', icon: 'i-lucide-clipboard-paste', disabled: busy.value },
  { label: 'Use your own AI', value: 'ai', icon: 'i-lucide-bot', disabled: busy.value }
])

// immediate: the edit page can mount this already open (?analyze), and a watcher alone would miss that.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    load()
    refreshUsage()
  },
  { immediate: true }
)

watch(open, () => (urlError.value = builtInError.value = ''))
watch(json, () => (jsonError.value = ''))
watch(ad, () => (builtInError.value = ''))

const apply = (reply: string) => {
  // AIs often wrap the JSON in a code fence or a sentence, so take the outermost object.
  const raw = reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)
  let draft: Record<string, unknown>
  try {
    draft = JSON.parse(raw)
  } catch {
    return false
  }
  emit('apply', draft)
  ad.value = ''
  json.value = ''
  open.value = false
  return true
}

const applyReply = () => {
  if (!apply(json.value)) jsonError.value = INVALID_JSON
}

const parseUrl = async () => {
  urlError.value = ''
  const reply = await parseFromUrl(props.listingId!)
  refreshUsage()
  if ('error' in reply) urlError.value = reply.error
  else if (!apply(reply.result)) urlError.value = INVALID_JSON
}

const parseBuiltIn = async () => {
  builtInError.value = ''
  const reply = await parse(ad.value)
  refreshUsage()
  if ('error' in reply) builtInError.value = reply.error
  else if (!apply(reply.result)) builtInError.value = INVALID_JSON
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Analyze ad"
    description="Fill in the form from the job ad."
    :dismissible="!busy"
  >
    <template #body>
      <div class="space-y-4">
        <!-- content=false: the tabs only switch `tab`; the panels below are ordinary markup. -->
        <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

        <!-- From link and Paste ad both run on the backend's AI key, which costs money; Use your
             own AI doesn't. No price: the UI doesn't know it. -->
        <UAlert
          v-if="tab !== 'ai'"
          color="warning"
          variant="subtle"
          icon="i-lucide-coins"
          title="Uses the app’s paid AI key"
          data-testid="parse-cost-notice"
        >
          <template #description>
            <p>Each parse is billed to the app’s AI account.</p>
            <template v-if="usage">
              <p data-testid="parse-usage-tokens">
                {{ tokens.format(usage.inputTokens) }} tokens in ·
                {{ tokens.format(usage.outputTokens) }} out
              </p>
              <p data-testid="parse-usage-requests">
                {{
                  usage.requestsLimit != null
                    ? `${usage.requests} of ${usage.requestsLimit}`
                    : usage.requests
                }}
                requests
              </p>
            </template>
          </template>
        </UAlert>

        <div v-if="tab === 'link'" class="space-y-3">
          <p class="text-sm text-muted">
            Reads the ad from the listing’s saved link, so changes to the link in the form aren’t
            used until you save them. Takes up to 25 seconds. Some sites can’t be read; paste the ad
            instead.
          </p>
          <UAlert
            v-if="urlError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="urlError"
            data-testid="parse-url-error"
          />
        </div>

        <template v-else>
          <UFormField :label="tab === 'ai' ? '1. Paste the ad' : 'Paste the ad'">
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

          <UAlert
            v-if="tab === 'paste' && builtInError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="builtInError"
            data-testid="parse-builtin-error"
          />

          <template v-if="tab === 'ai'">
            <div class="space-y-2">
              <p class="text-sm font-medium text-highlighted">
                2. Copy the prompt and run it in ChatGPT, Gemini or Claude
              </p>
              <UButton
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                :color="copied ? 'success' : 'primary'"
                variant="subtle"
                :loading="!instructions"
                :disabled="!ad.trim()"
                data-testid="parse-copy-prompt"
                @click="copy(ad)"
              >
                {{ copied ? 'Copied' : 'Copy prompt' }}
              </UButton>
            </div>

            <UFormField
              label="3. Paste the reply"
              :help="listingId ? undefined : 'The ad URL isn’t included; add it in the form.'"
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
          </template>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" :disabled="busy" @click="open = false"
          >Cancel</UButton
        >
        <UButton
          v-if="tab === 'link'"
          icon="i-lucide-link"
          :loading="parsingUrl"
          data-testid="parse-url"
          @click="parseUrl"
          >Parse from link</UButton
        >
        <UButton
          v-else-if="tab === 'paste'"
          icon="i-lucide-sparkles"
          :loading="parsing"
          :disabled="!ad.trim()"
          data-testid="parse-builtin-run"
          @click="parseBuiltIn"
          >Parse ad</UButton
        >
        <UButton v-else :disabled="!json.trim()" data-testid="parse-apply" @click="applyReply"
          >Use this reply</UButton
        >
      </div>
    </template>
  </UModal>
</template>
