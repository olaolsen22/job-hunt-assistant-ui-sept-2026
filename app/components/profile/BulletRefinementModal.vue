<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'
import type { BulletScope, BulletSuggestion } from '~/composables/useBulletRefinement'
import type { RewriteRow } from '~/composables/useTextRewriteReview'

// Asks the AI to sharpen vague profile bullets (own part, result, scale) for the whole profile or
// one entry. Each suggestion is shown beside the current text, editable and tickable. A note is
// the AI asking for a fact it lacks: it proposes no text, and counts once the owner types one.
const {
  profile,
  scope = {},
  scopeName = undefined
} = defineProps<{ profile: ProfileData; scope?: BulletScope; scopeName?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const api = useBulletRefinement(() => scope)
const { busy, needsConfirm, safetyMessage } = api
const { success: toastSuccess } = useAppToast()

const reply = ref('')
const {
  rows,
  applyError,
  confirmOpen,
  included,
  blank,
  setAll,
  start,
  discard,
  back,
  requestClose,
  apply: applyRows
} = useTextRewriteReview<RewriteRow>(open, reply)
// Ticked rows whose text actually differs; the rest would be a no-op.
const changed = computed(() => included.value.filter((r) => r.text.trim() !== r.current))
const canApply = computed(() => !!changed.value.length && !blank.value)
const applicable = computed(() => rows.value?.filter((r) => r.current != null).length ?? 0)

const bulletInfo = computed(() => profileBullets(profile))

const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => api.loadPrompt()
})
watch(reply, () => (error.value = ''))

const startReview = (bullets: BulletSuggestion[]) =>
  start(
    bullets.map((b) => {
      const info = bulletInfo.value.get(b.bulletId)
      const current = info?.bullet.text
      // A question without new text keeps the current text to edit, unticked. An id that isn't on
      // the profile can't be applied, so it starts unticked and stays that way.
      const text = b.text ?? current ?? ''
      return {
        key: `bullet-${b.bulletId}`,
        label: info?.name ? `Bullet · ${info.name}` : 'Bullet',
        bulletId: b.bulletId,
        current,
        text,
        note: b.note,
        include: !!info && text.trim() !== current
      }
    })
  )

// A note row is ticked by typing a real change into it, and unticked again if that is undone.
const edit = (row: RewriteRow, text: string) => {
  row.text = text
  if (row.note && row.current != null) row.include = text.trim() !== row.current
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
  startReview(result.value)
}
const retryConfirmed = () => {
  api.confirmRetry()
  suggest()
}
const preview = async () => {
  error.value = ''
  const result = await api.preview(reply.value)
  if (result.error !== undefined) {
    error.value = result.error
    return
  }
  method.value = 'own'
  startReview(result.value)
}

const apply = () => {
  if (busy.value || !canApply.value) return
  // The shared review sends every ticked row; unchanged ones would be a no-op write.
  const changedIds = new Set(changed.value.map((r) => r.bulletId))
  return applyRows(
    ({ bullets }) => api.apply({ bullets: bullets.filter((b) => changedIds.has(b.id)) }),
    () => {
      emit('changed')
      toastSuccess('Bullets updated')
    }
  )
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    :title="scopeName ? `Refine bullets: ${scopeName}` : 'Refine bullets with AI'"
    :description="
      rows
        ? 'Review each suggestion. Nothing changes until you apply it.'
        : 'Make vague bullets concrete: your own part, the result, the scale.'
    "
    :busy="busy"
    :close="requestClose"
    wide
  >
    <fieldset :disabled="busy" class="min-w-0 space-y-4">
      <template v-if="rows">
        <AppAiReviewEmpty
          v-if="!rows.length"
          icon="i-lucide-badge-check"
          text="No bullets need changes."
          data-testid="refine-empty"
        />
        <template v-else>
          <UAlert
            v-if="changed.length"
            color="neutral"
            variant="subtle"
            icon="i-lucide-languages"
            title="Translations of changed bullets become out of date."
            data-testid="refine-stale-notice"
          />
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
              testid-prefix="refine"
            >
              <template #suggested>
                <p
                  v-if="row.note"
                  class="mb-2 flex gap-2 rounded-md bg-elevated p-2 text-sm"
                  data-testid="refine-note"
                >
                  <UIcon name="i-lucide-message-circle-question" class="mt-0.5 size-4 shrink-0" />
                  <span class="min-w-0 break-words">{{ row.note }}</span>
                </p>
                <UTextarea
                  :model-value="row.text"
                  :disabled="row.current == null || (!row.include && !row.note)"
                  :rows="2"
                  autoresize
                  class="w-full"
                  aria-label="New bullet text"
                  :color="row.include && !row.text.trim() ? 'error' : undefined"
                  data-testid="refine-text"
                  @update:model-value="edit(row, $event)"
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
            The AI reads your profile and suggests sharper bullets. It can’t know facts you haven’t
            written, so check numbers and results before you apply. You review each change first.
          </p>
          <AppAiCostNotice :usage="usage" data-testid="refine-cost-notice" />
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
            data-testid="refine-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="reply"
          :ai="api"
          :reply-error="error"
          testid-prefix="refine"
        />
      </template>
    </fieldset>

    <template #footer-top>
      <AppAiErrorAlert
        v-if="applyError"
        :title="applyError"
        class="max-h-40 overflow-y-auto"
        data-testid="refine-apply-error"
      />
    </template>

    <template v-if="rows" #back>
      <UButton color="neutral" variant="subtle" :disabled="busy" @click="back">Back</UButton>
    </template>
    <template v-if="blank" #footer-info>
      <p class="text-sm text-error">
        {{ blank }} {{ blank === 1 ? 'bullet is' : 'bullets are' }} empty. Fill in or untick.
      </p>
    </template>

    <template #actions>
      <template v-if="rows">
        <UButton
          v-if="rows.length"
          :loading="busy"
          :disabled="!canApply"
          data-testid="refine-apply"
          @click="apply"
          >{{ `Apply ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` }}</UButton
        >
        <UButton v-else data-testid="refine-close" @click="discard">Close</UButton>
      </template>
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="busy || needsConfirm"
        data-testid="refine-suggest"
        @click="suggest"
        >Refine bullets</UButton
      >
      <UButton v-else :disabled="!reply.trim()" data-testid="refine-preview" @click="preview"
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
