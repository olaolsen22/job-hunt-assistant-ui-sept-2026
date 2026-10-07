<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [draft: Record<string, unknown>] }>()

const { instructions, copied, load, copy, parsing, parse } = useParsePrompt('listingParsePrompt')
const ad = ref('')
const json = ref('')
const jsonError = ref('')
const builtIn = ref(false)

// immediate: the edit page can mount this already open (?analyze), and a watcher alone would miss that.
watch(open, (isOpen) => isOpen && load(), { immediate: true })

watch(json, () => (jsonError.value = ''))

const apply = (reply: string) => {
  // AIs often wrap the JSON in a code fence or a sentence, so take the outermost object.
  const raw = reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)
  let draft: Record<string, unknown>
  try {
    draft = JSON.parse(raw)
  } catch {
    jsonError.value = 'That doesn’t look like valid JSON.'
    return false
  }
  emit('apply', draft)
  ad.value = ''
  json.value = ''
  open.value = false
  return true
}

const parseBuiltIn = async () => {
  const reply = await parse(ad.value)
  // Failed: show the copy-paste steps, with the ad still filled in.
  if (!reply || !apply(reply)) builtIn.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Parse listing from ad"
    :description="
      builtIn
        ? 'Paste the ad and the built-in parser fills in the form.'
        : 'Paste the ad, run the prompt in ChatGPT, Gemini or Claude, then paste back its reply.'
    "
  >
    <template #body>
      <div class="space-y-6">
        <div class="space-y-3">
          <UCheckbox v-model="builtIn" label="Use built-in parser" data-testid="parse-builtin" />
          <UFormField :label="builtIn ? 'Paste the ad' : '1. Paste the ad'">
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
            v-if="!builtIn"
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

        <template v-if="!builtIn">
          <USeparator />

          <UFormField
            label="2. Paste the reply"
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
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
        <UButton
          v-if="builtIn"
          icon="i-lucide-sparkles"
          :loading="parsing"
          :disabled="!ad.trim()"
          data-testid="parse-builtin-run"
          @click="parseBuiltIn"
          >Parse ad</UButton
        >
        <UButton v-else :disabled="!json.trim()" data-testid="parse-apply" @click="apply(json)"
          >Use this JSON</UButton
        >
      </div>
    </template>
  </UModal>
</template>
