// Local YYYY-MM-DD, `days` before today (like todayIso, not UTC).
export const daysAgoIso = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toLocaleDateString('sv-SE')
}

// UTC instant of local midnight, `days` before today: the start of "the last N days" for DateTime filters.
export const localDayStartIso = (days: number) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString()
}
