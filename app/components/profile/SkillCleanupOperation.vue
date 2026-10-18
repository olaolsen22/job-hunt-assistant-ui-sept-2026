<script setup lang="ts">
// A rename, merge or split in the cleanup review: the current skills next to editable new names.
// Dropping is reversible, so a dropped card stays (dimmed) with Restore instead of vanishing.
const MAX_NAMES = 10
const { kind, current, unknown, problem } = defineProps<{
  kind: string
  current: string
  // The plan names a skill that doesn't exist, so it can't be shown or applied.
  unknown: boolean
  // Anything that blocks Apply while this card is kept (unknown skill, blank or too many names).
  problem: boolean
}>()
const names = defineModel<string[]>('names', { required: true })
const dropped = defineModel<boolean>('dropped', { required: true })

const invalid = computed(() => !dropped.value && unknown)
const addName = () => names.value.push('')
const removeName = (i: number) => names.value.splice(i, 1)
</script>

<template>
  <li
    class="space-y-3 rounded-md border border-default p-3"
    :class="{ 'border-error': invalid, 'opacity-60': dropped }"
    :data-invalid="problem || undefined"
    data-testid="cleanup-row"
  >
    <div class="flex items-center gap-2">
      <UBadge :color="invalid ? 'error' : 'neutral'" :variant="invalid ? 'subtle' : 'outline'">{{
        unknown ? 'Invalid' : kind
      }}</UBadge>
      <span class="min-w-0 flex-1 text-sm" :class="invalid ? 'text-error' : 'text-muted'">
        {{
          dropped
            ? 'Dropped, so it won’t be applied.'
            : unknown
              ? 'Skill not found. Drop this to continue.'
              : ''
        }}
      </span>
      <UButton
        v-if="dropped"
        icon="i-lucide-undo-2"
        color="neutral"
        variant="subtle"
        size="sm"
        data-testid="cleanup-restore"
        @click="dropped = false"
        >Restore</UButton
      >
      <UButton
        v-else
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        aria-label="Drop this change"
        data-testid="cleanup-remove"
        @click="dropped = true"
      />
    </div>
    <AppCompareBlock :current="current" :suggested="names.join(', ')">
      <template v-if="!unknown && !dropped" #suggested>
        <div class="space-y-2">
          <div v-for="(_, i) in names" :key="i" class="flex items-center gap-2">
            <UInput
              v-model="names[i]"
              class="min-w-0 flex-1"
              :aria-label="`New skill name ${i + 1}`"
              :color="names[i]?.trim() ? undefined : 'error'"
              data-testid="cleanup-name"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              aria-label="Remove name"
              :disabled="names.length <= 1"
              @click="removeName(i)"
            />
          </div>
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="link"
            size="sm"
            :disabled="names.length >= MAX_NAMES"
            data-testid="cleanup-add-name"
            @click="addName"
            >Add name</UButton
          >
        </div>
      </template>
    </AppCompareBlock>
  </li>
</template>
