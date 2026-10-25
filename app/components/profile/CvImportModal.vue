<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'
import {
  createCvDraft,
  reviewCvSelection,
  cvFeedback,
  cvSubmissionPaths,
  cvServerIssue,
  cvValueSnapshot,
  cvPathIncluded,
  cvPathRenderable,
  type CvIssue,
  type CvDraft
} from '~/utils/profileCvImport'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const props = defineProps<{ profile: ProfileData; refreshProfile: () => Promise<unknown> }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData] }>()
const api = useProfileCvImport()
const { busy, needsConfirm, safetyMessage } = api
// The built-in tab is "paste"; Back from a review returns to the tab that produced it.
const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState<'paste' | 'own'>(
  open,
  { tabFor: (m) => (m === 'own' ? 'own' : 'paste'), onOpen: () => api.loadPrompt() }
)
const toastSuccess = useSuccessToast()
const cv = ref('')
const json = ref('')
const attempted = ref(false)
const reviewComponent = useTemplateRef('reviewComponent')
const serverIssues = ref<CvIssue[]>([])
const serverValues = ref<Record<string, string>>({})
const saveError = ref('')
const saveDetails = ref('')
const draft = ref<CvDraft>()
const reviewing = ref(false)
const refreshing = ref(false)
const locked = computed(() => busy.value || refreshing.value)
const review = computed(() =>
  draft.value ? reviewCvSelection(draft.value, props.profile) : undefined
)
const activeServerIssues = computed(() =>
  draft.value
    ? serverIssues.value.filter(
        (issue) =>
          cvPathIncluded(draft.value!, issue.path) &&
          serverValues.value[issue.path] === cvValueSnapshot(draft.value!, issue.path)
      )
    : []
)
const feedback = computed(() =>
  draft.value
    ? cvFeedback(draft.value, [...(review.value?.errors ?? []), ...activeServerIssues.value])
    : undefined
)
// One issue per path. Until the first Save attempt, local blockers read as guidance, not errors.
const issues = computed<CvIssue[]>(() =>
  [
    ...activeServerIssues.value,
    ...(review.value?.errors ?? []).map((issue) =>
      attempted.value ? issue : { ...issue, severity: 'warning' as const }
    ),
    ...(feedback.value?.warnings ?? [])
  ].filter((issue, i, all) => all.findIndex((other) => other.path === issue.path) === i)
)
const focusCorrection = async (paths: string[]) => {
  await nextTick()
  await reviewComponent.value?.focusIssue(paths)
}
const inputError = computed(() =>
  tab.value === 'paste'
    ? cv.value.trim().length > 100000
      ? 'CV text must be at most 100,000 characters.'
      : ''
    : json.value.length > 200000
      ? 'JSON must be at most 200,000 characters.'
      : ''
)
// After an interrupted or lost built-in parse, only the retry warning may send another one.
const canParse = computed(
  () =>
    !inputError.value &&
    (tab.value === 'paste' ? !!cv.value.trim() && !needsConfirm.value : !!json.value.trim())
)
const confirmOpen = ref(false)
const pending = ref<'close' | 'replace'>('close')
const requestClose = () => {
  if (locked.value) return
  if (draft.value) {
    pending.value = 'close'
    confirmOpen.value = true
  } else open.value = false
}
watch([cv, json, tab], () => {
  error.value = ''
})
const runParse = async () => {
  if (locked.value || !canParse.value) return
  error.value = ''
  const result = tab.value === 'paste' ? await api.parse(cv.value) : await api.preview(json.value)
  if (tab.value === 'paste') refreshUsage()
  if (result.error !== undefined) {
    error.value = result.error
    errorCode.value = result.code
    return
  }
  method.value = tab.value === 'paste' ? 'builtin' : 'own'
  refreshing.value = true
  try {
    await props.refreshProfile()
    draft.value = createCvDraft(result.value, props.profile)
    attempted.value = false
    serverIssues.value = []
    saveError.value = saveDetails.value = ''
    reviewing.value = true
  } catch {
    error.value = ERROR_MESSAGES.generic
  } finally {
    refreshing.value = false
  }
}
const retryConfirmed = () => {
  api.confirmRetry()
  parse()
}
const parse = () => {
  if (draft.value) {
    pending.value = 'replace'
    confirmOpen.value = true
  } else runParse()
}
const confirm = () => {
  confirmOpen.value = false
  if (pending.value === 'close') {
    draft.value = undefined
    reviewing.value = false
    cv.value = json.value = ''
    open.value = false
  } else runParse()
}
const save = async () => {
  if (locked.value || !review.value?.count || !draft.value) return
  attempted.value = true
  saveError.value = saveDetails.value = ''
  if (review.value.errors.length) {
    await focusCorrection(review.value.errors.map((issue) => issue.path))
    return
  }
  serverIssues.value = []
  const paths = cvSubmissionPaths(draft.value)
  const submittedDraft = draft.value
  const result = await api.save(review.value.selection)
  if (result.error !== undefined) {
    // Only API errors add detail; a network failure's message is already the alert itself.
    if (result.apiErrors?.length) saveDetails.value = result.error
    const mapped: CvIssue[] = []
    const unmapped: string[] = []
    for (const apiError of result.apiErrors ?? []) {
      const issue = cvServerIssue(apiError.message, paths)
      if (issue && apiError.__typename === 'ProfileEntryNotFoundError') {
        issue.path = issue.path.replace(/(?:\.id)?$/, '.id')
        issue.message = 'Choose the saved entry or bullet again.'
      }
      // A path the review doesn't render would be counted but never shown, so keep it in the footer.
      if (issue && cvPathRenderable(issue.path)) mapped.push(issue)
      else unmapped.push(apiError.message)
    }
    // Capture the submitted value for the specific field, so only editing it clears the server error.
    serverValues.value = Object.fromEntries(
      mapped.map((issue) => [issue.path, cvValueSnapshot(submittedDraft, issue.path)])
    )
    serverIssues.value = mapped
    if (!mapped.length || unmapped.length)
      saveError.value = result.stale
        ? 'A saved entry is no longer available. Choose the entry to update again.'
        : result.apiErrors?.length
          ? 'The import could not be saved. Review the details and try again.'
          : result.error
    if (result.stale) {
      refreshing.value = true
      try {
        await props.refreshProfile()
      } catch {
        /* Retain the reviewed edits and save error. */
      } finally {
        refreshing.value = false
      }
    }
    if (mapped.length) await focusCorrection(mapped.map((issue) => issue.path))
    return
  }
  emit('saved', result.value)
  toastSuccess('CV import saved')
  draft.value = undefined
  reviewing.value = false
  cv.value = json.value = ''
  open.value = false
}
</script>

