import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListingDetail } from '~/composables/useListing'
import {
  applicationContext,
  relativeDays,
  statusLabel,
  timelineRows
} from '~/utils/applicationTimeline'

type Entry = ListingDetail['statusHistory'][number]
type Interview = ListingDetail['interviews'][number]
type Document = ListingDetail['documents'][number]

// Times without a zone are local, so the calendar-day maths holds in any time zone.
const NOW = '2026-11-18T12:00:00'

const history = (...steps: [Entry['status'], string, string?][]): Entry[] =>
  steps.map(([status, occurredAt, note], i) => ({
    id: i + 1,
    status,
    occurredAt,
    note: note ?? null
  }))
const interview = (id: number, scheduledAt: string, title: string | null = 'HR screen') =>
  ({ id, scheduledAt, title, notes: null }) as Interview
const doc = (id: number, fileName: string, sentAt: string | null) =>
  ({ id, kind: 'CV', fileName, createdAt: '2026-11-08T10:00:00', sentAt }) as Document

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => vi.useRealTimers())

describe('statusLabel', () => {
  it('names a rejection or withdrawal by who acted', () => {
    expect(statusLabel('REJECTED', 'APPLIED')).toBe('Rejected by company')
    expect(statusLabel('WITHDRAWN', 'INTERVIEWING')).toBe('Withdrawn by you')
    expect(statusLabel('REJECTED', 'OFFER')).toBe('Offer withdrawn by company')
    expect(statusLabel('WITHDRAWN', 'OFFER')).toBe('Declined by you')
    expect(statusLabel('OFFER', 'INTERVIEWING')).toBe('Offer received')
  })
})

describe('relativeDays', () => {
  it('counts local calendar days, not 24-hour spans', () => {
    expect(relativeDays('2026-11-18T23:30:00')).toBe('today')
    expect(relativeDays('2026-11-19T00:30:00')).toBe('tomorrow')
    expect(relativeDays('2026-11-17T23:59:00')).toBe('yesterday')
    expect(relativeDays('2026-11-25T10:00:00')).toBe('in 7 days')
    expect(relativeDays('2026-11-10T09:00:00')).toBe('8 days ago')
  })
})

describe('timelineRows', () => {
  it('merges status changes and interviews newest first, without the Interviewing stamp', () => {
    const rows = timelineRows({
      statusHistory: history(
        ['APPLIED', '2026-11-10T09:00:00'],
        // Stamped when the first interview was logged: not an interview date.
        ['INTERVIEWING', '2026-11-11T16:00:00']
      ),
      interviews: [interview(1, '2026-11-14T13:00:00'), interview(2, '2026-11-25T10:00:00')],
      documents: []
    })

    expect(rows.map((r) => r.key)).toEqual(['i-2', 'i-1', 's-1'])
    expect(rows.map((r) => r.kind === 'interview' && r.upcoming)).toEqual([true, false, false])
  })

  it('labels each status by the one before it, even a hidden Interviewing', () => {
    const rows = timelineRows({
      statusHistory: history(
        ['APPLIED', '2026-11-10T09:00:00'],
        ['INTERVIEWING', '2026-11-11T16:00:00'],
        ['OFFER', '2026-11-15T12:00:00'],
        ['WITHDRAWN', '2026-11-17T12:00:00']
      ),
      interviews: [],
      documents: []
    })

    expect(rows.map((r) => r.kind === 'status' && r.label)).toEqual([
      'Declined by you',
      'Offer received',
      'Applied'
    ])
  })

  it('lists only the sent documents, and only on the Applied row', () => {
    const rows = timelineRows({
      statusHistory: history(
        ['APPLIED', '2026-11-10T09:00:00'],
        ['REJECTED', '2026-11-16T07:00:00']
      ),
      interviews: [],
      documents: [doc(1, 'cv.pdf', '2026-11-10T09:00:00'), doc(2, 'draft.pdf', null)]
    })

    const [rejected, applied] = rows
    expect(rejected?.kind === 'status' && rejected.sent).toEqual([])
    expect(applied?.kind === 'status' && applied.sent.map((d) => d.fileName)).toEqual(['cv.pdf'])
  })

  it('counts an interview at this very moment as upcoming', () => {
    const [row] = timelineRows({
      statusHistory: [],
      interviews: [interview(1, NOW)],
      documents: []
    })
    expect(row?.kind === 'interview' && row.upcoming).toBe(true)
  })
})

describe('applicationContext', () => {
  const applied: [Entry['status'], string] = ['APPLIED', '2026-11-10T09:00:00']

  it('says a saved listing is not applied yet', () => {
    expect(applicationContext({ status: 'SAVED', statusHistory: [], interviews: [] }).line).toBe(
      'Not applied yet.'
    )
  })

  it('gives the application date and how long ago', () => {
    expect(
      applicationContext({ status: 'APPLIED', statusHistory: history(applied), interviews: [] })
        .line
    ).toBe('Applied 10. nov. 2026 · 8 days ago')
  })

  it('leads with the next interview, untitled ones as Interview', () => {
    const context = applicationContext({
      status: 'INTERVIEWING',
      statusHistory: history(applied, ['INTERVIEWING', '2026-11-11T16:00:00']),
      interviews: [
        interview(1, '2026-11-14T13:00:00'),
        interview(2, '2026-11-25T10:00:00', null),
        interview(3, '2026-11-30T10:00:00', 'Final')
      ]
    })
    expect(context.line).toBe('Next: Interview · 25. nov. 2026, 10:00 (in 7 days)')
    expect(context.nextInterview?.id).toBe(2)
  })

  it('falls back to the last interview, then to none', () => {
    const statusHistory = history(applied, ['INTERVIEWING', '2026-11-11T16:00:00'])
    expect(
      applicationContext({
        status: 'INTERVIEWING',
        statusHistory,
        interviews: [interview(1, '2026-11-12T13:00:00'), interview(2, '2026-11-14T13:00:00')]
      }).line
    ).toBe('Last interview 14. nov. 2026 · none scheduled')
    expect(applicationContext({ status: 'INTERVIEWING', statusHistory, interviews: [] }).line).toBe(
      'No interviews scheduled.'
    )
  })

  it.each([
    [history(applied, ['OFFER', '2026-11-17T12:00:00']), 'OFFER', 'Offer received 17. nov. 2026'],
    [
      history(applied, ['REJECTED', '2026-11-16T07:00:00']),
      'REJECTED',
      'Rejected by company 16. nov. 2026'
    ],
    [
      history(applied, ['OFFER', '2026-11-15T12:00:00'], ['WITHDRAWN', '2026-11-17T12:00:00']),
      'WITHDRAWN',
      'Declined by you 17. nov. 2026'
    ],
    [
      history(applied, ['OFFER', '2026-11-15T12:00:00'], ['ACCEPTED', '2026-11-17T12:00:00']),
      'ACCEPTED',
      'Accepted 17. nov. 2026'
    ]
  ] as const)('names an outcome by who acted and when (%#)', (statusHistory, status, line) => {
    expect(applicationContext({ status, statusHistory, interviews: [] }).line).toBe(line)
  })
})
