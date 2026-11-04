// "12. nov." without the year: chips are short, and follow-ups are rarely far off.
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T00:00:00`)
  )

// A contact's follow-up date (a LocalDate) as a badge: the words carry the state, the color only
// backs it up. Upcoming ones are neutral, since nothing is late yet.
export const followUpSummary = (iso: string) => {
  const daysLeft = daysFromToday(iso)
  if (daysLeft < 0) return { label: `Overdue ${-daysLeft} d`, color: 'error' as const, daysLeft }
  if (daysLeft === 0) return { label: 'Due today', color: 'warning' as const, daysLeft }
  return { label: `Due ${shortDate(iso)}`, color: 'neutral' as const, daysLeft }
}

// "today", "yesterday", "3 days ago" for a DateTime instant, counted in local calendar days.
export const daysAgoLabel = (instant: string) => {
  const days = -daysFromToday(new Date(instant).toLocaleDateString('sv-SE'))
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
