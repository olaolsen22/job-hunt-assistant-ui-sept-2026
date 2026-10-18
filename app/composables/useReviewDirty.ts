// Whether a review was changed since it opened (an edit, a tick, a removal), so closing it only
// asks to discard when there is something to lose. Call mark() once the review rows are set.
export const useReviewDirty = (state: () => unknown) => {
  const baseline = ref<string>()
  const dirty = computed(
    () => baseline.value !== undefined && JSON.stringify(state()) !== baseline.value
  )
  const mark = () => (baseline.value = JSON.stringify(state()))
  const clear = () => (baseline.value = undefined)
  return { dirty, mark, clear }
}
