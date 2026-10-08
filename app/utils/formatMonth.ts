// Same local-time parsing trick as `formatDate`, so a first-of-month date never renders a month early.
export const formatMonth = (iso: string) =>
  new Intl.DateTimeFormat('nb-NO', { month: 'short', year: 'numeric' }).format(
    new Date(`${iso}T00:00:00`)
  )

// `openLabel` stands in for a missing end ("Present" for jobs); without it an open range shows just the start.
export const formatMonthRange = (
  start: string | null | undefined,
  end: string | null | undefined,
  openLabel?: string
) => {
  const from = start ? formatMonth(start) : null
  const to = end ? formatMonth(end) : (openLabel ?? null)
  if (from && to) return `${from} – ${to}`
  return from ?? to ?? ''
}

// Rounded to the nearest half year; the API only gives whole months.
export const formatYears = (months: number) => {
  if (months <= 0) return ''
  if (months < 12) return '<1 yr'
  const years = Math.round((months / 12) * 2) / 2
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`
}
