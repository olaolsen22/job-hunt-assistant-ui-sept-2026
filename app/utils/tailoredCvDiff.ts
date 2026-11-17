import type {
  TailoredCv,
  TailoredCvBullet,
  TailoredCvExperience,
  TailoredCvSectionKey
} from '~/utils/tailoredCv'

// How an AI suggestion differs from the CV, built from structured values (not text) so the tailored
// CV page can mark each bullet and skill instead of showing two text dumps.

export type BulletDiffRow =
  | { kind: 'kept' | 'new' | 'removed'; text: string }
  | { kind: 'reworded'; text: string; old: string }

export type ChipDiffRow = { kind: 'kept' | 'added' | 'removed'; name: string }

// Rows follow the suggested order. Suggested bullets pair with current ones of the same profile
// bullet id first, then the rest by identical text; unpaired ones are new. Current bullets the
// suggestion drops come last, as removed.
export const diffBullets = (
  current: readonly TailoredCvBullet[],
  suggested: readonly TailoredCvBullet[]
): BulletDiffRow[] => {
  const used = new Set<TailoredCvBullet>()
  const pairs = suggested.map((b) => {
    const match =
      b.sourceBulletId == null
        ? undefined
        : current.find((c) => !used.has(c) && c.sourceBulletId === b.sourceBulletId)
    if (match) used.add(match)
    return match
  })
  const rows = suggested.map((b, i): BulletDiffRow => {
    const match = pairs[i] ?? current.find((c) => !used.has(c) && c.text.trim() === b.text.trim())
    if (!match) return { kind: 'new', text: b.text }
    used.add(match)
    return match.text.trim() === b.text.trim()
      ? { kind: 'kept', text: b.text }
      : { kind: 'reworded', text: b.text, old: match.text }
  })
  const removed = current
    .filter((b) => !used.has(b))
    .map((b): BulletDiffRow => ({ kind: 'removed', text: b.text }))
  return [...rows, ...removed]
}

// Kept and added in the suggested order, then the removed ones in their current order.
export const diffChips = <T>(
  current: readonly T[],
  suggested: readonly T[],
  id: (item: T) => string | number,
  name: (item: T) => string
): ChipDiffRow[] => {
  const currentIds = new Set(current.map(id))
  const suggestedIds = new Set(suggested.map(id))
  return [
    ...suggested.map((item) => ({
      kind: currentIds.has(id(item)) ? ('kept' as const) : ('added' as const),
      name: name(item)
    })),
    ...current
      .filter((item) => !suggestedIds.has(id(item)))
      .map((item) => ({ kind: 'removed' as const, name: name(item) }))
  ]
}

const sameName = (s: string) => s.trim().toLowerCase()

type DiffEntry = Pick<TailoredCvExperience, 'bullets' | 'paragraph'> & {
  technologies?: string[] | null
}

// What the page shows for one suggestion. Null keeps the plain current/suggested compare: short
// values (summary, headline), languages, and whole lists that gained entries or changed order.
export type SuggestionDiff =
  | { kind: 'skills'; chips: ChipDiffRow[] }
  | {
      kind: 'entry'
      // Bullets mode; in paragraphs mode the paragraphs are compared instead.
      bullets?: BulletDiffRow[]
      paragraph?: { current: string; suggested: string }
      technologies?: ChipDiffRow[]
      // Anything else that changed (title, dates, place), as plain text.
      details?: { current: string; suggested: string }
    }

const entryDetails = (
  key: TailoredCvSectionKey,
  entry: unknown,
  style: TailoredCv['contentStyle']
) =>
  cvSectionText(
    key,
    { ...(entry as object), bullets: [], paragraph: null, technologies: [] },
    style
  )

export const suggestionDiff = (
  key: TailoredCvSectionKey,
  current: unknown,
  suggested: unknown,
  style: TailoredCv['contentStyle']
): SuggestionDiff | null => {
  if (key === 'skills' && current && suggested) {
    const skills = (v: unknown) => v as TailoredCv['skills']
    return {
      kind: 'skills',
      chips: diffChips(
        skills(current),
        skills(suggested),
        (s) => s.sourceSkillId ?? sameName(s.name),
        (s) => s.name
      )
    }
  }
  if (!key.includes(':') || current == null || suggested == null) return null
  const a = current as DiffEntry
  const b = suggested as DiffEntry
  const technologies =
    a.technologies || b.technologies
      ? diffChips(a.technologies ?? [], b.technologies ?? [], sameName, (t) => t)
      : undefined
  const before = entryDetails(key, a, style)
  const after = entryDetails(key, b, style)
  return {
    kind: 'entry',
    ...(style === 'PARAGRAPH'
      ? (a.paragraph?.trim() ?? '') !== (b.paragraph?.trim() ?? '') && {
          paragraph: { current: a.paragraph?.trim() ?? '', suggested: b.paragraph?.trim() ?? '' }
        }
      : { bullets: diffBullets(a.bullets, b.bullets) }),
    // Shown only when something besides the order changed.
    technologies: technologies?.some((t) => t.kind !== 'kept') ? technologies : undefined,
    details: before === after ? undefined : { current: before, suggested: after }
  }
}

// A pending suggestion as the cards render it (see TailoredCvSuggestion for `replaces`).
export interface CvSuggestionView {
  key: TailoredCvSectionKey
  current: string
  suggested: string
  // An entry the AI reply left out: Accept removes it.
  removal?: boolean
  // Names this suggestion over the card's own `suggestionLabel` (a new entry, a new order).
  label?: string
  // The tailored CV's review: Keep current / Accept labels and, with `diff`, the marked diff.
  review?: boolean
  // Stands in for the card's or entry's content instead of sitting above it.
  replaces?: boolean
  diff?: SuggestionDiff | null
}
