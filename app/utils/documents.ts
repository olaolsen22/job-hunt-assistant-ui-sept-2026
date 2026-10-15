// The newest document of a kind still free to send. The API doesn't mark generated PDFs, so an
// uploaded file counts too.
export const latestUnsentDocument = <
  T extends { kind: string; createdAt: string; sentAt?: string | null }
>(
  documents: T[],
  kind: 'CV' | 'COVER_LETTER'
): T | undefined =>
  documents
    .filter((d) => d.kind === kind && !d.sentAt)
    .reduce<T | undefined>(
      (latest, d) =>
        !latest || Date.parse(d.createdAt) > Date.parse(latest.createdAt) ? d : latest,
      undefined
    )
