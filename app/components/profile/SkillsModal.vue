<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { ProfileSkill } from '~/composables/useProfile'

// Every skill's level in one form, plus marking skills for removal. The API takes one skill per
// call, so Save sends one request per changed row; failed rows stay with their message.
const { skills } = defineProps<{ skills: readonly ProfileSkill[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const SET_SKILL = graphql(`
  mutation SetProfileSkillLevel($input: SetProfileSkillInput!) {
    setProfileSkill(input: $input) {
      profileSkill {
        level
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const REMOVE_SKILL = graphql(`
  mutation RemoveProfileSkill($input: RemoveProfileSkillInput!) {
    removeProfileSkill(input: $input) {
      skillId
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const LEVELS = [1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }))

type Row = {
  id: number
  name: string
  years: string
  saved: number
  level: number
  remove: boolean
  error?: string
}
const rows = ref<Row[]>([])

watch(open, (isOpen) => {
  if (!isOpen) return
  rows.value = skills.map((s) => ({
    id: s.skill.id,
    name: s.skill.name,
    years: formatYears(s.experienceMonths),
    saved: s.level,
    level: s.level,
    remove: false
  }))
})

const changed = computed(() => rows.value.filter((r) => r.remove || r.level !== r.saved))
// Only pending changes count for the discard guard, so saved rows drop out of it.
const state = computed(() => changed.value.map((r) => [r.id, r.level, r.remove]))
const removals = computed(() => changed.value.filter((r) => r.remove))
const failed = computed(() => rows.value.filter((r) => r.error).length)

const loading = ref(false)
const confirmOpen = ref(false)

const submit = () => {
  if (!changed.value.length) open.value = false
  else if (removals.value.length) confirmOpen.value = true
  else save()
}

const saveRow = async (row: Row) => {
  try {
    const errors = row.remove
      ? (await gql(REMOVE_SKILL, { input: { skillId: row.id } })).removeProfileSkill.errors
      : (await gql(SET_SKILL, { input: { name: row.name, level: row.level } })).setProfileSkill
          .errors
    row.error = errors?.[0]?.message
  } catch {
    row.error = ERROR_MESSAGES.generic
  }
  if (row.error) return false
  if (row.remove) rows.value = rows.value.filter((r) => r !== row)
  else row.saved = row.level
  return true
}

const save = async () => {
  confirmOpen.value = false
  loading.value = true
  const results = await Promise.all(changed.value.map(saveRow))
  loading.value = false
  if (results.some(Boolean)) emit('changed')
  if (results.every(Boolean)) open.value = false
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Edit skills"
    description="Tap a level per skill. Each skill saves separately."
    :state="state"
    :loading="loading"
    :save-label="changed.length ? `Save ${changed.length}` : 'Save'"
    @submit="submit"
  >
    <UAlert
      v-if="failed"
      color="error"
      variant="subtle"
      :title="`${failed} ${failed === 1 ? 'change' : 'changes'} didn't save`"
      class="mb-4"
      data-testid="skills-failed"
    />
    <ul class="divide-y divide-default">
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
        data-testid="skills-row"
      >
        <span class="min-w-0 flex-1 truncate" :class="{ 'text-muted line-through': r.remove }">{{
          r.name
        }}</span>
        <span v-if="r.years" class="text-sm text-muted">{{ r.years }}</span>
        <div class="flex w-full items-center gap-2 sm:w-auto">
          <ListingsToggleGroup
            v-model="r.level"
            :options="LEVELS"
            :clearable="false"
            :disabled="r.remove"
            class="sm:w-56"
            :aria-label="`${r.name} level`"
          />
          <UButton
            :icon="r.remove ? 'i-lucide-undo-2' : 'i-lucide-trash-2'"
            color="neutral"
            variant="ghost"
            :aria-label="r.remove ? `Keep ${r.name}` : `Remove ${r.name}`"
            data-testid="skills-remove"
            @click="r.remove = !r.remove"
          />
        </div>
        <p v-if="r.error" class="w-full text-sm text-error">{{ r.error }}</p>
      </li>
    </ul>
    <p v-if="rows.some((r) => r.saved === 1)" class="mt-3 text-xs text-muted">
      Skills added from your entries start at level 1. Raise the level where it's higher.
    </p>
  </AppFormModal>

  <AppConfirmModal
    v-model:open="confirmOpen"
    :title="`Remove ${removals.length} ${removals.length === 1 ? 'skill' : 'skills'}?`"
    :description="`${removals.map((r) => r.name).join(', ')} stay on the entries they're tagged on.`"
    confirm-label="Save and remove"
    @confirm="save"
  />
</template>
