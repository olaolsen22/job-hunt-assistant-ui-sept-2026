// Shared by ListingsDates (detail page, coloured text) and ListingsDueChip (list rows, badge),
// so both agree on how urgent a deadline is and how fresh a posting is.
export type UrgencyLevel = 'red' | 'orange' | 'yellow' | 'green' | 'blue'

// Past deadlines fall into the `<= 0` bucket and stay red.
export const deadlineLevel = (daysLeft: number): UrgencyLevel => {
  if (daysLeft <= 0) return 'red'
  if (daysLeft <= 3) return 'orange'
  if (daysLeft <= 5) return 'yellow'
  if (daysLeft <= 7) return 'green'
  return 'blue'
}

export const postedLevel = (daysAgo: number): UrgencyLevel => {
  if (daysAgo <= 0) return 'blue'
  if (daysAgo <= 3) return 'green'
  if (daysAgo <= 5) return 'yellow'
  if (daysAgo <= 7) return 'orange'
  return 'red'
}

export const URGENCY_TEXT: Record<UrgencyLevel, string> = {
  red: 'text-red-600/85 dark:text-red-400/85',
  orange: 'text-orange-600/85 dark:text-orange-400/85',
  yellow: 'text-yellow-600/85 dark:text-yellow-400/85',
  green: 'text-green-600/85 dark:text-green-400/85',
  blue: 'text-blue-600/85 dark:text-blue-400/85'
}

// Badges only take theme colors, so orange and yellow share warning; the label carries the days.
export const URGENCY_BADGE_COLOR = {
  red: 'error',
  orange: 'warning',
  yellow: 'warning',
  green: 'success',
  blue: 'info'
} as const satisfies Record<UrgencyLevel, string>

// Short label for a list row. The server owns dueOn (DATE: the deadline, ASAP: posted + 14,
// otherwise posted + 30), so ASAP/unstated deadlines are estimates and say so with "~". An
// unsolicited application has no due date, so null.
export const dueSummary = (listing: { deadlineType: string; dueOn: string | null }) => {
  if (!listing.dueOn) return null
  const daysLeft = daysFromToday(listing.dueOn)
  const exact = listing.deadlineType === 'DATE'
  const prefix = listing.deadlineType === 'ASAP' ? 'ASAP · ' : ''
  if (daysLeft < 0) return { label: exact ? 'Expired' : `${prefix}Likely filled`, daysLeft }
  if (daysLeft === 0) return { label: `${prefix}${exact ? '' : '~'}Due today`, daysLeft }
  const days = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
  return { label: `${prefix}${exact ? '' : '~'}${days}`, daysLeft }
}
