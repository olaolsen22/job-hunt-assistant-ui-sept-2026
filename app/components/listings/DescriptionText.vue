<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// A listing summary paragraph. With `clamp` it shows 12 lines and a "Show full description" toggle,
// which only appears when the clamp actually hides text.
const {
  text,
  lang = undefined,
  clamp = false
} = defineProps<{ text: string; lang?: string; clamp?: boolean }>()

const el = ref<HTMLElement>()
const open = ref(false)
const clamped = ref(false)

const measure = () => {
  // While expanded nothing is clamped, so the last answer stands.
  if (!clamp || open.value || !el.value) return
  clamped.value = el.value.scrollHeight > el.value.clientHeight
}
// Width changes (sidebar collapse, rotation) resize the box. A switched language changes the text
// without resizing a clamped box, and collapsing after a switch while open may not resize it either,
// so both are re-measured here.
useResizeObserver(el, measure)
watch([el, () => text, open], async () => {
  await nextTick()
  measure()
})
</script>

<template>
  <div>
    <p
      ref="el"
      :lang="lang"
      class="max-w-prose text-sm wrap-break-word whitespace-pre-line"
      :class="{ 'line-clamp-12': clamp && !open }"
      data-testid="listing-description-text"
    >
      {{ text }}
    </p>
    <UButton
      v-if="clamp && clamped"
      variant="link"
      class="mt-2 px-0"
      :aria-expanded="open"
      data-testid="listing-description-toggle"
      @click="open = !open"
      >{{ open ? 'Show less' : 'Show full description' }}</UButton
    >
  </div>
</template>
