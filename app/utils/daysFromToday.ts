// Negative for past dates. Round, not floor: a DST switch makes one day 23 or 25 hours long.
export const daysFromToday = (iso: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000)
}
