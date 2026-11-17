import type { Language } from '~/constants/listing'

// The letter's details: the sender and recipient block above the subject, refilled from the profile
// by "Reset details from profile". The subject isn't one of them: the AI writes it with the body.
export const COVER_LETTER_HEADER_KEYS = [
  'fullName',
  'address',
  'phone',
  'email',
  'date',
  'organization',
  'recipientName',
  'recipientAddress'
] as const
type HeaderKey = (typeof COVER_LETTER_HEADER_KEYS)[number]

type TextKey = HeaderKey | 'subject' | 'greeting' | 'closing'

// The editor's copy: plain strings, so every field binds to an input and an untouched blank stays ''.
// `brief` (notes for the AI) and `relocationLeadWeeks` steer the AI; both are saved with the draft
// but never printed.
export type CoverLetter = Record<TextKey | 'brief', string> & {
  language: Language
  paragraphs: string[]
  relocationLeadWeeks: number | null
}

type CoverLetterContentLike = { language: Language; paragraphs: readonly string[] } & {
  [K in TextKey]?: string | null
}

export const coverLetterFromContent = (
  content: CoverLetterContentLike,
  brief?: string | null,
  relocationLeadWeeks?: number | null
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
  brief: brief ?? '',
  relocationLeadWeeks: relocationLeadWeeks ?? null
})

// Copies a new letter's text (AI, your own AI, a pasted one) into the editor's letter: what the
// reader reads. The details, the language and the notes stay the editor's.
export const withCoverLetterBody = (letter: CoverLetter, body: CoverLetter): CoverLetter => ({
  ...letter,
  subject: body.subject,
  greeting: body.greeting,
  paragraphs: [...body.paragraphs],
  closing: body.closing
})

export const hasCoverLetterBody = (letter: Pick<CoverLetter, 'paragraphs'>) =>
  letter.paragraphs.some((p) => p.trim())

const orNull = (value: string) => value.trim() || null

// Blank fields go out as null (a Norwegian letter has no greeting) and empty paragraphs are dropped.
// The weeks are always sent, since a missing value would clear the saved one.
export const toCoverLetterInput = (letter: CoverLetter) => {
  const { language, paragraphs, brief, relocationLeadWeeks, ...fields } = letter
  return {
    content: {
      language,
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, orNull(value)])),
      paragraphs: paragraphs.map((p) => p.trim()).filter(Boolean)
    },
    brief: orNull(brief),
    relocationLeadWeeks
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
