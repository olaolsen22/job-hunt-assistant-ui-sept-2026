import type { ResultOf } from 'gql.tada'

const LISTING = graphql(`
  query ListingById($id: Int!) {
    listingById(id: $id) {
      id
      title
      company {
        name
        applicationCount
      }
      jobRole {
        name
      }
      seniority
      employmentType
      schedule
      workMode
      description
      url
      postedOn
      deadlineType
      deadlineOn
      dueOn
      postingLanguage
      favoritedAt
      analyzedAt
      archivedAt
      status
      statusHistory(order: { id: ASC }) {
        id
        status
        occurredAt
        note
      }
      interviews(order: { scheduledAt: ASC }) {
        id
        title
        scheduledAt
        notes
      }
      documents {
        id
        kind
        fileName
        sentAt
      }
      locations {
        location {
          city
          countryCode
        }
      }
      languages {
        language
        level
        isRequired
      }
      skills {
        skill {
          name
        }
        level
        minYears
        isRequired
      }
    }
  }
`)

export type ListingDetail = NonNullable<ResultOf<typeof LISTING>['listingById']>

// Client-only (`server: false`) since it needs the session cookie.
export const useListing = async (id: number) => {
  const { data, status, error, refresh } = await useAsyncData(
    `listing-${id}`,
    () => gql(LISTING, { id }),
    { server: false }
  )

  const listing = computed(() => data.value?.listingById ?? null)
  const loading = computed(() => status.value === 'pending')

  return { listing, loading, error, refresh }
}
