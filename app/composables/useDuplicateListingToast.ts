type MutationError = { __typename: string; existingListingId?: number }

// The API's duplicate-URL message only names the existing listing's id, so show a toast that links
// to it instead. Returns whether a duplicate was reported, so callers can skip their inline alert.
export const useDuplicateListingToast = () => {
  const notify = useAppToast()
  return (errors: readonly MutationError[]) => {
    const id = errors.find((e) => e.__typename === 'DuplicateListingError')?.existingListingId
    if (id === undefined) return false
    notify.error('This listing already exists', {
      description: 'Another listing already uses this ad URL.',
      icon: 'i-lucide-copy',
      action: { label: 'View existing listing', to: `/listings/${id}` }
    })
    return true
  }
}
