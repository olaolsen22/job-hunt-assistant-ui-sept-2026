<script setup lang="ts">
// The Filters sheet of /listings and /companies: facet fields go in the default slot, and every
// change applies right away, so the footer only clears or closes.
const { testidPrefix } = defineProps<{ testidPrefix: string; clearDisabled: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ clear: [] }>()

// A side sheet from tablet up, a bottom sheet on phones. Decided when it opens, so SSR never needs it.
const side = ref<'right' | 'bottom'>('right')
watch(open, (isOpen) => {
  if (isOpen) side.value = window.matchMedia('(min-width: 768px)').matches ? 'right' : 'bottom'
})
</script>

<template>
  <USlideover
    v-model:open="open"
    :side="side"
    title="Filters"
    description="Narrow the list. Changes apply right away."
  >
    <template #body>
      <div class="space-y-4">
        <slot />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="clearDisabled"
          :data-testid="`${testidPrefix}-sheet-clear`"
          @click="emit('clear')"
          >Clear filters</UButton
        >
        <UButton :data-testid="`${testidPrefix}-sheet-done`" @click="open = false">Done</UButton>
      </div>
    </template>
  </USlideover>
</template>
