<script setup lang="ts">
import { INVALID_DRAFT_JSON } from '~/utils/parseDraft'
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type {
  CleanupCategory,
  CleanupPlan,
  CleanupTranslation
} from '~/composables/useSkillCleanup'

// Two ways to get a plan (built-in AI, or your own AI via copy/paste), then a review where each
// operation can be edited or removed. Nothing changes until Apply, which is all-or-nothing.
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const api = useSkillCleanup()
const { busy, needsConfirm, safetyMessage } = api
const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const usage = computed(() => usageData.value?.llmUsageToday)
const toast = useToast()

const MAX_NAMES = 10
type Row = { key: number; skillIds: number[]; names: string[] }
type TranslationRow = CleanupTranslation & { key: number }

const reply = ref('')
const applyError = ref('')
const skillNames = ref(new Map<number, string>())
const rows = ref<Row[]>()
const translationRows = ref<TranslationRow[]>([])
// Unticked suggestions are left out when applying.
type CategoryRow = CleanupCategory & { key: number; accepted: boolean }
const categoryRows = ref<CategoryRow[]>([])
// Permanent, so every removal starts unticked and only ticked ones are sent.
type RemovalRow = { key: number; skillId: number; reason: string; accepted: boolean }
const removalRows = ref<RemovalRow[]>([])
const skippedRemovals = ref(0)
const discardOpen = ref(false)
const removeConfirmOpen = ref(false)
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
const acceptedCategories = computed(() => categoryRows.value.filter((c) => c.accepted))
const changeCount = computed(() =>
  rows.value
    ? rows.value.length +
      translationRows.value.length +
      acceptedCategories.value.length +
      acceptedRemovals.value.length
    : 0
)
const hasSuggestions = computed(
  () =>
    !!rows.value?.length ||
    !!translationRows.value.length ||
    !!categoryRows.value.length ||
    !!removalRows.value.length
)
// The API rejects a removal that is also part of an operation.
const operationIds = computed(() => new Set(rows.value?.flatMap((r) => r.skillIds)))
const removalName = (row: RemovalRow) => skillNames.value.get(row.skillId)!
const acceptedRemovals = computed(() => removalRows.value.filter((x) => x.accepted))
const canApply = computed(() => !!changeCount.value && !problems.value)

const { method, tab, error, errorCode } = useAiModalState(open, {
  onOpen: () => {
    // Loaded on open: a clipboard write that follows an await can be refused.
    api.loadPrompt()
    refreshUsage()
  }
})
watch([reply, tab], () => (error.value = ''))
const { dirty, mark, clear } = useReviewDirty(() => [
  rows.value?.map((r) => [r.skillIds, r.names]),
  translationRows.value.map((t) => t.name),
  categoryRows.value.map((c) => c.accepted),
  removalRows.value.map((x) => x.accepted)
])

const startReview = async ({ operations, translations, categories, removals }: CleanupPlan) => {
  // Names are only needed to label the plan, so a plan that can't be shown isn't opened.
  const names = await api.loadSkillNames()
  if (names.error !== undefined) {
    error.value = names.error
    return
  }
  skillNames.value = names.value
  rows.value = operations.map((op) => ({ key: nextKey++, ...op }))
  translationRows.value = translations.map((t) => ({ key: nextKey++, ...t }))
  categoryRows.value = categories.map((c) => ({ key: nextKey++, accepted: true, ...c }))
  // A removal of a skill we can't find can't be shown or applied.
  const known = removals.filter((x) => names.value.has(x.skillId))
  skippedRemovals.value = removals.length - known.length
  removalRows.value = known.map((x) => ({ key: nextKey++, accepted: false, ...x }))
  applyError.value = ''
  mark()
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
  method.value = 'builtin'
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
  method.value = 'own'
  await startReview(plan)
}

const removeRow = (row: Row) => (rows.value = rows.value!.filter((r) => r !== row))
const removeTranslation = (row: TranslationRow) =>
  (translationRows.value = translationRows.value.filter((t) => t !== row))
