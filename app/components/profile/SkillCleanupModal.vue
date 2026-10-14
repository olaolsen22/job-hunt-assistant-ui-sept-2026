<script setup lang="ts">
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'
import { INVALID_DRAFT_JSON } from '~/utils/parseDraft'
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type { CleanupPlan, CleanupTranslation } from '~/composables/useSkillCleanup'

// Two ways to get a plan (built-in AI, or your own AI via copy/paste), then a review where each
// operation can be edited or removed. Nothing changes until Apply, which is all-or-nothing.
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const api = useSkillCleanup()
const { busy, instructions, promptLoading, promptError, copied, needsConfirm, safetyMessage } = api
const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const usage = computed(() => usageData.value?.llmUsageToday)
const toast = useToast()

const MAX_NAMES = 10
type Row = { key: number; skillIds: number[]; names: string[] }
type TranslationRow = CleanupTranslation & { key: number }

const tab = ref('builtin')
const reply = ref('')
const error = ref('')
const errorCode = ref<string>()
const applyError = ref('')
const skillNames = ref(new Map<number, string>())
const rows = ref<Row[]>()
const translationRows = ref<TranslationRow[]>([])
let nextKey = 0

const unknownIds = (row: Row) => row.skillIds.filter((id) => !skillNames.value.has(id))
const isInvalid = (row: Row) => !row.skillIds.length || unknownIds(row).length > 0
const hasBlank = (row: Row) => row.names.some((n) => !n.trim())
const namesOk = (row: Row) => row.names.length >= 1 && row.names.length <= MAX_NAMES
const kind = (row: Row) =>
  row.names.length > 1 ? 'Split' : row.skillIds.length > 1 ? 'Merge' : 'Rename'
const currentNames = (row: Row) =>
  row.skillIds.map((id) => skillNames.value.get(id) ?? `Unknown skill #${id}`).join(', ')

const languageLabel = (t: CleanupTranslation) =>
  LANGUAGE_OPTIONS.find((o) => o.value === t.language)!.label

const problems = computed(
  () =>
    (rows.value?.filter((r) => isInvalid(r) || hasBlank(r) || !namesOk(r)).length ?? 0) +
    translationRows.value.filter((t) => !t.name.trim()).length
)
// Zero outside the review, so translations left from a previous plan don't count.
const changeCount = computed(() =>
  rows.value ? rows.value.length + translationRows.value.length : 0
)
const canApply = computed(() => !!changeCount.value && !problems.value)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    // Loaded on open: a clipboard write that follows an await can be refused.
    api.loadPrompt()
    refreshUsage()
    error.value = ''
  },
  { immediate: true }
)
watch([reply, tab], () => (error.value = ''))
watch(error, (value) => {
  if (!value) errorCode.value = undefined
})

const startReview = async ({ operations, translations }: CleanupPlan) => {
  // Names are only needed to label the plan, so a plan that can't be shown isn't opened.
  const names = await api.loadSkillNames()
  if (names.error !== undefined) {
    error.value = names.error
    return
  }
  skillNames.value = names.value
  rows.value = operations.map((op) => ({ key: nextKey++, ...op }))
  translationRows.value = translations.map((t) => ({ key: nextKey++, ...t }))
  applyError.value = ''
}
const suggest = async () => {
  error.value = ''
  const result = await api.suggest()
  refreshUsage()
  if (result.error !== undefined) {
    error.value = result.error
    errorCode.value = result.code
    return
  }
  await startReview(result.value)
}
const retryConfirmed = () => {
  api.confirmRetry()
  suggest()
}
const preview = async () => {
  const plan = parseCleanupReply(reply.value)
  // The paste stays in the box so it can be fixed.
  if (!plan) {
    error.value = `${INVALID_DRAFT_JSON} Expect an "operations" list.`
    return
  }
  await startReview(plan)
}

const removeRow = (row: Row) => (rows.value = rows.value!.filter((r) => r !== row))
const removeTranslation = (row: TranslationRow) =>
  (translationRows.value = translationRows.value.filter((t) => t !== row))
const addName = (row: Row) => row.names.push('')
const removeName = (row: Row, i: number) => row.names.splice(i, 1)

