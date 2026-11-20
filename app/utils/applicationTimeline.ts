import type { ListingDetail } from '~/composables/useListing'

type Status = ListingDetail['status']
type StatusEntry = ListingDetail['statusHistory'][number]
type Interview = ListingDetail['interviews'][number]
type Document = ListingDetail['documents'][number]

export const FINISHED_STATUSES: readonly Status[] = ['ACCEPTED', 'REJECTED', 'WITHDRAWN']

// The API's REJECTED and WITHDRAWN mean different things after an offer: the company withdrew it,
// or we declined it. So a status reads by who acted, given the status before it.
export const statusLabel = (status: Status, previous?: Status) => {
  const afterOffer = previous === 'OFFER'
  switch (status) {
    case 'SAVED':
      return 'Saved'
    case 'APPLIED':
      return 'Applied'
    case 'INTERVIEWING':
      return 'Interviewing'
    case 'OFFER':
      return 'Offer received'
    case 'ACCEPTED':
      return 'Accepted'
    case 'REJECTED':
      return afterOffer ? 'Offer withdrawn by company' : 'Rejected by company'
    case 'WITHDRAWN':
      return afterOffer ? 'Declined by you' : 'Withdrawn by you'
  }
}

// "today", "tomorrow", "in 3 days", "yesterday", "3 days ago" for a DateTime instant, counted in
// local calendar days. The future-aware sibling of daysAgoLabel (utils/followUp.ts).
export const relativeDays = (instant: string) => {
  const days = daysFromToday(new Date(instant).toLocaleDateString('sv-SE'))
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

// A DateTime instant as a local calendar date, for rows where the time of day adds nothing.
export const formatInstantDate = (instant: string) =>
  formatDate(new Date(instant).toLocaleDateString('sv-SE'))

type RowBase = { key: string; at: string; label: string; note: string | null }
export type TimelineRow =
  | (RowBase & { kind: 'status'; entry: StatusEntry; sent: Document[] })
  | (RowBase & { kind: 'interview'; interview: Interview; upcoming: boolean })

// Status changes at their date and interviews at their scheduled time, newest first so upcoming
// interviews lead. INTERVIEWING entries are left out: the API stamps them when the first interview
// is logged, and that date read as a wrong interview date beside the interview itself. SAVED isn't
// a step of the application, so it has no row either.
export const timelineRows = (
  listing: Pick<ListingDetail, 'statusHistory' | 'interviews' | 'documents'>,
  now = Date.now()
): TimelineRow[] => {
  const statuses = listing.statusHistory.flatMap((entry, i): TimelineRow[] =>
    entry.status === 'INTERVIEWING' || entry.status === 'SAVED'
      ? []
      : [
          {
            kind: 'status',
            key: `s-${entry.id}`,
            at: entry.occurredAt,
            entry,
            label: statusLabel(entry.status, listing.statusHistory[i - 1]?.status),
            note: entry.note,
            sent: entry.status === 'APPLIED' ? listing.documents.filter((d) => d.sentAt) : []
          }
        ]
  )
  const interviews = listing.interviews.map((interview): TimelineRow => ({
    kind: 'interview',
    key: `i-${interview.id}`,
    at: interview.scheduledAt,
    label: interview.title || 'Interview',
    note: interview.notes,
    interview,
    upcoming: Date.parse(interview.scheduledAt) >= now
  }))
  return [...statuses, ...interviews].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

// One line on where the application stands, for the top of the card.
export const applicationContext = (
  listing: Pick<ListingDetail, 'status' | 'statusHistory' | 'interviews'>,
  now = Date.now()
) => {
  const history = listing.statusHistory
  const current = history.at(-1)
  const at = current ? formatInstantDate(current.occurredAt) : ''
  const upcoming = listing.interviews.filter((i) => Date.parse(i.scheduledAt) >= now)
  const past = listing.interviews.filter((i) => Date.parse(i.scheduledAt) < now)
  const nextInterview = upcoming[0]
  const lastInterview = past.at(-1)

  switch (listing.status) {
    case 'SAVED':
      return { line: 'Not applied yet.', nextInterview }
    case 'APPLIED':
      return {
        line: current ? `Applied ${at} · ${relativeDays(current.occurredAt)}` : 'Applied',
        nextInterview
      }
    case 'INTERVIEWING': {
      let line = 'No interviews scheduled.'
      if (nextInterview)
        line = `Next: ${nextInterview.title || 'Interview'} · ${formatDateTime(nextInterview.scheduledAt)} (${relativeDays(nextInterview.scheduledAt)})`
      else if (lastInterview)
        line = `Last interview ${formatInstantDate(lastInterview.scheduledAt)} · none scheduled`
      return { line, nextInterview }
    }
    default: {
      const label = statusLabel(listing.status, history.at(-2)?.status)
      return { line: current ? `${label} ${at}` : label, nextInterview }
    }
  }
}