const addName = (row: Row) => row.names.push('')
const removeName = (row: Row, i: number) => row.names.splice(i, 1)

const apply = () => {
  if (!canApply.value || busy.value) return
  if (acceptedRemovals.value.length) removeConfirmOpen.value = true
  else applyPlan()
}
const applyPlan = async () => {
  removeConfirmOpen.value = false
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
    })),
    categories: acceptedCategories.value.map(({ skillName, categoryName }) => ({
      skillName,
      categoryName
    })),
    removals: acceptedRemovals.value.map(({ skillId, reason }) => ({ skillId, reason }))
  })
  if (result.error !== undefined) {
    applyError.value = result.error
    return
  }
  // Merged-away skills are gone, so cached listing and CV-draft data may point at deleted ids.
  clearNuxtData((key) => key.startsWith('listing-') || key.startsWith('tailored-cv-draft-'))
  emit('changed')
  toast.add({ title: 'Skills cleaned up', color: 'success' })
  discard()
}

// Closing a review that was edited asks first; an untouched one just goes.
const discard = () => {
  discardOpen.value = false
  rows.value = undefined
  reply.value = ''
  clear()
  open.value = false
}
const back = () => {
  rows.value = undefined
  clear()
}
const requestClose = () => (dirty.value ? (discardOpen.value = true) : discard())
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Clean up skills"
    :description="
      rows
        ? 'Review the plan. Nothing changes until you apply it.'
        : 'Merge duplicates, fix spelling and split combined skills.'
    "
    :busy="busy"
    :close="requestClose"
    wide
  >
    <AppAiErrorAlert v-if="rows && error" :title="error" data-testid="cleanup-error" />
    <fieldset :disabled="busy" class="min-w-0 space-y-4">
      <template v-if="rows">
        <AppAiReviewEmpty
          v-if="!hasSuggestions"
          icon="i-lucide-sparkles"
          text="Nothing to clean up"
          data-testid="cleanup-empty"
        />
        <ul v-if="rows.length" class="space-y-3">
          <AppAiReviewRow
            v-for="row in rows"
            :key="row.key"
            :badge="isInvalid(row) ? 'Invalid' : kind(row)"
            :invalid="isInvalid(row)"
            :note="isInvalid(row) ? 'Unknown skill, so this can’t be applied.' : ''"
            :current="currentNames(row)"
            :suggested="row.names.join(', ')"
            remove-label="Remove this change"
            testid-prefix="cleanup"
            @remove="removeRow(row)"
          >
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
          </AppAiReviewRow>
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
        <section v-if="categoryRows.length" class="space-y-2">
          <h3 class="text-sm font-medium">Categories</h3>
          <AppAiReviewSelectAll
            :selected="acceptedCategories.length"
            :total="categoryRows.length"
            @all="categoryRows.forEach((c) => (c.accepted = true))"
            @none="categoryRows.forEach((c) => (c.accepted = false))"
          />
          <ul class="space-y-2">
            <li
              v-for="c in categoryRows"
              :key="c.key"
              class="rounded-md border border-default p-3"
              data-testid="cleanup-category"
            >
              <UCheckbox
                v-model="c.accepted"
                :label="`${c.skillName} → ${c.categoryName}`"
                data-testid="cleanup-category-accept"
              />
            </li>
          </ul>
        </section>
        <section v-if="removalRows.length || skippedRemovals" class="space-y-2">
          <h3 class="flex items-center gap-1.5 text-sm font-medium text-error">
            <UIcon name="i-lucide-trash-2" aria-hidden="true" />Skills to remove
          </h3>
          <p v-if="removalRows.length" class="text-sm text-muted">
            Permanent. A removed skill also disappears from your profile, listings, and
            experience/project tags.
          </p>
          <ul class="space-y-2">
            <li
              v-for="x in removalRows"
              :key="x.key"
              class="rounded-md border border-default p-3"
              data-testid="cleanup-removal"
            >
              <UCheckbox
                v-model="x.accepted"
                color="error"
                :label="removalName(x)"
                :description="
                  operationIds.has(x.skillId) ? `Part of a change above. ${x.reason}` : x.reason
                "
                :disabled="operationIds.has(x.skillId)"
                data-testid="cleanup-removal-accept"
              />
            </li>
          </ul>
          <p
            v-if="skippedRemovals"
            class="text-sm text-muted"
            data-testid="cleanup-removal-skipped"
          >
            {{ skippedRemovals }} {{ skippedRemovals === 1 ? 'suggestion' : 'suggestions' }} skipped
            (skill not found).
          </p>
        </section>
      </template>

      <template v-else>
        <AppAiMethodTabs v-model="tab" :disabled="busy" />
        <template v-if="tab === 'builtin'">
          <p class="text-sm text-muted">
            The AI reads your skill names and proposes merges, renames, splits and categories for
            uncategorized skills. You review them before anything changes.
          </p>
          <AppAiCostNotice :usage="usage" data-testid="cleanup-cost-notice" />
          <AppAiRetryConfirm
            v-if="needsConfirm"
            :message="safetyMessage"
            :loading="busy"
            @retry="retryConfirmed"
          />
          <AppAiErrorAlert
            v-else-if="error"
            :title="error"
            :code="errorCode"
            data-testid="cleanup-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="reply"
          :ai="api"
          note="The prompt lists your skills."
          :reply-error="error"
          testid-prefix="cleanup"
        />
      </template>
    </fieldset>

    <template #footer-top>
      <AppAiErrorAlert
        v-if="applyError"
        :title="applyError"
        class="max-h-40 overflow-y-auto"
        data-testid="cleanup-apply-error"
      />
    </template>

    <template v-if="rows" #back>
      <UButton
        color="neutral"
        variant="subtle"
        :disabled="busy"
        data-testid="cleanup-back"
        @click="back"
        >Back</UButton
      >
    </template>
    <template v-if="rows && hasSuggestions && !changeCount" #footer-info>
      <p class="text-sm text-muted" data-testid="cleanup-nothing-selected">Nothing selected.</p>
    </template>
    <template v-else-if="changeCount && problems" #footer-info>
      <p class="text-sm text-error" data-testid="cleanup-problems">
        {{ problems }} {{ problems === 1 ? 'change needs' : 'changes need' }} fixing or removing
        before you can apply.
      </p>
    </template>

    <template #actions>
      <template v-if="rows">
        <UButton
          v-if="hasSuggestions"
          :loading="busy"
          :disabled="!canApply"
          data-testid="cleanup-apply"
          @click="apply"
          >{{
            changeCount
              ? `Apply ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`
              : 'Apply'
          }}</UButton
        >
        <UButton v-else data-testid="cleanup-close" @click="discard">Close</UButton>
      </template>
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
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
        >Preview changes</UButton
      >
    </template>
  </AppAiModal>
  <AppConfirmModal
    v-model:open="removeConfirmOpen"
    :title="`Remove ${acceptedRemovals.length} ${acceptedRemovals.length === 1 ? 'skill' : 'skills'} permanently?`"
    description="They are also removed from your profile, listings, and experience/project tags. This can't be undone."
    confirm-label="Remove and apply"
    color="error"
    @confirm="applyPlan"
  >
    <ul
      class="max-h-48 list-inside list-disc overflow-y-auto text-sm"
      data-testid="cleanup-remove-list"
    >
      <li v-for="x in acceptedRemovals" :key="x.key">{{ removalName(x) }}</li>
    </ul>
  </AppConfirmModal>
  <AppConfirmModal
    v-model:open="discardOpen"
    title="Discard these suggestions?"
    description="Your edits to the AI’s result will be lost."
    confirm-label="Discard"
    @confirm="discard"
  />
</template>
