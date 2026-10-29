import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newReminders, pickReminders } from '~/utils/reminders'

const listing = (id: number, dueOn: string | null) => ({
  id,
  title: `Job ${id}`,
  dueOn,
  company: { name: 'Acme' }
})
const interviewing = (id: number, scheduledAt: string) => ({
  id,
  title: `Job ${id}`,
  company: { name: 'Acme' },
  interviews: [{ id: id * 10, scheduledAt }]
})
const data = (
  dueSoon: ReturnType<typeof listing>[],
  withInterviews: ReturnType<typeof interviewing>[] = []
) => ({ dueSoon: { items: dueSoon }, interviewing: { items: withInterviews } })

describe('Reminder rules', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-29T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('reminds about saved listings closing today or tomorrow, not later', () => {
    const reminders = pickReminders(
      data([listing(1, '2026-10-29'), listing(2, '2026-10-30'), listing(3, '2026-10-31')])
    )

    expect(reminders.map((r) => [r.title, r.body, r.url])).toEqual([
      ['Closes today', 'Job 1 at Acme', '/listings/1'],
      ['Closes tomorrow', 'Job 2 at Acme', '/listings/2']
    ])
  })

  it('reminds about interviews within the next 24 hours only', () => {
    const at = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()
    const reminders = pickReminders(
      data([], [interviewing(1, at(23)), interviewing(2, at(25)), interviewing(3, at(-1))])
    )

    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({ title: 'Interview coming up', url: '/listings/1' })
    expect(reminders[0]!.body).toContain('Job 1 at Acme')
  })

  it('skips reminders already sent', () => {
    const reminders = pickReminders(data([listing(1, '2026-10-29'), listing(2, '2026-10-30')]))

    expect(newReminders(reminders, [reminders[0]!.key])).toEqual([reminders[1]])
  })
})
