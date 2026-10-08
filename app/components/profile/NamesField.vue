<script setup lang="ts">
// Names (job roles, entry skills, hobbies) shown as removable chips. With a `lookup` they are added
// through the combobox; without one (hobbies) they are free text, added with Enter or the button.
defineProps<{ lookup?: 'jobRoles' | 'skills'; placeholder?: string }>()
const names = defineModel<string[]>({ required: true })

const next = ref<string>()

const addName = (name?: string) => {
  const exists = names.value.some((n) => n.toLowerCase() === name?.toLowerCase())
  if (name && !exists) names.value = [...names.value, name]
  // Clear on the next tick, after the combobox has applied the selection.
  nextTick(() => (next.value = undefined))
}

const addTyped = () => addName(next.value?.trim())
</script>

<template>
  <div class="space-y-2">
    <div v-if="names.length" class="flex flex-wrap gap-2">
      <UBadge
        v-for="name in names"
        :key="name"
        color="neutral"
        variant="subtle"
        class="gap-1"
        data-testid="names-field-chip"
      >
        {{ name }}
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          :aria-label="`Remove ${name}`"
          class="p-0"
          @click="names = names.filter((n) => n !== name)"
        />
      </UBadge>
    </div>
    <ListingsNameCombobox
      v-if="lookup"
      v-model="next"
      :lookup="lookup"
      :placeholder="placeholder"
      @update:model-value="addName"
    />
    <form v-else class="flex gap-2" @submit.prevent="addTyped">
      <UInput
        v-model="next"
        :placeholder="placeholder"
        class="flex-1"
        data-testid="names-field-input"
      />
      <UButton
        type="submit"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        :disabled="!next?.trim()"
        aria-label="Add"
      />
    </form>
  </div>
</template>