<template>
  <!-- Complete history forms need more width than a simple prompt modal. -->
  <AppAiModal
    v-model:open="open"
    title="Import English CV"
    :description="
      reviewing ? 'Review and select what to save.' : 'Parse your CV, then review it before saving.'
    "
    :busy="locked"
    wide
    :close="requestClose"
  >
    <AppAiErrorAlert v-if="error && reviewing" :title="error" data-testid="cv-error" />
    <fieldset :disabled="locked" class="min-w-0 space-y-4">
      <ProfileCvReview
        v-if="reviewing && draft"
        ref="reviewComponent"
        v-model="draft"
        :profile="profile"
        :issues="issues"
        :notes="feedback?.notes ?? []"
      />
      <template v-else>
        <AppAiMethodTabs
          v-model="tab"
          :builtin="[{ label: 'Paste CV', value: 'paste', icon: 'i-lucide-clipboard-paste' }]"
          :disabled="locked"
        />
        <template v-if="tab === 'paste'">
          <UFormField
            label="Paste your English CV"
            help="Plain text or Markdown, up to 100,000 characters. Nothing saves during parsing."
            :error="inputError || undefined"
          >
            <UTextarea
              v-model="cv"
              :rows="8"
              autoresize
              :maxrows="16"
              class="w-full"
              data-testid="cv-text"
            />
          </UFormField>
          <AppAiCostNotice :usage="usage" data-testid="cv-cost-notice" />
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
            data-testid="cv-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="json"
          :ai="api"
          note="Give that AI your English CV in any format it accepts."
          reply-help="Nothing saves yet."
          :reply-error="inputError || error"
          testid-prefix="cv"
        />
      </template>
    </fieldset>

    <template #footer-top>
      <!-- Capped, so opened error details can't push the buttons out of a phone-sized footer. -->
      <AppAiErrorAlert
        v-if="saveError"
        :title="saveError"
        class="max-h-40 overflow-y-auto"
        data-testid="cv-save-error"
      >
        <template v-if="saveDetails" #description>
          <details class="text-sm">
            <summary class="cursor-pointer">Error details</summary>
            <p class="mt-2 break-words whitespace-pre-wrap">{{ saveDetails }}</p>
          </details>
        </template>
      </AppAiErrorAlert>
    </template>

    <template v-if="reviewing" #back>
      <UButton
        color="neutral"
        variant="subtle"
        :disabled="locked"
        data-testid="cv-back"
        @click="reviewing = false"
        >Back</UButton
      >
    </template>
    <template v-if="reviewing" #footer-info>
      <div aria-live="polite" data-testid="cv-status">
        <UButton
          v-if="issues.length"
          variant="link"
          :color="issues.some((issue) => !issue.severity) ? 'error' : 'warning'"
          icon="i-lucide-circle-alert"
          :disabled="locked"
          @click="focusCorrection(issues.map((issue) => issue.path))"
          >{{ issues.length }}
          {{ issues.length === 1 ? 'item needs' : 'items need' }} attention</UButton
        >
        <p v-else class="text-sm text-muted">
          {{
            review?.count
              ? `${review.count} ${review.count === 1 ? 'change' : 'changes'} to save`
              : 'Nothing selected. Go back or include content to import.'
          }}
        </p>
      </div>
    </template>

    <template #actions>
      <template v-if="reviewing">
        <!-- Muted when nothing is selected: the default disabled primary looks almost enabled. -->
        <UButton
          :loading="busy"
          :disabled="locked || !review?.count"
          :color="review?.count ? 'primary' : 'neutral'"
          :variant="review?.count ? 'solid' : 'subtle'"
          data-testid="cv-save"
          @click="save"
          >Save import</UButton
        >
      </template>
      <template v-else>
        <UButton
          v-if="draft"
          color="neutral"
          variant="subtle"
          :disabled="locked"
          data-testid="cv-resume"
          @click="reviewing = true"
          >Resume review</UButton
        >
        <UButton
          :icon="tab === 'paste' ? 'i-lucide-sparkles' : undefined"
          :loading="locked"
          :disabled="locked || !canParse"
          data-testid="cv-parse"
          @click="parse"
          >{{ tab === 'paste' ? 'Parse CV' : 'Preview changes' }}</UButton
        >
      </template>
    </template>
  </AppAiModal>
  <AppConfirmModal
    v-model:open="confirmOpen"
    :title="pending === 'close' ? 'Discard CV review?' : 'Replace CV review?'"
    description="Your unsaved review edits will be discarded."
    :confirm-label="pending === 'close' ? 'Discard' : 'Parse again'"
    @confirm="confirm"
  />
</template>
