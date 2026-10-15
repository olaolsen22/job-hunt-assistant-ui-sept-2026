import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deadlineLevel, dueSummary } from '~/utils/dueUrgency'

describe('dueSummary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('counts days left on a dated deadline and calls a past one expired', () => {
    expect(dueSummary({ deadlineType: 'DATE', dueOn: '2026-10-18' }).label).toBe('3 days left')
    expect(dueSummary({ deadlineType: 'DATE', dueOn: '2026-10-16' }).label).toBe('1 day left')
    expect(dueSummary({ deadlineType: 'DATE', dueOn: '2026-10-15' }).label).toBe('Due today')
    expect(dueSummary({ deadlineType: 'DATE', dueOn: '2026-10-14' }).label).toBe('Expired')
  })

  it('marks estimated due dates as approximate and past ones as likely filled', () => {
    expect(dueSummary({ deadlineType: 'ASAP', dueOn: '2026-10-27' }).label).toBe(
      'ASAP · ~12 days left'
    )
    expect(dueSummary({ deadlineType: 'UNSPECIFIED', dueOn: '2026-10-20' }).label).toBe(
      '~5 days left'
    )
    expect(dueSummary({ deadlineType: 'UNSPECIFIED', dueOn: '2026-10-01' }).label).toBe(
      'Likely filled'
    )
  })
})

describe('deadlineLevel', () => {
  it('goes from red when expired to blue when more than a week away', () => {
    expect([-2, 0, 3, 5, 7, 8].map(deadlineLevel)).toEqual([
      'red',
      'red',
      'orange',
      'yellow',
      'green',
      'blue'
    ])
  })
})
