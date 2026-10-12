// `new Date('2026-09-26')` parses as UTC midnight, which renders a day early in negative-offset
// zones. Appending a local time-of-day forces Date to parse it in the local zone instead.
export const formatDate = (iso: string, locale = 'nb-NO') =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${iso}T00:00:00`))
