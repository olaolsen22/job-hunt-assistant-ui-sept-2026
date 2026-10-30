<script setup lang="ts">
import type { SkillGroupsInput } from '~/composables/useTailoredCvSkillGroups'

// Group labels for the draft's skills from built-in AI or your own. Nothing is saved: `apply`
// hands the label per skill name to the editor, which fills the Group fields for review.
const { input } = defineProps<{ input: SkillGroupsInput }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [groups: Map<string, string>] }>()

const ai = useTailoredCvSkillGroups(() => input)
const reply = ref('')
const { method, tab, error, errorCode, usage, refreshUsage } = useAiModalState(open, {
  onOpen: () => {
    reply.value = ''
    // Fetched on every open: the prompt holds the skill names, which change between opens.
    ai.loadPrompt()
  }
})
watch(reply, () => (error.value = ''))

const submit = async () => {
  const builtin = tab.value === 'builtin'
  const outcome = builtin ? await ai.suggest() : parseSkillGroupsReply(reply.value)
  if (builtin) refreshUsage()
  error.value = outcome.error ?? ''
  errorCode.value = outcome.code
  if (outcome.error !== undefined) return
  method.value = tab.value
  emit('apply', outcome.value)
  open.value = false
}
const retry = () => {
  ai.confirmRetry()
  void submit()
}
</script>

<template>
  <AppAiModal
    v-model:open="open"
    title="Suggest skill groups"
    description="Fills the Group fields for you to review. Nothing is saved until you save the CV."
    :busy="ai.busy.value"
  >
    <AppAiMethodTabs v-model="tab" :disabled="ai.busy.value" />
    <template v-if="tab === 'builtin'">
      <p class="text-sm text-muted">
        Groups the {{ input.skillNames.length }} skills in their current order into lines for the
        Developer PDF. Skills the AI leaves out keep their group.
      </p>
      <AppAiCostNotice :usage="usage" />
      <AppAiRetryConfirm
        v-if="ai.needsConfirm.value"
        :message="ai.safetyMessage.value"
        :loading="ai.busy.value"
        @retry="retry"
      />
      <AppAiErrorAlert
        v-else-if="error"
        :title="error"
        :code="errorCode"
        data-testid="skill-groups-error"
      />
    </template>
    <AppAiOwnSteps
      v-else
      v-model:reply="reply"
      :ai="ai"
      note="It holds the skill names in their current order and the CV’s language."
      reply-help="Skills it leaves out keep their group."
      :reply-error="error"
      testid-prefix="skill-groups"
    />

    <template #actions>
      <UButton
        v-if="tab === 'builtin'"
        icon="i-lucide-sparkles"
        :loading="ai.busy.value"
        :disabled="ai.needsConfirm.value"
        data-testid="skill-groups-run"
        @click="submit"
        >Suggest groups</UButton
      >
      <UButton v-else :disabled="!reply.trim()" data-testid="skill-groups-apply" @click="submit"
        >Fill in groups</UButton
      >
    </template>
  </AppAiModal>
</template>
