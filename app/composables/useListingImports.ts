import type { ResultOf } from 'gql.tada'

// Files of collected jobs the API picks up from its import folder. They're read with quick add's
// collected-jobs flow; reviewing one only hides it from the pending list.

const PENDING_COUNT = graphql(`
  query PendingListingImportCount {
    pendingListingImportCount
  }
`)

// `content` (up to 2 MB) is fetched only for the import being opened. `first: 20` is literal text:
// the API's cost check rejects a `first` variable (HC0047), like /contacts.
const LISTING_IMPORTS = graphql(`
  query ListingImports($isReviewed: Boolean, $after: String) {
    listingImports(isReviewed: $isReviewed, first: 20, after: $after) {
      nodes {
        id
        fileName
        kind
        generatedAt
        itemCount
        error
        reviewedAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`)

const LISTING_IMPORT = graphql(`
  query ListingImport($id: Int!) {
    listingImports(where: { id: { eq: $id } }, first: 1) {
      nodes {
        id
        kind
        generatedAt
        itemCount
        content
        error
        reviewedAt
      }
    }
  }
`)

const SET_REVIEWED = graphql(`
  mutation SetListingImportReviewed($id: Int!, $isReviewed: Boolean!) {
    setListingImportReviewed(input: { id: $id, isReviewed: $isReviewed }) {
      listingImport {
        id
        reviewedAt
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

export type ListingImportItem = NonNullable<
  NonNullable<ResultOf<typeof LISTING_IMPORTS>['listingImports']>['nodes']
>[number]
export type ListingImportDetail = NonNullable<
  NonNullable<ResultOf<typeof LISTING_IMPORT>['listingImports']>['nodes']
>[number]

export const PENDING_IMPORTS_KEY = 'pending-listing-imports'

// Fetched once by the layout when the app opens; changes refresh it by key.
export const usePendingImportCount = () => {
  const { data } = useAsyncData(
    PENDING_IMPORTS_KEY,
    () => gql(PENDING_COUNT).then((r) => r.pendingListingImportCount),
    { server: false }
  )
  return computed(() => data.value ?? 0)
}

export const fetchListingImports = (isReviewed: boolean | null, after: string | null) =>
  gql(LISTING_IMPORTS, { isReviewed, after }).then((r) => r.listingImports)

export const fetchListingImport = (id: number) =>
  gql(LISTING_IMPORT, { id }).then((r) => r.listingImports?.nodes?.[0] ?? null)

// The next pending import to review after `currentId`; broken files are skipped since they have
// nothing to review. A failed lookup only hides the shortcut.
export const useNextImport = (currentId: number) => {
  const nextImportId = ref<number | null>(null)
  const load = async () => {
    try {
      const nodes = (await fetchListingImports(false, null))?.nodes ?? []
      nextImportId.value = nodes.find((i) => i.id !== currentId && !i.error)?.id ?? null
    } catch {
      nextImportId.value = null
    }
  }
  return { nextImportId, load }
}

export const importLabel = (i: { kind: string; generatedAt: string }) =>
  `${i.kind} · ${formatDateTime(i.generatedAt)}`

// Shows the API's error as a toast; the count is refreshed after every change.
export const useSetImportReviewed = () => {
  const { run, loading } = useMutation()
  const setReviewed = async (id: number, isReviewed: boolean) => {
    const ok = await run(async () => {
      const { setListingImportReviewed } = await gql(SET_REVIEWED, { id, isReviewed })
      return setListingImportReviewed.errors
    })
    void refreshNuxtData(PENDING_IMPORTS_KEY)
    return ok
  }
  return { setReviewed, loading }
}
