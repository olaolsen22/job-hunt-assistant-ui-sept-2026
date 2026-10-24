import { describe, expect, it } from 'vitest'

describe('isOverLimit', () => {
  it('allows an answer exactly at the limit and rejects one over', () => {
    expect(isOverLimit('abc', 3)).toBe(false)
    expect(isOverLimit('abcd', 3)).toBe(true)
  })

  it('falls back to the answer maximum without a limit', () => {
    expect(isOverLimit('a'.repeat(ANSWER_MAX), null)).toBe(false)
    expect(isOverLimit('a'.repeat(ANSWER_MAX + 1), undefined)).toBe(true)
  })

  it('counts a line break as one character', () => {
    expect(isOverLimit('a\nb', 3)).toBe(false)
  })
})
