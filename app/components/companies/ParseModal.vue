<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
// apply: the page uses the reply; it returns a message when it can't, which keeps the modal open
// with that error (a prop, since an emit can't answer).
// companyName: research that one company for its edit form (like the listing modal's `listingId`);
// without it the modal adds companies from a list of names (add page).
// initialText: names to start the list from (picked on the companies list).
const {
  apply,
  companyName = undefined,
  initialText = ''
} = defineProps<{
  apply: (reply: string) => string | undefined
  companyName?: string
  initialText?: string
}>()

const single = computed(() => companyName !== undefined)
const copyText = computed(() =>
  single.value
    ? {
        title: 'Research this company with AI',
        description: 'Fill in the form from what the AI finds about this company.',
        help: 'Only empty fields are filled. Your saved values are kept.',
        run: 'Research company',
        apply: 'Fill form'
      }
    : {
        title: 'Research companies with AI',
        description: 'Adds companies, with their details, to the list from names or a page.',
        help: 'Details like description, links, size and skills come with each row. Nothing is saved until you save the list.',
        run: 'Research companies',
        apply: 'Add to list'
      }
)

const prompt = useParsePrompt('companyParsePrompt')
const {
  loadPrompt,
  copy,
  parsing,
  parse,
  parsingNewUrl,
  parseNewUrl,
  needsConfirm,
  safetyMessage,
  confirmRetry
} = prompt
const busy = computed(() => parsing.value || parsingNewUrl.value)

// One company can also be researched from a page about it (its site, a LinkedIn or register page),
// like the listing modal's From link. Built-in only: your own AI may not be able to open pages.
type Source = 'name' | 'link'
const source = ref<Source>('name')
const SOURCES = [
  { label: 'Company name', value: 'name' },
  { label: 'From link', value: 'link' }
]
const link = ref('')
const fromLink = computed(() => single.value && source.value === 'link')
const canRun = computed(() => (fromLink.value ? isHttpUrl(link.value.trim()) : !!text.value.trim()))

// Fetched on open and after each parse, so the counter shows what this parse just used.

// What the AI is given, shared by both methods so a failed parse keeps it when the user switches.
const text = ref('')
const json = ref('')
// The technical reason behind a generic error, shown small below it.
const errorDetail = ref('')

const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => {
    // Only into an empty field, so text kept after a failed parse is still there on reopening.
    const start = companyName ?? initialText
    if (start && !text.value.trim()) text.value = start
    loadPrompt()
  }
})

watch([json, text, link, source], () => (error.value = ''))
watch(error, (value) => {
  if (!value) errorDetail.value = ''
})

const applyReply = (reply: string) => {
  const problem = apply(reply)
  if (problem) {
    error.value = problem
    return
  }
  method.value = tab.value === 'own' ? 'own' : 'builtin'
  text.value = ''
  json.value = ''
  link.value = ''
  open.value = false
}

const parseBuiltIn = async () => {
  error.value = ''
  const reply = fromLink.value ? await parseNewUrl(link.value) : await parse(text.value)
  refreshUsage()
  if ('error' in reply) {
    error.value = reply.error
    errorCode.value = reply.code
    errorDetail.value = reply.detail ?? ''
  } else applyReply(reply.result)
}

// The last run may have been billed without a result; only this explicit choice sends another.
const retryConfirmed = () => {
  confirmRetry()
  void parseBuiltIn()
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    :title="copyText.title"
    :description="copyText.description"
    :busy="busy"
  >
    <AppAiMethodTabs v-model="tab" :disabled="busy" />

    <template v-if="tab === 'builtin'">
      <!-- Locked while a retry waits, so the retry belongs to the input that was sent. -->
      <URadioGroup
        v-if="single"
        v-model="source"
        legend="Research from"
        :items="SOURCES"
        orientation="horizontal"
        variant="card"
        :disabled="busy || needsConfirm"
        data-testid="companies-parse-source"
      />
      <UFormField
        v-if="fromLink"
        label="Page about the company"
        :help="`Its website, LinkedIn or a register page. Takes up to 25 seconds. ${copyText.help}`"
      >
        <UInput
          v-model="link"
          type="url"
          placeholder="https://"
          class="w-full"
          data-testid="companies-parse-link"
        />
      </UFormField>
      <!-- One company: its name (editable, e.g. to add the town); a list: names or a page. -->
      <UFormField v-else-if="single" label="Company" :help="copyText.help">
        <UInput
          v-model="text"
          placeholder="Company name"
          class="w-full"
          data-testid="companies-parse-text"
        />
      </UFormField>
      <UFormField
        v-else
        label="Company names, or a page that lists companies"
        :help="copyText.help"
      >
        <UTextarea
          v-model="text"
          :rows="6"
          :maxrows="12"
          autoresize
          placeholder="The names or the page text"
          class="w-full"
          data-testid="companies-parse-text"
        />
      </UFormField>

      <AppAiCostNotice :usage="usage" data-testid="companies-parse-cost-notice" />
      <AppAiRetryConfirm
        v-if="needsConfirm"
        :message="safetyMessage"
        :loading="busy"
        :disabled="!canRun"
        @retry="retryConfirmed"
      />
      <AppAiErrorAlert
        v-else-if="error"
        :title="error"
        :code="errorCode"
        :detail="errorDetail"
        data-testid="companies-parse-error"
      />
    </template>

    <AppAiOwnSteps
      v-else
      v-model:reply="json"
      :ai="prompt"
      :copy="() => copy(text)"
      :copy-disabled="!text.trim()"
      :start-step="2"
      :reply-help="copyText.help"
      :reply-error="error"
      testid-prefix="companies-parse"
    >
      <!-- Shared with the built-in tab, so a failed built-in parse keeps the text here. -->
      <template #before>
        <UFormField v-if="single" label="1. Name the company">
          <UInput
            v-model="text"
            placeholder="Company name"
            class="w-full"
            data-testid="companies-parse-text"
          />
        </UFormField>
        <UFormField v-else label="1. Paste company names, or a page that lists companies">
          <UTextarea
            v-model="text"
            :rows="6"
            :maxrows="12"
            autoresize
            placeholder="The names or the page text"
            class="w-full"
            data-testid="companies-parse-text"
          />
        </UFormField>
      </template>
    </AppAiOwnSteps>

    <template #actions>
      <UButton
        v-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="!canRun || needsConfirm"
        data-testid="companies-parse-run"
        @click="parseBuiltIn"
        >{{ copyText.run }}</UButton
      >
      <UButton
        v-else
        :disabled="!json.trim()"
        data-testid="companies-parse-apply"
        @click="applyReply(json)"
        >{{ copyText.apply }}</UButton
      >
    </template>
  </AppAiModal>
</template>
