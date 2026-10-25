import type { Ref } from 'vue'

// One reviewed rewrite: the headline, the summary or a bullet, next to the profile text it replaces.
export type RewriteRow = {
  key: string
  label: string
  bulletId?: number
  field?: 'headline' | 'summary'
  // Undefined when the AI named a bullet that isn't on the profile: it can't be applied.
  current?: string
  text: string
  include: boolean
}

// What the apply mutations take: the ticked bullets, and null for an unchanged headline/summary.
export type RewriteSelection = {
  bullets: { id: number; text: string }[]
  headline: string | null
  summary: string | null
}

// The review step the skill wording and translation modals share: tick and edit each row, then
// apply them in one call. Closing a review that was edited asks first; an untouched one just goes.
export const useTextRewriteReview = <Row extends RewriteRow>(
  open: Ref<boolean>,
  reply: Ref<string>
) => {
  const rows = ref() as Ref<Row[] | undefined>
  const applyError = ref('')
  const confirmOpen = ref(false)

  const included = computed(() => rows.value?.filter((r) => r.include) ?? [])
  const blank = computed(() => included.value.filter((r) => !r.text.trim()).length)
  const canApply = computed(() => !!included.value.length && !blank.value)
  const applicable = computed(() => rows.value?.filter((r) => r.current != null).length ?? 0)
  const { dirty, mark, clear } = useReviewDirty(() => rows.value?.map((r) => [r.include, r.text]))

  const setAll = (include: boolean) =>
    rows.value?.forEach((r) => r.current != null && (r.include = include))

  const start = (next: Row[]) => {
    rows.value = next
    applyError.value = ''
    mark()
  }

  const discard = () => {
    confirmOpen.value = false
    rows.value = undefined
    reply.value = ''
    clear()
    open.value = false
  }
  const back = () => {
    rows.value = undefined
    clear()
  }
  const requestClose = () => (dirty.value ? (confirmOpen.value = true) : discard())

  // `done` runs only once the API accepted the change; the review then closes.
  const apply = async (
    save: (selection: RewriteSelection) => Promise<{ error?: string }>,
    done: () => void
  ) => {
    if (!canApply.value) return
    applyError.value = ''
    const pick = (field: RewriteRow['field']) => {
      const row = included.value.find((r) => r.field === field)
      return row ? row.text.trim() : null
    }
    const result = await save({
      bullets: included.value
        .filter((r) => r.bulletId != null)
        .map((r) => ({ id: r.bulletId!, text: r.text.trim() })),
      headline: pick('headline'),
      summary: pick('summary')
    })
    if (result.error !== undefined) {
      applyError.value = result.error
      return
    }
    done()
    discard()
  }

  return {
    rows,
    applyError,
    confirmOpen,
    included,
    blank,
    canApply,
    applicable,
    setAll,
    start,
    discard,
    back,
    requestClose,
    apply
  }
}
