import { useElementSize } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'

// Bottom toasts would cover a sticky bottom bar's buttons (Save, Merge, Set category). While the
// bar is shown and actually sticky, its height (plus a gap for bars at bottom-4) is published as
// --toast-clearance, which app.vue adds to the toaster's bottom offset.
export const useToastClearance = (bar: MaybeRefOrGetter<HTMLElement | null | undefined>) => {
  if (import.meta.server) return
  const { height } = useElementSize(bar, undefined, { box: 'border-box' })
  const style = document.documentElement.style
  watch(height, (h) => {
    const el = toValue(bar)
    // Quick add's bar is only sticky on phones.
    if (h && el && getComputedStyle(el).position === 'sticky')
      style.setProperty('--toast-clearance', `${Math.ceil(h) + 16}px`)
    else style.removeProperty('--toast-clearance')
  })
  onScopeDispose(() => style.removeProperty('--toast-clearance'))
}
