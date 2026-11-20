import type { ListingDetail } from '~/composables/useListing'

// The ListingById fields the Application card and its timeline read (see useListing.ts).
// Times without a zone are local, so dates read the same in any time zone.

type Entry = ListingDetail['statusHistory'][number]
type Interview = ListingDetail['interviews'][number]
type Document = ListingDetail['documents'][number]

// Tests fake the clock to this moment.
export const NOW = '2026-11-18T12:00:00'

export const APPLIED_AT = '2026-11-10T09:00:00'

export const history = (...steps: [Entry['status'], string, (string | null)?][]): Entry[] =>
  steps.map(([status, occurredAt, note], i) => ({
    id: i + 1,
    status,
    occurredAt,
    note: note ?? null
  }))

export const interview = (
  id: number,
  scheduledAt: string,
  title: string | null = 'HR screen',
  notes: string | null = null
): Interview => ({ id, scheduledAt, title, notes })

export const sentCv = {
  id: 91,
  kind: 'CV',
  fileName: 'cv-acme.pdf',
  createdAt: '2026-11-08T14:20:00',
  sentAt: APPLIED_AT,
  origin: 'TAILORED',
  baseCvVersion: null
} as unknown as Document

export const unsentCv = {
  ...sentCv,
  id: 93,
  fileName: 'cv-unsent.pdf',
  sentAt: null
} as unknown as Document

export const applicationListing = (overrides: Partial<ListingDetail> = {}) =>
  ({
    id: 5,
    status: 'SAVED',
    statusHistory: [],
    interviews: [],
    documents: [],
    archivedAt: null,
    company: { id: 3, name: 'Acme', applicationCount: 0, avoidedAt: null },
    ...overrides
  }) as unknown as ListingDetail
