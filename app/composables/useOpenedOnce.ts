// For `<LazyX v-if="opened">`: true from the first time `open` turns true, then for good. The
// modal's code loads only when it's first needed, and it stays mounted so the close animation can
// play (a `v-if="open"` unmounts it mid-animation).
export const useOpenedOnce = (open: Ref<boolean>) => {
  const opened = ref(open.value)
  watch(open, (isOpen) => {
    if (isOpen) opened.value = true
  })
  return opened
}
