<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'
import type { RequirementNeed } from '~/utils/requirementMap'
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'
const { need, profile } = defineProps<{ need: RequirementNeed; profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [evidence: Pick<RequirementNeed, 'bulletIds' | 'entries'>] }>()
const bulletIds = ref<number[]>([])
const entries = ref<RequirementNeed['entries']>([])
watch(
  open,
  (value) => {
    if (!value) return
    bulletIds.value = [...need.bulletIds]
    entries.value = need.entries.map((e) => ({ ...e }))
  },
  { immediate: true }
)
const groups = computed(() => [...profileEntries(profile).values()])
const hasEntry = (kind: RequirementNeed['entries'][number]['kind'], id: number) =>
  entries.value.some((e) => e.kind === kind && e.id === id)
const toggleBullet = (id: number, checked: boolean | 'indeterminate') => {
  if (checked === true && !bulletIds.value.includes(id) && bulletIds.value.length < 10)
    bulletIds.value.push(id)
  else if (checked === false) bulletIds.value = bulletIds.value.filter((x) => x !== id)
}
const toggleEntry = (
  kind: RequirementNeed['entries'][number]['kind'],
  id: number,
  checked: boolean | 'indeterminate'
) => {
  if (checked === true && !hasEntry(kind, id) && entries.value.length < 10)
    entries.value.push({ kind, id })
  else if (checked === false)
    entries.value = entries.value.filter((e) => !(e.kind === kind && e.id === id))
}
const apply = () => {
  emit('apply', { bulletIds: [...bulletIds.value], entries: entries.value.map((e) => ({ ...e })) })
  open.value = false
}
</script>
<template>
  <UModal
    v-model:open="open"
    title="Choose evidence"
    description="Choose the strongest evidence first. Select up to 10 bullets and 10 whole entries."
    :ui="{ content: PHONE_FULLSCREEN_MODAL }"
  >
    <template #body>
      <div class="space-y-5">
        <p class="text-sm text-muted" data-testid="requirement-evidence-count">
          {{ bulletIds.length }} / 10 bullets · {{ entries.length }} / 10 entries
        </p>
        <p v-if="!groups.length" class="text-sm text-muted">
          No profile entries yet. You can explain the evidence in a note instead.
        </p>
        <section v-for="group in groups" :key="`${group.kind}:${group.id}`" class="space-y-3">
          <h3 class="font-medium break-words">
            {{ group.name }} <span class="text-sm text-muted">{{ group.kind.toLowerCase() }}</span>
          </h3>
          <UCheckbox
            class="break-words"
            :model-value="hasEntry(group.kind, group.id)"
            :label="`Whole entry: ${group.name}`"
            :disabled="entries.length >= 10 && !hasEntry(group.kind, group.id)"
            @update:model-value="toggleEntry(group.kind, group.id, $event)"
          />
          <div class="space-y-3 pl-3">
            <UCheckbox
              v-for="bullet in group.bullets"
              :key="bullet.id"
              class="break-words"
              :model-value="bulletIds.includes(bullet.id)"
              :label="bullet.text"
              :disabled="bulletIds.length >= 10 && !bulletIds.includes(bullet.id)"
              @update:model-value="toggleBullet(bullet.id, $event)"
            />
          </div>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
        <UButton data-testid="requirement-evidence-apply" @click="apply">Use evidence</UButton>
      </div>
    </template>
  </UModal>
</template>
