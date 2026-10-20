<script setup lang="ts">
import { SUCCESS_TOAST_DURATION } from '~/constants/ui'
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
// A dropped change stays in the list so it can be restored; it just isn't applied.
type Row = { key: number; skillIds: number[]; names: string[]; dropped: boolean }
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
// Long lists start collapsed; changes and removals always start open.
const COLLAPSE_AFTER = 8
const sectionOpen = reactive({
  changes: true,
  translations: true,
  categories: true,
  removals: true
})
const body = useTemplateRef<HTMLElement>('body')
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

const hasProblem = (row: Row) => !row.dropped && (isInvalid(row) || hasBlank(row) || !namesOk(row))
const activeRows = computed(() => rows.value?.filter((r) => !r.dropped) ?? [])
const problems = computed(
  () =>
    (rows.value?.filter(hasProblem).length ?? 0) +
    translationRows.value.filter((t) => !t.name.trim()).length
)
// Zero outside the review, so translations left from a previous plan don't count.
const acceptedCategories = computed(() => categoryRows.value.filter((c) => c.accepted))
const changeCount = computed(() =>
  rows.value
    ? activeRows.value.length +
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
// The API rejects a removal that is also part of an operation. Dropping the operation frees it.
const operationIds = computed(() => new Set(activeRows.value.flatMap((r) => r.skillIds)))
const removalName = (row: RemovalRow) => skillNames.value.get(row.skillId)!
const selectableRemovals = computed(() =>
  removalRows.value.filter((x) => !operationIds.value.has(x.skillId))
)
const acceptedRemovals = computed(() => selectableRemovals.value.filter((x) => x.accepted))
const summary = computed(() => {
  const chips: { section: keyof typeof sectionOpen; label: string; count: number }[] = [
    { section: 'changes', label: 'skill changes', count: rows.value?.length ?? 0 },
    { section: 'translations', label: 'translations', count: translationRows.value.length },
    { section: 'categories', label: 'categories', count: categoryRows.value.length },
    { section: 'removals', label: 'removals', count: removalRows.value.length }
  ]
  return chips.filter((c) => c.count > 0)
})
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
  rows.value?.map((r) => [r.skillIds, r.names, r.dropped]),
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
  rows.value = operations.map((op) => ({ key: nextKey++, dropped: false, ...op }))
  translationRows.value = translations.map((t) => ({ key: nextKey++, ...t }))
  categoryRows.value = categories.map((c) => ({ key: nextKey++, accepted: true, ...c }))
  // A removal of a skill we can't find can't be shown or applied.
  const known = removals.filter((x) => names.value.has(x.skillId))
  skippedRemovals.value = removals.length - known.length
  removalRows.value = known.map((x) => ({ key: nextKey++, accepted: false, ...x }))
  sectionOpen.changes = true
  sectionOpen.translations = translations.length <= COLLAPSE_AFTER
  sectionOpen.categories = categories.length <= COLLAPSE_AFTER
  sectionOpen.removals = true
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

const removeTranslation = (row: TranslationRow) =>
  (translationRows.value = translationRows.value.filter((t) => t !== row))

// The summary chips and "Fix N items first" open the section first: a collapsed one has no
// visible content to scroll to.
const goTo = async (section: keyof typeof sectionOpen) => {
  sectionOpen[section] = true
  await nextTick()
  body.value?.querySelector(`[data-section="${section}"]`)?.scrollIntoView({ block: 'start' })
}
const fixFirstProblem = async () => {
  if (!rows.value?.some(hasProblem)) sectionOpen.translations = true
  await nextTick()
  const first = body.value?.querySelector<HTMLElement>('[data-invalid]')
  first?.scrollIntoView({ block: 'center' })
  first?.querySelector<HTMLElement>('input')?.focus()
}

const apply = () => {
  if (!canApply.value || busy.value) return
  if (acceptedRemovals.value.length) removeConfirmOpen.value = true
  else applyPlan()
}
const applyPlan = async () => {
  removeConfirmOpen.value = false
  applyError.value = ''
  const result = await api.apply({
    operations: activeRows.value.map((r) => ({
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
  toast.add({ title: 'Skills cleaned up', color: 'success', duration: SUCCESS_TOAST_DURATION })
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
      <div v-if="rows" ref="body" class="space-y-4">
        <AppAiReviewEmpty
          v-if="!hasSuggestions"
          icon="i-lucide-sparkles"
          text="Nothing to clean up"
          data-testid="cleanup-empty"
        />
        <!-- Jump links: a long plan can be scanned by kind. Scrolls sideways on phones. -->
        <nav
          v-else
          aria-label="Jump to a kind of suggestion"
          class="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap"
        >
          <UButton
            v-for="chip in summary"
            :key="chip.section"
            size="xs"
            color="neutral"
            variant="outline"
            class="shrink-0"
            :data-testid="`cleanup-jump-${chip.section}`"
            @click="goTo(chip.section)"
            >{{ chip.count }} {{ chip.label }}</UButton
          >
        </nav>

        <ProfileSkillCleanupSection
          v-if="rows.length"
          v-model:open="sectionOpen.changes"
          data-section="changes"
          title="Skill changes"
          :count="rows.length"
          :summary="`${activeRows.length} kept`"
        >
          <ul class="space-y-3">
            <ProfileSkillCleanupOperation
              v-for="row in rows"
              :key="row.key"
              v-model:names="row.names"
              v-model:dropped="row.dropped"
              :kind="kind(row)"
              :current="currentNames(row)"
              :unknown="isInvalid(row)"
              :problem="hasProblem(row)"
            />
          </ul>
        </ProfileSkillCleanupSection>

        <!-- Names refer to the skills after the changes above, so they can't be tied to a card. -->
        <ProfileSkillCleanupSection
          v-if="translationRows.length"
          v-model:open="sectionOpen.translations"
          data-section="translations"
          title="Translated names"
          :count="translationRows.length"
        >
          <p class="text-sm text-muted">Applied after the skill changes above.</p>
          <ul class="space-y-3">
            <li
              v-for="t in translationRows"
              :key="t.key"
              :data-invalid="!t.name.trim() || undefined"
              data-testid="cleanup-translation"
            >
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
        </ProfileSkillCleanupSection>

        <ProfileSkillCleanupSection
          v-if="categoryRows.length"
          v-model:open="sectionOpen.categories"
          data-section="categories"
          title="Categories"
          :count="categoryRows.length"
          :summary="`${acceptedCategories.length} selected`"
        >
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
        </ProfileSkillCleanupSection>

        <!-- Last and framed in red: the only suggestions that can't be undone. Select all skips rows blocked by a change. -->
        <ProfileSkillCleanupSection
          v-if="removalRows.length || skippedRemovals"
          v-model:open="sectionOpen.removals"
          data-section="removals"
          title="Skills to remove"
          :count="removalRows.length"
          :summary="`${acceptedRemovals.length} selected`"
          danger
        >
          <p v-if="removalRows.length" class="text-sm text-muted">
            Permanent. A removed skill also disappears from your profile, listings, and
            experience/project tags.
          </p>
          <AppAiReviewSelectAll
            v-if="selectableRemovals.length"
            :selected="acceptedRemovals.length"
            :total="selectableRemovals.length"
            @all="selectableRemovals.forEach((x) => (x.accepted = true))"
            @none="selectableRemovals.forEach((x) => (x.accepted = false))"
          />
          <ul class="space-y-2">
            <li
              v-for="x in removalRows"
              :key="x.key"
              class="rounded-md border border-default bg-default p-3"
              data-testid="cleanup-removal"
            >
              <UCheckbox
                v-model="x.accepted"
                color="error"
                :label="removalName(x)"
                :description="
                  operationIds.has(x.skillId) ? `Used by a change above. ${x.reason}` : x.reason
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
        </ProfileSkillCleanupSection>
      </div>

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
        :title="`Nothing was changed, and your edits are kept. ${applyError}`"
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
      <UButton
        color="error"
        variant="link"
        size="sm"
        class="p-0"
        data-testid="cleanup-problems"
        @click="fixFirstProblem"
        >Fix {{ problems }} {{ problems === 1 ? 'item' : 'items' }} first</UButton
      >
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
              ? `Apply ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}${
                  acceptedRemovals.length ? ` (${acceptedRemovals.length} permanent)` : ''
                }`
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
