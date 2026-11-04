type PageInfo = { hasNextPage: boolean; endCursor?: string | null }

// Numbered pages over a cursor connection (/companies, /contacts). The API only pages by cursor (no
// skip), so a page number works only once its cursor is known: `cursors[p - 1]` is the `after`
// cursor of page p.
export const useCursorPages = () => {
  const page = ref(1)
  const cursors = ref<(string | null)[]>([null])
  const walking = ref(false)
  const after = computed(() => cursors.value[page.value - 1] ?? null)

  // Call in the same tick as a search/filter change, or the refetch would pair it with an old cursor.
  const reset = () => {
    cursors.value = [null]
    page.value = 1
  }

  // Remembers where the next page starts, so Next and later numbered clicks need no extra requests.
  const remember = (pageInfo: PageInfo | null | undefined) => {
    if (pageInfo?.hasNextPage) cursors.value[page.value] = pageInfo.endCursor!
  }

  // Jumping past the known cursors walks forward one page at a time (`first` is capped at 50
  // server-side, so loading N pages in one request is not possible). A page from the URL can be past
  // the end, so the walk stops at the last page.
  const goTo = async (
    target: number,
    fetchPageInfo: (after: string | null) => Promise<PageInfo>
  ) => {
    walking.value = true
    try {
      while (cursors.value.length < target) {
        const pageInfo = await fetchPageInfo(cursors.value.at(-1) ?? null)
        if (!pageInfo.hasNextPage) break
        cursors.value.push(pageInfo.endCursor!)
      }
    } finally {
      walking.value = false
    }
    page.value = Math.min(target, cursors.value.length)
  }

  return { page, after, walking, reset, remember, goTo }
}
