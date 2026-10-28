<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
// url: the link typed in the modal (add page only), so the page can put it in the form.
const emit = defineEmits<{ apply: [draft: Record<string, unknown>, url?: string] }>()

// listingId: set on the edit page; the API reads the saved listing's URL. Without it (add page)
// From link takes a link typed here, prefilled with url (the form's Ad link).
const props = defineProps<{ listingId?: number; url?: string }>()

const prompt = useParsePrompt('listingParsePrompt')
const {
  loadPrompt,
  copy,
  copyLink,
  parsing,
  parse,
  parsingUrl,
  parseFromUrl,
  parsingNewUrl,
  parseNewUrl,
  needsConfirm,
  safetyMessage,
  confirmRetry
} = prompt

const link = ref('')

// Fetched on open and after each parse, so the counter shows what this parse just used.

// What the AI is given, in both methods: the ad's link or its pasted text. Your own AI starts on
// text, since it must be able to open web pages to read a link.
type Source = 'link' | 'text'
const source = ref<Source>('link')
const builtinSources = [
  { label: 'From link', value: 'link' },
  { label: 'Paste ad', value: 'text' }
]
const ownSources = [
  { label: 'Ad link', value: 'link' },
  { label: 'Ad text', value: 'text' }
]

// The pasted ad is shared by both methods, so a failed parse keeps it when the user switches.
const ad = ref('')
const linkValid = computed(() => isHttpUrl(link.value.trim()))
const canCopy = computed(() => (source.value === 'link' ? linkValid.value : !!ad.value.trim()))
const copyPrompt = () => (source.value === 'link' ? copyLink(link.value) : copy(ad.value))
const json = ref('')
// The technical reason behind a generic error, shown small below it.
const errorDetail = ref('')

// immediate: the edit page can mount this already open (?analyze), and a watcher alone would miss that.
const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: (openTab) => {
    link.value = props.url ?? ''
    source.value = openTab.value === 'own' ? 'text' : 'link'
    loadPrompt()
  }
})

// Closing mid-parse would throw the result away.
const busy = computed(() => parsing.value || parsingUrl.value || parsingNewUrl.value)
// The chosen source has what a built-in parse needs (the saved link counts on an edit page).
const canParse = computed(() =>
  source.value === 'link' ? !!props.listingId || !!link.value.trim() : !!ad.value.trim()
)

watch([json, ad, link, source], () => (error.value = ''))
watch(error, (value) => {
  if (!value) errorDetail.value = ''
})

const apply = (reply: string) => {
  const draft = parseDraft(reply)
  if (!draft) return false
  method.value = tab.value === 'own' ? 'own' : 'builtin'
  const url = props.listingId ? '' : link.value.trim()
  if (url) emit('apply', draft, url)
  else emit('apply', draft)
  ad.value = ''
  json.value = ''
  open.value = false
  return true
}

const applyReply = () => {
  if (!apply(json.value)) error.value = INVALID_DRAFT_JSON
}

const showFailure = (reply: { error: string; code?: string; detail?: string }) => {
  error.value = reply.error
  errorCode.value = reply.code
  errorDetail.value = reply.detail ?? ''
}

const parseUrl = async () => {
  error.value = ''
  const reply = props.listingId
    ? await parseFromUrl(props.listingId)
    : await parseNewUrl(link.value)
  refreshUsage()
  if ('error' in reply) showFailure(reply)
  else if (!apply(reply.result)) error.value = INVALID_DRAFT_JSON
}

const parseBuiltIn = async () => {
  error.value = ''
  const reply = await parse(ad.value)
  refreshUsage()
  if ('error' in reply) showFailure(reply)
  else if (!apply(reply.result)) error.value = INVALID_DRAFT_JSON
}

