<script setup lang="ts">
import { EMPLOYMENT_TYPE_OPTIONS, WORK_MODE_OPTIONS } from '~/constants/listing'
import type { ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
// Read-only; everything, target locations included, is edited in the Preferences form.
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const open = ref(false)

const labelOf = (options: readonly { label: string; value: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value

const rows = computed(() => {
  const salary = profile.minSalary
    ? `${profile.minSalary.toLocaleString('nb-NO')} ${profile.salaryCurrency ?? ''}`.trim()
    : null
  const notice = profile.noticePeriodMonths
  return [
    { label: 'Job roles', value: profile.jobRoles.map((r) => r.name).join(', ') },
    {
      label: 'Work modes',
      value: profile.workModes.map((m) => labelOf(WORK_MODE_OPTIONS, m)).join(', ')
    },
    {
      label: 'Employment types',
      value: profile.employmentTypes.map((t) => labelOf(EMPLOYMENT_TYPE_OPTIONS, t)).join(', ')
    },
    { label: 'Minimum salary', value: salary },
    {
      label: 'Notice period',
      value: notice === null ? null : notice === 1 ? '1 month' : `${notice} months`
    }
  ].filter((row) => row.value)
})

const empty = computed(() => !rows.value.length && !profile.targetLocations.length)
</script>

<template>
  <ProfileSection
    title="Job preferences"
    icon="i-lucide-sliders-horizontal"
    testid="profile-preferences"
    :empty="empty"
    empty-message="No preferences yet."
    add-label="Set preferences"
    @add="open = true"
  >
    <template v-if="!empty" #actions>
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="subtle"
        size="sm"
        aria-label="Edit preferences"
        data-testid="profile-preferences-edit"
        @click="open = true"
        >Edit</UButton
      >
    </template>

    <dl v-if="rows.length" class="space-y-3" data-testid="profile-preferences-rows">
      <div v-for="row in rows" :key="row.label">
        <dt class="text-sm text-muted">{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <div
      v-if="profile.targetLocations.length"
      class="space-y-2"
      :class="{ 'mt-4 border-t border-default pt-4': rows.length }"
    >
      <h3 class="text-sm text-muted">Target locations</h3>
      <ul class="space-y-1">
        <li
          v-for="l in profile.targetLocations"
          :key="l.id"
          class="flex items-center gap-2"
          data-testid="profile-target-location"
        >
          <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate">{{ formatLocation(l) }}</span>
        </li>
      </ul>
    </div>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfilePreferencesModal
    v-model:open="open"
    :profile="profile"
    @saved="emit('saved', $event)"
    @changed="emit('changed')"
  />
</template>
