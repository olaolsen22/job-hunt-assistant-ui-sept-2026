<script setup lang="ts">
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'
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
const { busy, instructions, promptLoading, promptError, copied, needsConfirm, safetyMessage } = api
const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
const usage = computed(() => usageData.value?.llmUsageToday)
const toast = useToast()

type Row = {
  key: string
  label: string
  bulletId?: number
  field?: 'headline' | 'summary'
  before?: string
  text: string
  include: boolean
}

const tab = ref('builtin')
const reply = ref('')
const error = ref('')
const errorCode = ref<string>()
const applyError = ref('')
const rows = ref<Row[]>()

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

const included = computed(() => rows.value?.filter((r) => r.include) ?? [])
const blank = computed(() => included.value.filter((r) => !r.text.trim()).length)
const canApply = computed(() => !!included.value.length && !blank.value)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
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

const startReview = ({ bullets, headline, summary }: SkillWording) => {
  rows.value = [
    ...(headline != null
      ? [
          {
            key: 'headline',
            label: 'Headline',
            field: 'headline' as const,
            before: profile.headline ?? '',
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
            before: profile.summary ?? '',
            text: summary,
            include: true
          }
        ]
      : []),
    // An id that isn't on the profile can't be applied, so it starts unticked and stays that way.
    ...bullets.map((b) => {
      const before = currentBullets.value.get(b.id)
      return {
        key: `bullet-${b.id}`,
        label: 'Bullet',
        bulletId: b.id,
        before,
        text: b.text,
        include: before != null
      }
    })
  ]
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
  startReview(wording)
}

const apply = async () => {
  if (!canApply.value || busy.value) return
  applyError.value = ''
  const pick = (field: Row['field']) => {
    const row = included.value.find((r) => r.field === field)
    return row ? row.text.trim() : null
  }
  const result = await api.apply({
    bullets: included.value
      .filter((r) => r.bulletId != null)
      .map((r) => ({ id: r.bulletId!, text: r.text.trim() })),
    headline: pick('headline'),
    summary: pick('summary')
  })
  if (result.error !== undefined) {
    applyError.value = result.error
    return
  }
  emit('changed')
  toast.add({ title: 'Skill wording updated', color: 'success' })
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
    title="Fix skill wording"
    :description="
      rows
        ? 'Review each change. Nothing changes until you apply it.'
        : 'Update skill names in your bullets, headline and summary.'
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
          data-testid="wording-error"
        >
          <template v-if="errorCode === 'daily-limit-reached'" #actions>
            <AppAiLimitLink />
          </template>
        </UAlert>

        <fieldset :disabled="busy" class="min-w-0 space-y-4">
          <template v-if="rows">
            <div
              v-if="!rows.length"
              class="flex flex-col items-center gap-2 py-8 text-center text-muted"
              data-testid="wording-empty"
            >
              <UIcon name="i-lucide-spell-check" class="size-8" />
              <p>Nothing to change</p>
            </div>
            <ul v-else class="space-y-3">
              <li
                v-for="row in rows"
                :key="row.key"
                class="space-y-2 rounded-md border border-default p-3"
                data-testid="wording-row"
              >
                <UCheckbox
                  v-model="row.include"
                  :label="row.label"
                  :disabled="row.before == null"
                  :description="
                    row.before == null ? 'Not on your profile, so it can’t be applied.' : undefined
                  "
                  data-testid="wording-include"
                />
                <AppCompareBlock :current="row.before">
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
                </AppCompareBlock>
              </li>
            </ul>
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
              <AppAiCostNotice :usage="usage" data-testid="wording-cost-notice" />
              <p class="text-sm text-muted">
                The AI reads your profile text and proposes wording that matches your skill names.
                You review each change before anything is saved.
              </p>
            </template>
            <template v-else>
              <p class="text-sm text-muted">1. Copy the prompt and send it to your chosen AI.</p>
              <UButton
                :loading="promptLoading"
                :disabled="!instructions"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                :color="copied ? 'success' : 'primary'"
                variant="subtle"
                data-testid="wording-copy-prompt"
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
                help="You review each change before anything is saved."
                :error="error || undefined"
              >
                <UTextarea
                  v-model="reply"
                  :rows="8"
                  :maxrows="16"
                  autoresize
                  class="w-full font-mono"
                  data-testid="wording-json"
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
          data-testid="wording-apply-error"
        />
        <p v-if="blank" class="text-sm text-error">
          {{ blank }} {{ blank === 1 ? 'change is' : 'changes are' }} empty. Fill in or untick.
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="close">Cancel</UButton>
          <template v-if="rows">
            <UButton color="neutral" variant="subtle" :disabled="busy" @click="rows = undefined"
              >Back</UButton
            >
            <UButton
              v-if="rows.length"
              :loading="busy"
              :disabled="!canApply"
              data-testid="wording-apply"
              @click="apply"
              >{{
                `Apply ${included.length} ${included.length === 1 ? 'change' : 'changes'}`
              }}</UButton
            >
          </template>
          <UButton
            v-else-if="tab === 'builtin'"
            :loading="busy"
            :disabled="busy || needsConfirm"
            data-testid="wording-suggest"
            @click="suggest"
            >Suggest wording</UButton
          >
          <UButton v-else :disabled="!reply.trim()" data-testid="wording-preview" @click="preview"
            >Preview changes</UButton
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
