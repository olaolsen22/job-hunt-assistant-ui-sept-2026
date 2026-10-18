<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

// Built-in AI first, your own AI last, in every AI modal. `builtin` replaces the first tab when a
// feature has more than one built-in way (the ad parse: From link, Paste ad).
// `extra` adds non-AI ways after them (the cover letter's Paste a letter).
const {
  builtin = undefined,
  extra = [],
  disabled = false
} = defineProps<{
  builtin?: TabsItem[]
  extra?: TabsItem[]
  disabled?: boolean
}>()
const tab = defineModel<string>({ required: true })

const items = computed(() =>
  [
    ...(builtin ?? [{ label: 'Built-in AI', value: 'builtin', icon: 'i-lucide-sparkles' }]),
    { label: 'Your own AI', value: 'own', icon: 'i-lucide-bot' },
    ...extra
  ].map((item) => ({ ...item, disabled }))
)
</script>

<template>
  <!-- content=false: the tabs only switch the model; each modal renders its own panels. -->
  <UTabs v-model="tab" :items="items" :content="false" class="w-full" />
</template>
