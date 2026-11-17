import { describe, expect, it } from 'vitest'
import {
  COVER_LETTER_HEADER_KEYS,
  coverLetterFromContent,
  coverLetterToText,
  hasCoverLetterBody,
  toCoverLetterInput,
  withCoverLetterBody
} from '~/utils/coverLetter'

const content = (over: Record<string, unknown> = {}) => ({
  language: 'ENGLISH' as const,
  fullName: 'Ada Lovelace',
  address: 'Storgata 1\n0155 Oslo',
  phone: null,
  email: 'ada@example.com',
  date: '2026-10-15',
  organization: 'Acme',
  recipientName: null,
  recipientAddress: null,
  subject: 'Application for Developer',
  greeting: 'Dear team,',
  paragraphs: ['First', 'Second'],
  closing: 'Kind regards,',
  ...over
})

describe('coverLetter utils', () => {
  it('builds the editor copy with blanks as empty strings and carries notes and weeks', () => {
    const letter = coverLetterFromContent(content(), 'Mention the meetup', 6)
    expect(letter).toMatchObject({
      language: 'ENGLISH',
      phone: '',
      recipientName: '',
      recipientAddress: '',
      brief: 'Mention the meetup',
      relocationLeadWeeks: 6,
      paragraphs: ['First', 'Second']
    })
    // Without them both default to nothing.
    const bare = coverLetterFromContent(content())
    expect(bare.brief).toBe('')
    expect(bare.relocationLeadWeeks).toBeNull()
  })

  it('copies the paragraphs instead of sharing the API array', () => {
    const source = content()
    const letter = coverLetterFromContent(source)
    letter.paragraphs.push('Third')
    expect(source.paragraphs).toEqual(['First', 'Second'])
  })

  it('keeps the subject out of the details that Reset from profile refills', () => {
    expect(COVER_LETTER_HEADER_KEYS).not.toContain('subject')
    expect(COVER_LETTER_HEADER_KEYS).toContain('fullName')
    expect(COVER_LETTER_HEADER_KEYS).toContain('recipientAddress')
  })

  it('takes only subject, greeting, paragraphs and closing from a new letter', () => {
    const mine = coverLetterFromContent(
      content({ fullName: 'Me', organization: 'Mine AS' }),
      'n',
      4
    )
    const incoming = coverLetterFromContent(
      content({
        language: 'NORWEGIAN',
        fullName: 'Other',
        organization: 'Other AS',
        subject: 'New subject',
        greeting: '',
        paragraphs: ['New one'],
        closing: 'Hilsen'
      })
    )
    const merged = withCoverLetterBody(mine, incoming)
    expect(merged).toMatchObject({
      language: 'ENGLISH',
      fullName: 'Me',
      organization: 'Mine AS',
      brief: 'n',
      relocationLeadWeeks: 4,
      subject: 'New subject',
      greeting: '',
      paragraphs: ['New one'],
      closing: 'Hilsen'
    })
    merged.paragraphs.push('x')
    expect(incoming.paragraphs).toEqual(['New one'])
  })

  it('counts a body only when a paragraph has text', () => {
    expect(hasCoverLetterBody({ paragraphs: [] })).toBe(false)
    expect(hasCoverLetterBody({ paragraphs: ['  ', ''] })).toBe(false)
    expect(hasCoverLetterBody({ paragraphs: ['', 'Hi'] })).toBe(true)
  })

  it('sends blanks as null, drops empty paragraphs and always sends the weeks', () => {
    const letter = coverLetterFromContent(
      content({ paragraphs: [' First ', '  ', 'Second'] }),
      '  '
    )
    letter.greeting = '   '
    const input = toCoverLetterInput(letter)
    expect(input).toEqual({
      content: {
        language: 'ENGLISH',
        fullName: 'Ada Lovelace',
        address: 'Storgata 1\n0155 Oslo',
        phone: null,
        email: 'ada@example.com',
        date: '2026-10-15',
        organization: 'Acme',
        recipientName: null,
        recipientAddress: null,
        subject: 'Application for Developer',
        greeting: null,
        paragraphs: ['First', 'Second'],
        closing: 'Kind regards,'
      },
      brief: null,
      relocationLeadWeeks: null
    })
    expect('relocationLeadWeeks' in input).toBe(true)
    expect(toCoverLetterInput(coverLetterFromContent(content(), 'Notes', 3))).toMatchObject({
      brief: 'Notes',
      relocationLeadWeeks: 3
    })
  })

  it('writes the letter as text, with or without the header block', () => {
    const letter = coverLetterFromContent(content(), 'Never printed', 2)
    expect(coverLetterToText(letter)).toBe(
      [
        'Ada Lovelace\nStorgata 1\n0155 Oslo\nada@example.com',
        '2026-10-15',
        'Acme',
        'Application for Developer',
        'Dear team,',
        'First',
        'Second',
        'Kind regards,\nAda Lovelace'
      ].join('\n\n')
    )
    expect(coverLetterToText(letter, false)).toBe(
      ['Dear team,', 'First', 'Second', 'Kind regards,\nAda Lovelace'].join('\n\n')
    )
    expect(coverLetterToText(letter)).not.toContain('Never printed')
  })
})
