// The newest document of a kind still free to send. The API doesn't mark generated PDFs, so an
// uploaded file counts too. A CV template's copy is left out: it's made only to apply with that
// version, so it isn't this listing's own CV.
export const latestUnsentDocument = <
  T extends { kind: string; createdAt: string; sentAt?: string | null; origin?: string | null }
>(
  documents: T[],
  kind: 'CV' | 'COVER_LETTER'
): T | undefined =>
  documents
    .filter((d) => d.kind === kind && !d.sentAt && d.origin !== 'BASE_CV')
    .reduce<T | undefined>(
      (latest, d) =>
        !latest || Date.parse(d.createdAt) > Date.parse(latest.createdAt) ? d : latest,
      undefined
    )

// Where a document came from, e.g. "CV template: Frontend (EN) v3". Documents from before the API
// recorded origins have none.
export const documentOriginLabel = (document: {
  origin?: string | null
  baseCvVersion?: { number: number; baseCv: { name: string } } | null
}) => {
  if (document.origin === 'UPLOADED') return 'Uploaded'
  if (document.origin === 'TAILORED') return 'Tailored for this listing'
  if (document.origin !== 'BASE_CV') return undefined
  const version = document.baseCvVersion
  return version ? `CV template: ${version.baseCv.name} v${version.number}` : 'CV template'
}
