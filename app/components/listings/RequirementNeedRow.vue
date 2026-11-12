<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'
import type { RequirementNeed } from '~/utils/requirementMap'
const {
  profile,
  index,
  issue = ''
} = defineProps<{ profile: ProfileData; index: number; issue?: string }>()
const need = defineModel<RequirementNeed>({ required: true })
const emit = defineEmits<{ remove: [] }>()
const evidenceOpen = ref(false)
const canPick = computed(() => allowsRequirementEvidence(need.value))
const noteRequired = computed(
  () =>
    need.value.match !== 'GAP' &&
    (need.value.kind === 'LANGUAGE' || need.value.kind === 'PRACTICAL')
)
const evidence = computed(() => toRequirementMapInput([need.value], profile).needs[0]!)
const bullets = computed(() => profileBullets(profile))
const entries = computed(() => profileEntries(profile))
const clearEvidence = () => {
  if (!canPick.value) {
    need.value.bulletIds = []
    need.value.entries = []
  }
}
</script>
<template>
  <AppCard :title="`Requirement ${index + 1}`" :data-testid="`requirement-need-${index}`">
    <template #actions
      ><UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-trash-2"
        :aria-label="`Remove requirement ${index + 1}`"
        @click="emit('remove')"
    /></template>
    <div class="space-y-4">
      <UFormField
        label="Requirement"
        :error="issue || undefined"
        :hint="`${need.text.length} / 200`"
      >
        <UTextarea
          v-model="need.text"
          :maxlength="200"
          autoresize
          class="w-full"
          :data-testid="`requirement-text-${index}`"
        />
      </UFormField>
      <div class="grid gap-3 sm:grid-cols-3">
        <UFormField label="Kind"
          ><USelect
            v-model="need.kind"
            :items="REQUIREMENT_KINDS"
            class="w-full"
            @update:model-value="clearEvidence"
        /></UFormField>
        <UFormField label="Importance"
          ><USelect v-model="need.importance" :items="REQUIREMENT_IMPORTANCE" class="w-full"
        /></UFormField>
        <UFormField label="Match"
          ><USelect
            v-model="need.match"
            :items="REQUIREMENT_MATCHES"
            :icon="REQUIREMENT_MATCHES.find((m) => m.value === need.match)?.icon"
            class="w-full"
            @update:model-value="clearEvidence"
        /></UFormField>
      </div>
      <UFormField
        label="Note"
        :required="noteRequired"
        :hint="`${need.note?.length ?? 0} / 500`"
        :help="
          noteRequired
            ? 'Explain the evidence in a note for a language or practical requirement.'
            : 'Explain partial evidence or what is missing.'
        "
      >
        <UTextarea
          :model-value="need.note ?? ''"
          :maxlength="500"
          autoresize
          class="w-full"
          :data-testid="`requirement-note-${index}`"
          @update:model-value="need.note = $event"
        />
      </UFormField>
      <template v-if="canPick">
        <div class="space-y-2">
          <p
            v-for="id in evidence.bulletIds"
            :key="id"
            class="rounded-md bg-elevated p-2 text-sm break-words"
          >
            <span class="font-medium">{{ bullets.get(id)?.name }}:</span>
            {{ bullets.get(id)?.bullet.text }}
          </p>
          <p
            v-for="entry in evidence.entries"
            :key="`${entry.kind}:${entry.id}`"
            class="rounded-md bg-elevated p-2 text-sm break-words"
          >
            {{ entries.get(`${entry.kind}:${entry.id}`)?.name }} · Whole entry
          </p>
          <UButton
            icon="i-lucide-list-checks"
            color="neutral"
            variant="outline"
            @click="evidenceOpen = true"
            >Choose evidence</UButton
          >
        </div>
      </template>
      <p v-else-if="need.match === 'GAP'" class="text-sm text-muted">
        A gap is saved without evidence.
      </p>
    </div>
    <ListingsRequirementEvidenceModal
      v-model:open="evidenceOpen"
      :need="evidence"
      :profile="profile"
      @apply="Object.assign(need, $event)"
    />
  </AppCard>
</template>
