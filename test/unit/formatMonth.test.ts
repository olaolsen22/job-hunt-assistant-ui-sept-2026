import { describe, expect, it } from 'vitest'
import { formatMonth, formatMonthRange, formatYears } from '~/utils/formatMonth'

describe('formatMonth', () => {
  it('shows a short month and year without shifting the month', () => {
    expect(formatMonth('2021-03-01')).toMatch(/2021/)
    expect(formatMonth('2021-03-01')).toBe(formatMonth('2021-03-01'))
    expect(formatMonth('2021-03-01')).not.toBe(formatMonth('2021-02-01'))
  })

  it('joins a range and falls back to the open label', () => {
    expect(formatMonthRange('2020-01-01', '2021-03-01')).toBe(
      `${formatMonth('2020-01-01')} – ${formatMonth('2021-03-01')}`
    )
    expect(formatMonthRange('2020-01-01', null, 'Present')).toBe(
      `${formatMonth('2020-01-01')} – Present`
    )
    expect(formatMonthRange('2020-01-01', null)).toBe(formatMonth('2020-01-01'))
    expect(formatMonthRange(null, null)).toBe('')
  })

  it('formats years of experience', () => {
    expect(formatYears(0)).toBe('')
    expect(formatYears(5)).toBe('<1 yr')
    expect(formatYears(12)).toBe('1 yr')
    expect(formatYears(30)).toBe('2.5 yrs')
    expect(formatYears(24)).toBe('2 yrs')
  })
})
