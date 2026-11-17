<script setup lang="ts">
// The tailored CV's sticky bar while AI changes wait for review: where the owner is in them, a way
// to step through (page order, wrapping around) and the bulk actions. Saving waits until it's gone.
const { count } = defineProps<{ count: number }>()
const emit = defineEmits<{ acceptAll: []; discardAll: [] }>()

const items = () => [
  ...document.querySelectorAll<HTMLElement>('[data-testid="tailored-cv-suggestion"]')
]
// The change last stepped to, and its place. Once it's accepted or kept the next one slides into
// that place, so Next goes there rather than skipping one.
let current: HTMLElement | undefined
let lastIndex = -1
const position = ref<number>()

const go = (index: number) => {
  const el = items()[index]
  if (!el) return
  current = el
  lastIndex = index
  position.value = index + 1
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
}
const step = (by: 1 | -1) => {
  const all = items()
  const n = all.length
  if (!n) return
  let at = current ? all.indexOf(current) : -1
  if (at === -1 && lastIndex === -1) return go(by === 1 ? 0 : n - 1)
  // The last change was accepted or kept: the one after it now sits at its old place.
  if (at === -1) at = by === 1 ? lastIndex - 1 : lastIndex
  go((at + by + n) % n)
}
watch(
  () => count,
  async () => {
    await nextTick()
    const at = current ? items().indexOf(current) : -1
    position.value = at === -1 ? undefined : at + 1
  }
)

const label = computed(() =>
  position.value
    ? `AI change ${position.value} of ${count}`
    : `${count} AI ${count === 1 ? 'change' : 'changes'} to review`
)
</script>

<template>
  <AppSaveBar
    :status="label"
    status-testid="tailored-cv-review-status"
    changed
    :warn="false"
    data-testid="tailored-cv-review-bar"
  >
    <!-- Stepping sits on the status line, icon-only, so the bar stays one row on desktop and two on
       phones, where it would otherwise cover the change being reviewed. -->
    <template #status>
      <span class="hidden text-xs sm:inline" data-testid="tailored-cv-review-hint"
        >Finish reviewing to save</span
      >
      <span class="ml-auto flex gap-2 sm:ml-0">
        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="subtle"
          aria-label="Previous AI change"
          data-testid="tailored-cv-review-previous"
          @click="step(-1)"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="subtle"
          aria-label="Next AI change"
          data-testid="tailored-cv-review-next"
          @click="step(1)"
        />
      </span>
    </template>
    <UButton
      color="neutral"
      variant="ghost"
      class="w-full justify-center sm:w-auto"
      data-testid="tailored-cv-review-discard"
      @click="emit('discardAll')"
      >Discard remaining</UButton
    >
    <UButton
      icon="i-lucide-check-check"
      class="w-full justify-center sm:w-auto"
      data-testid="tailored-cv-review-accept"
      @click="emit('acceptAll')"
      >Accept remaining ({{ count }})</UButton
    >
  </AppSaveBar>
</template>
