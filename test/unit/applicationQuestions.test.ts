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

describe('parseQuestionLines', () => {
  it('skips blank lines and reads a trailing limit', () => {
    expect(parseQuestionLines('Why us? (500)\n\n  \nWhy you?', 5)).toEqual([
      { question: 'Why us?', charLimit: 500, overflow: false, error: undefined },
      { question: 'Why you?', charLimit: null, overflow: false, error: undefined }
    ])
  })

  it('drops a leading "1." or "1)" from numbered forms', () => {
    expect(parseQuestionLines('1. Why us?\n2) Why you? (200)', 5).map((l) => l.question)).toEqual([
      'Why us?',
      'Why you?'
    ])
  })

  it('keeps a number that is part of the question', () => {
    expect(parseQuestionLines('2026 goals?', 5)[0]!.question).toBe('2026 goals?')
  })

  it('marks lines past the remaining slots as overflow', () => {
    expect(parseQuestionLines('A\nB\nC', 2).map((l) => l.overflow)).toEqual([false, false, true])
  })

  it('flags a line with only a limit, an over-long question and a bad limit', () => {
    const lines = parseQuestionLines(
      `(500)\n${'a'.repeat(QUESTION_MAX + 1)}\nZero? (0)\nHuge? (${CHAR_LIMIT_MAX + 1})\nMax? (${CHAR_LIMIT_MAX})`,
      10
    )
    expect(lines.map((l) => l.error)).toEqual([
      'A limit on its own line. Join it to the line above.',
      `Over ${QUESTION_MAX} characters`,
      `Remove (0) or use a limit from 1 to ${CHAR_LIMIT_MAX}`,
      `Remove (${CHAR_LIMIT_MAX + 1}) or use a limit from 1 to ${CHAR_LIMIT_MAX}`,
      undefined
    ])
  })

  it('accepts a question exactly at the maximum length', () => {
    expect(parseQuestionLines('a'.repeat(QUESTION_MAX), 1)[0]!.error).toBeUndefined()
  })

  it('returns nothing for empty text', () => {
    expect(parseQuestionLines('  \n\n', 5)).toEqual([])
  })
})
