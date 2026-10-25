<script setup lang="ts">
import { INVALID_DRAFT_JSON } from '~/utils/parseDraft'
import type { ProfileData } from '~/composables/useProfile'
import type { ProfileTranslationDraft } from '~/composables/useProfileTranslationAi'
import type { RewriteRow } from '~/composables/useTextRewriteReview'
import type { WritingSample } from '~/components/profile/WritingSampleList.vue'

// AI translation of an English profile into Norwegian. The API returns only what is missing or
// out of date; each item is shown next to its English source and can be unticked or edited.
// Applied translations are saved as machine translations.
const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const api = useProfileTranslationAi()
const { busy, needsConfirm, safetyMessage } = api
const toastSuccess = useSuccessToast()

// The writing sample list on the profile page has already fetched them; null until it has.
const { data: samples } = useNuxtData<WritingSample[]>('writing-samples')
const noNorwegianSamples = computed(
  () => !!samples.value && !samples.value.some((s) => s.language === 'NORWEGIAN')
)

// existing: replaces a saved Norwegian translation.
type Row = RewriteRow & { existing: boolean }

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
} = useTextRewriteReview<Row>(open, reply)

// Bullet id → English text, whether it already has a Norwegian translation, and its entry's name
// so rows say where they belong.
const bulletInfo = computed(() => {
  const entries = [
    ...profile.experiences.map((e) => ({
      name: [e.title, e.employer].filter(Boolean).join(', '),
      bullets: e.bullets
    })),
    ...profile.educations.map((e) => ({
      name: [e.degree, e.school].filter(Boolean).join(', '),
      bullets: e.bullets
    })),
    ...profile.certifications.map((e) => ({ name: e.name, bullets: e.bullets })),
    ...profile.projects.map((e) => ({ name: e.name, bullets: e.bullets }))
  ]
  return new Map(
    entries.flatMap(({ name, bullets }) =>
      bullets.map((b) => [
        b.id,
        {
          name,
          text: b.text,
          existing: b.translations.some((t) => t.language === 'NORWEGIAN')
        }
      ])
    )
  )
})
const savedTranslation = computed(() =>
  profile.translations.find((t) => t.language === 'NORWEGIAN')
)

const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => api.loadPrompt()
})
watch([reply, tab], () => (error.value = ''))

const fieldRow = (field: 'headline' | 'summary', label: string, text: string | null): Row[] =>
  text == null
    ? []
    : [
        {
          key: field,
          label,
          field,
          current: profile[field] ?? undefined,
          existing: !!savedTranslation.value?.[field],
          text,
          include: true
        }
      ]

const startReview = ({ bullets, headline, summary }: ProfileTranslationDraft) =>
  start([
    ...fieldRow('headline', 'Headline', headline),
    ...fieldRow('summary', 'Summary', summary),
    // An id that isn't on the profile can't be applied, so it starts unticked and stays that way.
    ...bullets.map((b) => {
      const info = bulletInfo.value.get(b.id)
      return {
        key: `bullet-${b.id}`,
        label: info?.name ? `Bullet · ${info.name}` : 'Bullet',
        bulletId: b.id,
        current: info?.text,
        existing: !!info?.existing,
        text: b.text,
        include: !!info
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
  const draft = parseTranslationReply(reply.value)
  if (!draft) {
    error.value = `${INVALID_DRAFT_JSON} Expect a "bullets" list.`
    return
  }
  method.value = 'own'
  startReview(draft)
}

const apply = () => {
  if (busy.value) return
  return applyRows(api.apply, () => {
    emit('changed')
    toastSuccess('Translations saved')
  })
}

const goToSamples = () => {
  open.value = false
  document.getElementById('writing-samples')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Translate to Norwegian with AI"
    :description="
      rows
        ? 'Review each translation. Nothing is saved until you apply it.'
        : 'Translates your headline, summary and bullets that are missing or out of date.'
    "
    :busy="busy"
    :close="requestClose"
    wide
  >
    <fieldset :disabled="busy" class="min-w-0 space-y-4">
      <template v-if="rows">
        <AppAiReviewEmpty
          v-if="!rows.length"
          icon="i-lucide-languages"
          text="Your Norwegian translation is up to date. Nothing to change."
          data-testid="translation-ai-empty"
        />
        <template v-else>
          <p class="text-sm text-muted">Applied translations are marked as machine translated.</p>
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
                row.current == null
                  ? 'Not on your profile, so it can’t be applied.'
                  : row.existing
                    ? 'Replaces your current Norwegian translation.'
                    : undefined
              "
              :current="row.current"
              testid-prefix="translation-ai"
            >
              <template #suggested>
                <UTextarea
                  v-model="row.text"
                  :disabled="!row.include"
                  :rows="2"
                  autoresize
                  class="w-full"
                  :aria-label="`Norwegian ${row.label.toLowerCase()}`"
                  :color="row.include && !row.text.trim() ? 'error' : undefined"
                  data-testid="translation-ai-text"
                />
              </template>
            </AppAiReviewRow>
          </ul>
        </template>
      </template>

      <template v-else>
        <AppAiMethodTabs v-model="tab" :disabled="busy" />
        <UAlert
          v-if="noNorwegianSamples"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Add a few Norwegian writing samples and the AI will match your tone."
          description="You have none yet."
          :actions="[
            {
              label: 'Add writing samples',
              color: 'info',
              variant: 'link',
              onClick: goToSamples
            }
          ]"
          data-testid="translation-ai-samples-hint"
        />
        <template v-if="tab === 'builtin'">
          <p class="text-sm text-muted">
            The AI translates what is missing or out of date. You review each translation before
            anything is saved.
          </p>
          <AppAiCostNotice :usage="usage" data-testid="translation-ai-cost-notice" />
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
            data-testid="translation-ai-error"
          />
        </template>
        <AppAiOwnSteps
          v-else
          v-model:reply="reply"
          :ai="api"
          :reply-error="error"
          testid-prefix="translation-ai"
        />
      </template>
    </fieldset>

    <template #footer-top>
      <AppAiErrorAlert
        v-if="applyError"
        :title="applyError"
        class="max-h-40 overflow-y-auto"
        data-testid="translation-ai-apply-error"
      />
    </template>

    <template v-if="rows" #back>
      <UButton color="neutral" variant="subtle" :disabled="busy" @click="back">Back</UButton>
    </template>
    <template v-if="blank" #footer-info>
      <p class="text-sm text-error">
        {{ blank }} {{ blank === 1 ? 'translation is' : 'translations are' }} empty. Fill in or
        untick.
      </p>
    </template>

    <template #actions>
      <template v-if="rows">
        <UButton
          v-if="rows.length"
          :loading="busy"
          :disabled="!canApply"
          data-testid="translation-ai-apply"
          @click="apply"
          >{{
            `Apply ${included.length} ${included.length === 1 ? 'translation' : 'translations'}`
          }}</UButton
        >
        <UButton v-else data-testid="translation-ai-close" @click="discard">Close</UButton>
      </template>
      <UButton
        v-else-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="busy"
        :disabled="busy || needsConfirm"
        data-testid="translation-ai-suggest"
        @click="suggest"
        >Translate</UButton
      >
      <UButton
        v-else
        :disabled="!reply.trim()"
        data-testid="translation-ai-preview"
        @click="preview"
        >Preview translations</UButton
      >
    </template>
  </AppAiModal>
  <AppConfirmModal
    v-model:open="confirmOpen"
    title="Discard these translations?"
    description="Your edits to the AI’s result will be lost."
    confirm-label="Discard"
    @confirm="discard"
  />
</template>
