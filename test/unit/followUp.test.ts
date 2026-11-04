import { describe, expect, it } from 'vitest'
import { daysAgoLabel, followUpSummary } from '~/utils/followUp'

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

describe('follow-up chip', () => {
  it('says how late an overdue follow-up is, and flags today', () => {
    expect(followUpSummary(inDays(-5))).toMatchObject({ label: 'Overdue 5 d', color: 'error' })
    expect(followUpSummary(inDays(0))).toMatchObject({ label: 'Due today', color: 'warning' })
  })

  it('shows an upcoming follow-up as its date, without urgency', () => {
    const { label, color } = followUpSummary(inDays(4))
    expect(label).toMatch(/^Due \d{1,2}\. \S+/)
    expect(color).toBe('neutral')
  })
})

describe('last contacted', () => {
  it('counts local calendar days', () => {
    expect(daysAgoLabel(new Date().toISOString())).toBe('today')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(daysAgoLabel(yesterday.toISOString())).toBe('yesterday')
    const older = new Date()
    older.setDate(older.getDate() - 9)
    expect(daysAgoLabel(older.toISOString())).toBe('9 days ago')
  })
})
