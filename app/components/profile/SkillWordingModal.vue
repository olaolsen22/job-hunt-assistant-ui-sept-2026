<script setup lang="ts">
import { INVALID_DRAFT_JSON } from '~/utils/parseDraft'
import type { ProfileData } from '~/composables/useProfile'
import type { SkillWording } from '~/composables/useSkillWording'

// Rewrites skill names in bullets, headline and summary to match the cleaned-up skills. Each change
// is shown current, then suggested, and can be unticked or edited. Translations of changed text
// go stale.
const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const api = useSkillWording()
const { busy, needsConfirm, safetyMessage } = api
const toastSuccess = useSuccessToast()

const reply = ref('')
const {
  rows,
  applyError,
  confirmOpen,
  included,
  blank,
  canApply,
  applicable,
  setAll,
  start,
  discard,
  back,
  requestClose,
  apply: applyRows
} = useTextRewriteReview(open, reply)

const currentBullets = computed(
  () =>
    new Map(
      [
        ...profile.experiences,
        ...profile.educations,
        ...profile.certifications,
        ...profile.projects
      ]
        .flatMap((e) => e.bullets)
        .map((b) => [b.id, b.text])
    )
)

const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => api.loadPrompt()
})
watch([reply, tab], () => (error.value = ''))

const startReview = ({ bullets, headline, summary }: SkillWording) =>
  start([
    ...(headline != null
      ? [
          {
            key: 'headline',
            label: 'Headline',
            field: 'headline' as const,
            current: profile.headline ?? '',
            text: headline,
            include: true
          }
        ]
      : []),
    ...(summary != null
      ? [
          {
            key: 'summary',
            label: 'Summary',
            field: 'summary' as const,
            current: profile.summary ?? '',
            text: summary,
            include: true
          }
        ]
      : []),
    // An id that isn't on the profile can't be applied, so it starts unticked and stays that way.
    ...bullets.map((b) => {
      const current = currentBullets.value.get(b.id)
      return {
        key: `bullet-${b.id}`,
        label: 'Bullet',
        bulletId: b.id,
        current,
        text: b.text,
        include: current != null
      }
    })
  ])
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
  startReview(result.value)
}
const retryConfirmed = () => {
  api.confirmRetry()
  suggest()
}
const preview = () => {
  const wording = parseWordingReply(reply.value)
  if (!wording) {
    error.value = `${INVALID_DRAFT_JSON} Expect a "bullets" list.`
    return
  }
  method.value = 'own'
  startReview(wording)
}

const apply = () => {
  if (busy.value) return
  return applyRows(api.apply, () => {
    emit('changed')
    toastSuccess('Skill wording updated')
  })
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Fix skill wording"
    :description="
      rows
        ? 'Review each change. Nothing changes until you apply it.'
        : 'Update skill names in your bullets, headline and summary.'
    "
    :busy="busy"
    :close="requestClose"
    wide
  >
    <fieldset :disabled="busy" class="min-w-0 space-y-4">
      <template v-if="rows">
        <AppAiReviewEmpty
          v-if="!rows.length"
          icon="i-lucide-spell-check"
          text="Nothing to change"
          data-testid="wording-empty"
        />
        <template v-else>
          <AppAiReviewSelectAll
            :selected="included.length"
            :total="applicable"
            @all="setAll(true)"
            @none="setAll(false)"
          />
          <ul class="space-y-3">
            <AppAiReviewRow
              v-for="row in rows"
              :key="row.key"
              v-model:include="row.include"
              :label="row.label"
              :disabled="row.current == null"
              :description="
                row.current == null ? 'Not on your profile, so it can’t be applied.' : undefined
              "
              :current="row.current"
              testid-prefix="wording"
            >
              <template #suggested>
                <UTextarea
                  v-model="row.text"
                  :disabled="!row.include"
                  :rows="2"
                  autoresize
                  class="w-full"
                  :aria-label="`New ${row.label.toLowerCase()} text`"
                  :color="row.include && !row.text.trim() ? 'error' : undefined"
                  data-testid="wording-text"
                />
              </template>
            </AppAiReviewRow>
          </ul>
        </template>
      </template>

      <template v-else>
        <AppAiMethodTabs v-model="tab" :disabled="busy" />
        <template v-if="tab === 'builtin'">
          <p class="text-sm text-muted">
            The AI reads your profile text and proposes wording that matches your skill names. You
            review each change before anything is saved.
          </p>
          <AppAiCostNotice :usage="usage" data-testid="wording-cost-notice" />
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
            data-testid="wording-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="reply"
          :ai="api"
          :reply-error="error"
          testid-prefix="wording"
        />
      </template>
    </fieldset>

    <template #footer-top>
      <AppAiErrorAlert
        v-if="applyError"
        :title="applyError"
        class="max-h-40 overflow-y-auto"
        data-testid="wording-apply-error"
      />
    </template>

    <template v-if="rows" #back>
      <UButton color="neutral" variant="subtle" :disabled="busy" @click="back">Back</UButton>
    </template>
    <template v-if="blank" #footer-info>
      <p class="text-sm text-error">
        {{ blank }} {{ blank === 1 ? 'change is' : 'changes are' }} empty. Fill in or untick.
      </p>
    </template>

    <template #actions>
      <template v-if="rows">
        <UButton
          v-if="rows.length"
          :loading="busy"
          :disabled="!canApply"
          data-testid="wording-apply"
          @click="apply"
          >{{ `Apply ${included.length} ${included.length === 1 ? 'change' : 'changes'}` }}</UButton
        >
        <UButton v-else data-testid="wording-close" @click="discard">Close</UButton>
      </template>
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="busy || needsConfirm"
        data-testid="wording-suggest"
        @click="suggest"
        >Suggest wording</UButton
      >
      <UButton v-else :disabled="!reply.trim()" data-testid="wording-preview" @click="preview"
        >Preview changes</UButton
      >
    </template>
  </AppAiModal>
  <AppConfirmModal
    v-model:open="confirmOpen"
    title="Discard these suggestions?"
    description="Your edits to the AI’s result will be lost."
    confirm-label="Discard"
    @confirm="discard"
  />
</template>
