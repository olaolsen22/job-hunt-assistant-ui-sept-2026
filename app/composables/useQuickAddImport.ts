import type { ListingImportDetail } from '~/composables/useListingImports'
import type { QuickAddPaste } from '~/composables/useQuickAddPaste'
import type { QuickAddRows } from '~/composables/useQuickAddRows'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// ?import=<id> (from /listings/imports) loads that file's jobs, checks them and adds the new ones
// as rows. `importId` is read once: the page is keyed by URL, so the next import remounts it.
export const useQuickAddImport = (
  importId: number | null,
  rows: QuickAddRows,
  paste: QuickAddPaste
) => {
  const info = ref<ListingImportDetail | null>(null)
  const error = ref('')
  const reviewed = ref(false)
  // Set once the opened import's rows are in, so a reviewed one doesn't flash as done while loading.
  const loaded = ref(false)
  const { setReviewed, loading: marking } = useSetImportReviewed()

  const load = async (id: number) => {
    try {
      info.value = await fetchListingImport(id)
    } catch {
      error.value = ERROR_MESSAGES.generic
      return
    }
    if (!info.value) error.value = 'That import no longer exists.'
    else if (info.value.error) error.value = info.value.error
    if (!info.value?.content) return
    reviewed.value = !!info.value.reviewedAt
    await paste.loadCollected(info.value.content)
    loaded.value = true
  }

  // The next pending import, so catching up is one click away.
  const { nextImportId, load: loadNext } = useNextImport(importId ?? 0)
  if (importId) {
    onMounted(async () => {
      await load(importId)
      await loadNext()
    })
  }

  const markReviewed = async () => {
    if (importId && !reviewed.value && (await setReviewed(importId, true))) reviewed.value = true
  }

  const loading = computed(() => !!importId && !loaded.value && !error.value)
  // Nothing left to save: the rows give way to what the check found and a way on.
  const done = computed(
    () =>
      loaded.value &&
      !error.value &&
      !paste.checkError.value &&
      !paste.collectedError.value &&
      !paste.hasUnsavedWork.value
  )
  // The check ran before this visit's saves, so those rows supply their new listings.
  const jobs = computed(() => {
    const savedIds = new Map(
      [...rows.flagged.value, ...rows.added.value].map((r) => [r.sourceUrl, r.saved.id])
    )
    return (paste.prepared.value?.jobs ?? []).map((checked) => {
      const savedId = savedIds.get(checked.job.url)
      return savedId ? { ...checked, savedListingIds: [savedId] } : checked
    })
  })
  const summary = computed(() => {
    const saved = jobs.value.filter((j) => j.savedListingIds.length).length
    const repeats = jobs.value.filter((j) => j.isRepeat).length
    const notSaved = jobs.value.length - saved - repeats
    return [
      saved && `${saved} saved`,
      repeats && `${repeats} ${repeats === 1 ? 'repeat' : 'repeats'} in the file`,
      notSaved && `${notSaved} not saved`,
      reviewed.value && 'Marked as reviewed'
    ]
      .filter(Boolean)
      .join(' · ')
  })

  return {
    info,
    error,
    reviewed,
    marking,
    nextImportId,
    markReviewed,
    loading,
    done,
    jobs,
    summary
  }
}
