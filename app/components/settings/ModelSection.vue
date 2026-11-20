<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// The model every built-in AI action runs on, and what the next run costs against. A guest gets
// one model from the API, so only the summary shows; the owner picks from the list.
const { owner = false } = defineProps<{ owner?: boolean }>()

const { models, defaultModel, error, refresh, label, setDefault, saving } = useLlmModels()
const current = computed(() => models.value.find((m) => m.id === defaultModel.value))

const { data: usageData } = useLlmUsage()
const {
  ownKey,
  cap,
  state,
  loading: capLoading
} = useRequestCap(() => usageData.value?.llmUsageToday, current)

// Gemini always runs, on the app's key or the owner's; other providers need a key first. The
// guest never sees keys, so the list is only fetched for the owner.
const keys = owner ? useProviderKeys().keys : computed(() => [])
const unconnected = computed(() =>
  keys.value
    .filter((k) => !k.configured && k.provider !== 'gemini')
    .map((k) => providerLabel(k.provider))
)

const keyText = (m: { provider: string; keySource: string }) =>
  m.keySource === 'USER' ? `Your ${providerLabel(m.provider)} key` : 'App’s key'
// Grouped by provider; the API's order is kept within one.
const items = computed(() =>
  [...models.value]
    .sort((a, b) => providerLabel(a.provider).localeCompare(providerLabel(b.provider)))
    .map((m) => ({
      label: m.label,
      value: m.id,
      description: `${providerLabel(m.provider)} · ${m.keySource === 'USER' ? 'Your key' : 'App’s key'}`
    }))
)

const toast = useAppToast()
// The group is bound to the saved default, so a failed save (already toasted) leaves it as is.
// Undo saves the previous model by id: an owner who was on the app default stays on that model.
const pick = async (id: string) => {
  const previous = defaultModel.value
  if ((await setDefault(id)) && previous && previous !== id)
    toast.undoable(`Default model: ${label(id)}`, () => void setDefault(previous))
}
const resetToAppDefault = async () => {
  if (await setDefault(null))
    toast.success(`Using the app default, ${current.value?.label ?? defaultModel.value}`)
}
</script>

<template>
  <AppCard id="model" title="AI model" class="scroll-mt-20" data-testid="settings-ai-model">
    <div v-if="error" class="space-y-3">
      <UAlert color="error" :description="ERROR_MESSAGES.generic" />
      <UButton color="neutral" variant="subtle" icon="i-lucide-refresh-cw" @click="refresh()"
        >Try again</UButton
      >
    </div>
    <!-- Only the first load: a refetch after a key change keeps the card in place. -->
    <div v-else-if="!models.length" class="space-y-3">
      <USkeleton class="h-6 w-full sm:w-2/3" />
      <USkeleton class="h-5 w-full sm:w-1/2" />
      <template v-if="owner">
        <USkeleton v-for="i in 3" :key="i" class="h-16 w-full" />
        <USkeleton class="h-10 w-full sm:w-2/3" />
      </template>
    </div>
    <div v-else class="space-y-5">
      <!-- What the next run uses and who pays: the question this page answers first. -->
      <div class="space-y-2" data-testid="settings-model-summary">
        <p class="text-highlighted">
          Next AI action uses
          <span class="font-semibold" data-testid="settings-model-current">{{
            current?.label ?? defaultModel
          }}</span>
        </p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <UBadge
            v-if="current"
            :color="ownKey ? 'info' : 'warning'"
            variant="subtle"
            :icon="ownKey ? 'i-lucide-key-round' : 'i-lucide-coins'"
            >{{ keyText(current) }}</UBadge
          >
          <USkeleton v-if="capLoading" class="h-5 w-40" />
          <template v-else-if="cap">
            <UBadge v-if="state === 'paused'" color="warning" variant="subtle">Paused</UBadge>
            <UBadge v-else-if="state === 'reached'" color="error" variant="subtle"
              >Limit reached</UBadge
            >
            <UBadge v-else-if="state === 'near'" color="warning" variant="subtle"
              >{{ cap.left }} left today</UBadge
            >
            <span v-if="state === 'paused'">AI won’t run on this key.</span>
            <span v-else data-testid="settings-model-cap"
              >{{ cap.used
              }}<template v-if="cap.max != null"> of {{ cap.max }}</template> today<template
                v-if="cap.pooled && cap.max != null"
              >
                for all users</template
              ><template v-if="!cap.pooled && cap.max == null"> · no daily limit</template
              ><template v-if="cap.max != null">
                · resets {{ formatDateTime(cap.resetsAt) }}</template
              ></span
            >
            <ULink
              v-if="owner && ownKey && state !== 'unlimited'"
              to="#keys"
              class="font-medium text-primary"
              >Change limit</ULink
            >
          </template>
        </div>
      </div>

      <template v-if="owner && models.length > 1">
        <URadioGroup
          :model-value="defaultModel"
          :items="items"
          variant="card"
          legend="Default model"
          :disabled="saving"
          data-testid="settings-llm-model"
          @update:model-value="pick"
        />
        <div class="space-y-1 text-sm text-muted">
          <p>
            <ULink
              as="button"
              class="font-medium text-primary"
              :disabled="saving"
              data-testid="settings-model-reset"
              @click="resetToAppDefault"
              >Reset to app default</ULink
            >
            · lets the app choose a model on its own key.
          </p>
          <p v-if="unconnected.length" data-testid="settings-model-connect">
            Connect {{ unconnected.join(' or ') }} to add their models.
            <ULink to="#keys" class="font-medium text-primary">Your keys</ULink>
          </p>
        </div>
      </template>
      <p v-else-if="!owner" class="text-sm text-muted">
        Every built-in AI action runs on this model, on the app’s key.
      </p>
      <p v-else class="text-sm text-muted">This is the only model available.</p>
    </div>
  </AppCard>
</template>
