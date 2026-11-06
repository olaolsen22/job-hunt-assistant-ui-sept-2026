// Untranslated-field paths from the API (`summary`, `experiences[0].bullets[2]`) grouped by the
// editor card that shows them: an entry (`experiences[0]`), a list section (`skills`), `summary`
// or `contact` (every other top-level field).
const FLAG_LISTS = ['experiences', 'educations', 'certifications', 'projects'] as const
export const cvFlagKey = (path: string) => {
  const entry = /^(\w+\[\d+\])/.exec(path)?.[1]
  const head = /^\w+/.exec(path)?.[0] ?? path
  if (entry && (FLAG_LISTS as readonly string[]).includes(head)) return entry
  if (head === 'summary' || head === 'skills' || head === 'languages') return head
  return 'contact'
}
export const cvFlagCounts = (paths: string[]) => {
  const counts = new Map<string, number>()
  for (const path of paths) counts.set(cvFlagKey(path), (counts.get(cvFlagKey(path)) ?? 0) + 1)
  return counts
}
export const clearCvFlags = (paths: string[], key: string) =>
  paths.filter((path) => cvFlagKey(path) !== key)
// After removing `list[index]` (an entry or a skill): its paths go, later items' move up one.
export const removeCvFlagItem = (paths: string[], list: string, index: number) =>
  paths.flatMap((path) => {
    const match = new RegExp(`^${list}\\[(\\d+)\\]`).exec(path)
    const at = match ? Number(match[1]) : -1
    if (at === index) return []
    return at > index ? [path.replace(match![0], `${list}[${at - 1}]`)] : [path]
  })