// The last run may have been billed without a result; only this explicit choice sends another.
const retryConfirmed = () => {
  confirmRetry()
  if (source.value === 'link') parseUrl()
  else parseBuiltIn()
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Analyze the ad with AI"
    description="Fills the form from the job ad. Nothing is saved until you save the listing."
    :busy="busy"
  >
    <AppAiMethodTabs v-model="tab" :disabled="busy" />

    <!-- Built-in AI runs on the backend's AI key; your own AI doesn't. -->
    <!-- Locked while a parse runs, and the source while a retry waits, so the retry (and the
       result) belong to the input that was sent. -->
    <fieldset v-if="tab === 'builtin'" :disabled="busy" class="min-w-0 space-y-4">
      <URadioGroup
        v-model="source"
        legend="Ad source"
        :items="builtinSources"
        orientation="horizontal"
        variant="card"
        :disabled="busy || needsConfirm"
        data-testid="parse-source"
      />
      <template v-if="source === 'link'">
        <p v-if="listingId" class="text-sm text-muted">
          Reads the ad from the listing’s saved link, so changes to the link in the form aren’t used
          until you save them. Takes up to 25 seconds. Some sites can’t be read; paste the ad
          instead.
        </p>
        <UFormField v-else label="Ad link" help="Takes up to 25 seconds.">
          <UInput
            v-model="link"
            type="url"
            placeholder="https://"
            class="w-full"
            data-testid="parse-link"
          />
        </UFormField>
      </template>
      <UFormField v-else label="Paste the ad">
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
    </fieldset>

    <template v-if="tab === 'builtin'">
      <AppAiCostNotice :usage="usage" data-testid="parse-cost-notice" />
      <AppAiRetryConfirm
        v-if="needsConfirm"
        :message="safetyMessage"
        :loading="busy"
        :disabled="!canParse"
        @retry="retryConfirmed"
      />
      <AppAiErrorAlert
        v-else-if="error"
        :title="error"
        :code="errorCode"
        :detail="errorDetail"
        :data-testid="source === 'link' ? 'parse-url-error' : 'parse-builtin-error'"
      >
        <!-- Unreadable pages (login walls, JS-built ads) are common; the link is kept for the paste parse. -->
        <UButton
          v-if="source === 'link' && !listingId"
          color="neutral"
          variant="soft"
          icon="i-lucide-clipboard-paste"
          data-testid="parse-paste-instead"
          @click="source = 'text'"
          >Paste the ad instead</UButton
        >
      </AppAiErrorAlert>
    </template>

    <AppAiOwnSteps
      v-else
      v-model:reply="json"
      :ai="prompt"
      :copy="copyPrompt"
      :copy-disabled="!canCopy"
      :start-step="2"
      :reply-help="
        listingId || link.trim() ? undefined : 'The ad URL isn’t included; add it in the form.'
      "
      :reply-error="error"
      testid-prefix="parse"
    >
      <template #before>
        <URadioGroup
          v-model="source"
          legend="1. Give the AI the ad"
          :items="ownSources"
          orientation="horizontal"
          variant="card"
          data-testid="parse-ai-source"
        />
        <UFormField
          v-if="source === 'link'"
          label="Ad link"
          help="The AI must be able to open web pages. If it can’t read the ad, use Ad text."
          :error="
            link.trim() && !linkValid ? 'Enter a link starting with http:// or https://' : undefined
          "
        >
          <UInput
            v-model="link"
            type="url"
            placeholder="https://"
            class="w-full"
            data-testid="parse-ai-link"
          />
        </UFormField>
        <!-- Shared with the built-in Paste ad, so a failed built-in parse keeps the ad here. -->
        <UTextarea
          v-else
          v-model="ad"
          :rows="6"
          :maxrows="12"
          autoresize
          placeholder="The full job ad text"
          aria-label="The job ad"
          class="w-full"
          data-testid="parse-ad"
        />
      </template>
    </AppAiOwnSteps>

    <template #actions>
      <UButton
        v-if="tab === 'builtin' && source === 'link'"
        icon="i-lucide-sparkles"
        :loading="parsingUrl || parsingNewUrl"
        :disabled="!canParse || needsConfirm"
        data-testid="parse-url"
        @click="parseUrl"
        >Analyze from link</UButton
      >
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="parsing"
        :disabled="!canParse || needsConfirm"
        data-testid="parse-builtin-run"
        @click="parseBuiltIn"
        >Analyze ad</UButton
      >
      <UButton v-else :disabled="!json.trim()" data-testid="parse-apply" @click="applyReply"
        >Fill form</UButton
      >
    </template>
  </AppAiModal>
</template>
