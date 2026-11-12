import type { ResultOf } from 'gql.tada'

const LISTING = graphql(
  `
    query ListingById($id: Int!) {
      listingById(id: $id) {
        id
        kind
        updatedAt
        title
        company {
          id
          name
          applicationCount
          avoidedAt
        }
        jobRole {
          name
        }
        seniority
        employmentType
        positionPercent
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
        reanalyzedAt
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
        applicationQuestions(order: { id: ASC }) {
          id
          question
          charLimit
          answer
          notes
        }
        documents {
          id
          kind
          fileName
          createdAt
          sentAt
          origin
          baseCvVersion {
            id
            number
            baseCv {
              id
              name
            }
          }
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
            id
            name
            profileLevel
          }
          level
          minYears
          isRequired
        }
        contacts {
          contact {
            ...ContactFields
          }
        }
      }
    }
  `,
  [CONTACT_FIELDS]
)

export type ListingDetail = NonNullable<ResultOf<typeof LISTING>['listingById']>

// Client-only (`server: false`) since it needs the session cookie. Awaitable like useAsyncData:
// `await useListing(id)` waits for the first load, while the refs are usable at once, so a page can
// start its other requests before waiting.
export const useListing = (id: number) => {
  const asyncData = useAsyncData(`listing-${id}`, () => gql(LISTING, { id }), { server: false })
  const result = {
    listing: computed(() => asyncData.data.value?.listingById ?? null),
    loading: computed(() => asyncData.status.value === 'pending'),
    error: asyncData.error,
    refresh: asyncData.refresh
  }
  return Object.assign(
    asyncData.then(() => result),
    result
  )
}
