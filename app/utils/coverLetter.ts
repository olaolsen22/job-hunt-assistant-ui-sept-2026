import type { Language } from '~/constants/listing'

// The letter's header: everything above the greeting, refilled from the profile by "Reset header".
export const COVER_LETTER_HEADER_KEYS = [
  'fullName',
  'address',
  'phone',
  'email',
  'date',
  'organization',
  'recipientName',
  'recipientAddress',
  'subject'
] as const
type HeaderKey = (typeof COVER_LETTER_HEADER_KEYS)[number]

// The editor's copy: plain strings, so every field binds to an input and an untouched blank stays ''.
// `brief` is the owner's notes for the AI; it's saved with the draft but never printed.
export type CoverLetter = Record<HeaderKey | 'greeting' | 'closing' | 'brief', string> & {
  language: Language
  paragraphs: string[]
}

type CoverLetterContentLike = { language: Language; paragraphs: readonly string[] } & {
  [K in HeaderKey | 'greeting' | 'closing']?: string | null
}

export const coverLetterFromContent = (
  content: CoverLetterContentLike,
  brief?: string | null
): CoverLetter => ({
  language: content.language,
  fullName: content.fullName ?? '',
  address: content.address ?? '',
  phone: content.phone ?? '',
  email: content.email ?? '',
  date: content.date ?? '',
  organization: content.organization ?? '',
  recipientName: content.recipientName ?? '',
  recipientAddress: content.recipientAddress ?? '',
  subject: content.subject ?? '',
  greeting: content.greeting ?? '',
  closing: content.closing ?? '',
  paragraphs: [...content.paragraphs],
  brief: brief ?? ''
})

const orNull = (value: string) => value.trim() || null

// Blank fields go out as null (a Norwegian letter has no greeting) and empty paragraphs are dropped.
export const toCoverLetterInput = (letter: CoverLetter) => {
  const { language, paragraphs, brief, ...fields } = letter
  return {
    content: {
      language,
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, orNull(value)])),
      paragraphs: paragraphs.map((p) => p.trim()).filter(Boolean)
    },
    brief: orNull(brief)
  }
}

// The letter as it reads, for pasting into an application form. Forms usually hold the contact
// details already, so the header block can be left out.
export const coverLetterToText = (letter: CoverLetter, includeHeader = true) =>
  [
    ...(includeHeader
      ? [
          [letter.fullName, letter.address, letter.phone, letter.email],
          [letter.date],
          [letter.organization, letter.recipientName, letter.recipientAddress],
          [letter.subject]
        ]
      : []),
    [letter.greeting],
    ...letter.paragraphs.map((p) => [p]),
    [letter.closing, letter.fullName]
  ]
    .map((block) =>
      block
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
    )
    .filter(Boolean)
    .join('\n\n')
