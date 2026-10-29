import type { ResultOf } from 'gql.tada'
// Explicit imports: the service worker imports this file and gets no Nuxt auto-imports.
import { graphql } from './graphql'
import { daysFromToday } from './daysFromToday'
import { formatDateTime } from './formatDateTime'

// One request per background check: saved listings closing today or tomorrow, plus the
// Interviewing listings with a future interview (the dashboard's Interviews filter).
export const REMINDERS = graphql(`
  query Reminders($now: DateTime!) {
    dueSoon: listings(take: 20, dueWithinDays: 1, where: { status: { eq: SAVED } }) {
      items {
        id
        title
        dueOn
        company {
          name
        }
      }
    }
    interviewing: listings(
      take: 20
      where: { status: { eq: INTERVIEWING }, interviews: { some: { scheduledAt: { gte: $now } } } }
    ) {
      items {
        id
        title
        company {
          name
        }
        interviews(order: [{ scheduledAt: ASC }]) {
          id
          scheduledAt
        }
      }
    }
  }
`)

export type Reminder = { key: string; title: string; body: string; url: string }

const DAY_MS = 86_400_000

// The key changes when the date does, so a moved deadline or interview is announced again.
export const pickReminders = (data: ResultOf<typeof REMINDERS>): Reminder[] => {
  const now = Date.now()
  const due = (data.dueSoon?.items ?? []).flatMap((l) => {
    const days = l.dueOn ? daysFromToday(l.dueOn) : -1
    if (days !== 0 && days !== 1) return []
    return {
      key: `due-${l.id}-${l.dueOn}`,
      title: days === 0 ? 'Closes today' : 'Closes tomorrow',
      body: `${l.title} at ${l.company.name}`,
      url: `/listings/${l.id}`
    }
  })
  const interviews = (data.interviewing?.items ?? []).flatMap((l) =>
    l.interviews
      .filter((i) => {
        const at = new Date(i.scheduledAt).getTime()
        return at >= now && at <= now + DAY_MS
      })
      .map((i) => ({
        key: `interview-${i.id}-${i.scheduledAt}`,
        title: 'Interview coming up',
        body: `${l.title} at ${l.company.name} · ${formatDateTime(i.scheduledAt)}`,
        url: `/listings/${l.id}`
      }))
  )
  return [...due, ...interviews]
}

export const newReminders = (reminders: Reminder[], notified: string[]) =>
  reminders.filter((r) => !notified.includes(r.key))
