// Reading list views back from the URL (/listings, /companies). Unknown values are dropped, so a
// stale or hand-edited link still opens a sensible list.

// "a,b" → ['a', 'b']; missing → [].
export const listParam = (value: unknown) =>
  String(value ?? '')
    .split(',')
    .filter(Boolean)

// Only the values in `values`, e.g. enum members.
export const knownParams = <T extends string>(values: readonly T[], value: unknown) =>
  listParam(value).filter((v): v is T => (values as readonly string[]).includes(v))

export const dateParam = (value: unknown) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : ''

export const intParam = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}