const apply = async () => {
  if (!canApply.value || busy.value) return
  applyError.value = ''
  const result = await api.apply({
    operations: rows.value!.map((r) => ({
      skillIds: r.skillIds,
      names: r.names.map((n) => n.trim())
    })),
    translations: translationRows.value.map(({ skillName, language, name }) => ({
      skillName,
      language,
      name: name.trim()
    }))
  })
  if (result.error !== undefined) {
    applyError.value = result.error
    return
  }
  // Merged-away skills are gone, so cached listing and CV-draft data may point at deleted ids.
  clearNuxtData((key) => key.startsWith('listing-') || key.startsWith('tailored-cv-draft-'))
  emit('changed')
  toast.add({ title: 'Skills cleaned up', color: 'success' })
  rows.value = undefined
  reply.value = ''
  open.value = false
}

const close = () => {
  if (busy.value) return
  open.value = false
}
const modalOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!value) close()
  }
})
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    title="Clean up skills"
    :description="
      rows
        ? 'Review the plan. Nothing changes until you apply it.'
        : 'Merge duplicates, fix spelling and split combined skills.'
    "
    :dismissible="!busy"
    :ui="{ content: `max-w-4xl ${PHONE_FULLSCREEN_MODAL}` }"
  >
    <template #body>
      <div class="space-y-4">
        <AppAiRetryConfirm
          v-if="needsConfirm && tab === 'builtin' && !rows"
          :message="safetyMessage"
          :loading="busy"
          @retry="retryConfirmed"
        />
        <UAlert
          v-else-if="error && (tab === 'builtin' || rows)"
          color="error"
          variant="subtle"
          :title="error"
          data-testid="cleanup-error"
        >
          <template v-if="errorCode === 'daily-limit-reached'" #actions>
            <AppAiLimitLink />
          </template>
        </UAlert>

        <fieldset :disabled="busy" class="min-w-0 space-y-4">
          <template v-if="rows">
            <div
              v-if="!changeCount"
              class="flex flex-col items-center gap-2 py-8 text-center text-muted"
              data-testid="cleanup-empty"
            >
              <UIcon name="i-lucide-sparkles" class="size-8" />
              <p>Nothing to clean up</p>
            </div>
            <ul v-if="rows.length" class="space-y-3">
              <li
                v-for="row in rows"
                :key="row.key"
                class="space-y-3 rounded-md border border-default p-3"
                data-testid="cleanup-row"
              >
                <div class="flex items-center gap-2">
                  <UBadge
                    :color="isInvalid(row) ? 'error' : 'neutral'"
                    :variant="isInvalid(row) ? 'subtle' : 'outline'"
                    >{{ isInvalid(row) ? 'Invalid' : kind(row) }}</UBadge
                  >
                  <span class="min-w-0 flex-1 text-sm text-muted">{{
                    isInvalid(row) ? 'Unknown skill, so this can’t be applied.' : ''
                  }}</span>
                  <UButton
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    aria-label="Remove this change"
                    data-testid="cleanup-remove"
                    @click="removeRow(row)"
                  />
                </div>
                <AppCompareBlock :current="currentNames(row)" :suggested="row.names.join(', ')">
                  <template v-if="!isInvalid(row)" #suggested>
                    <div class="space-y-2">
                      <div v-for="(_, i) in row.names" :key="i" class="flex items-center gap-2">
                        <UInput
                          v-model="row.names[i]"
                          class="min-w-0 flex-1"
                          :aria-label="`New skill name ${i + 1}`"
                          :color="row.names[i]?.trim() ? undefined : 'error'"
                          data-testid="cleanup-name"
                        />
                        <UButton
                          icon="i-lucide-x"
                          color="neutral"
                          variant="ghost"
                          aria-label="Remove name"
                          :disabled="row.names.length <= 1"
                          @click="removeName(row, i)"
                        />
                      </div>
                      <UButton
                        icon="i-lucide-plus"
                        color="neutral"
                        variant="link"
                        size="sm"
                        :disabled="row.names.length >= MAX_NAMES"
                        data-testid="cleanup-add-name"
                        @click="addName(row)"
                        >Add name</UButton
                      >
                    </div>
                  </template>
                </AppCompareBlock>
              </li>
            </ul>
            <!-- Names refer to the skills after the operations above, so they can't be tied to a row. -->
            <section v-if="translationRows.length" class="space-y-2">
              <h3 class="text-sm font-medium">Translated names</h3>
              <ul class="space-y-3">
                <li v-for="t in translationRows" :key="t.key" data-testid="cleanup-translation">
                  <AppCompareBlock
                    :current="t.skillName"
                    current-label="Skill"
                    :suggested-label="`${languageLabel(t)} name`"
                  >
                    <template #suggested>
                      <div class="flex items-center gap-2">
                        <UInput
                          v-model="t.name"
                          class="min-w-0 flex-1"
                          :aria-label="`${languageLabel(t)} name for ${t.skillName}`"
                          :color="t.name.trim() ? undefined : 'error'"
                          data-testid="cleanup-translation-name"
                        />
                        <UButton
                          icon="i-lucide-trash-2"
                          color="neutral"
                          variant="ghost"
                          :aria-label="`Remove translation for ${t.skillName}`"
                          data-testid="cleanup-translation-remove"
                          @click="removeTranslation(t)"
                        />
                      </div>
                    </template>
                  </AppCompareBlock>
                </li>
              </ul>
            </section>
          </template>

          <template v-else>
            <UTabs
              v-model="tab"
              :items="[
                { label: 'Use built-in AI', value: 'builtin', icon: 'i-lucide-sparkles' },
                { label: 'Use your own AI', value: 'ai', icon: 'i-lucide-bot' }
              ]"
              :content="false"
              class="w-full"
            />
            <template v-if="tab === 'builtin'">
              <AppAiCostNotice :usage="usage" data-testid="cleanup-cost-notice" />
              <p class="text-sm text-muted">
                The AI reads your skill names and proposes merges, renames and splits. You review
                them before anything changes.
              </p>
            </template>
            <template v-else>
              <p class="text-sm text-muted">
                1. Copy the prompt (it lists your skills) and send it to your chosen AI.
              </p>
              <UButton
                :loading="promptLoading"
                :disabled="!instructions"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                :color="copied ? 'success' : 'primary'"
                variant="subtle"
                data-testid="cleanup-copy-prompt"
                @click="api.copyPrompt()"
                >{{ copied ? 'Copied' : 'Copy prompt' }}</UButton
              >
              <UAlert v-if="promptError" color="error" variant="subtle" :title="promptError">
                <template #actions
                  ><UButton color="neutral" variant="soft" @click="api.loadPrompt()"
                    >Retry loading prompt</UButton
                  ></template
                >
              </UAlert>
              <details v-if="instructions" class="text-sm">
                <summary class="cursor-pointer text-muted">View prompt / copy manually</summary>
                <pre class="mt-2 whitespace-pre-wrap break-words">{{ instructions }}</pre>
              </details>
              <UFormField
                label="2. Paste the JSON reply"
                help="You review the plan before anything changes."
                :error="error || undefined"
              >
                <UTextarea
                  v-model="reply"
                  :rows="8"
                  :maxrows="16"
                  autoresize
                  class="w-full font-mono"
                  data-testid="cleanup-json"
                />
              </UFormField>
            </template>
          </template>
        </fieldset>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-3">
        <UAlert
          v-if="applyError"
          color="error"
          variant="subtle"
          :title="applyError"
          class="max-h-40 overflow-y-auto"
          data-testid="cleanup-apply-error"
        />
        <p v-if="changeCount && problems" class="text-sm text-error" data-testid="cleanup-problems">
          {{ problems }} {{ problems === 1 ? 'change needs' : 'changes need' }} fixing or removing
          before you can apply.
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="close">Cancel</UButton>
          <template v-if="rows">
            <UButton
              color="neutral"
              variant="subtle"
              :disabled="busy"
              data-testid="cleanup-back"
              @click="rows = undefined"
              >Back</UButton
            >
            <UButton
              v-if="changeCount"
              :loading="busy"
              :disabled="!canApply"
              data-testid="cleanup-apply"
              @click="apply"
              >{{ `Apply ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}` }}</UButton
            >
          </template>
          <UButton
            v-else-if="tab === 'builtin'"
            :loading="busy"
            :disabled="busy || needsConfirm"
            data-testid="cleanup-suggest"
            @click="suggest"
            >Suggest cleanup</UButton
          >
          <UButton
            v-else
            :loading="busy"
            :disabled="busy || !reply.trim()"
            data-testid="cleanup-preview"
            @click="preview"
            >Preview plan</UButton
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
