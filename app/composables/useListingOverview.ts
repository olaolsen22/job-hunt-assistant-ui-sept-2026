import type { ResultOf } from 'gql.tada'

// Separate from useListing: the five v1 listing pages share that query and don't need the company
// details, training program or document sizes the read-only overview (/listings/v2/[id]) shows.
const LISTING_OVERVIEW = graphql(
  `
    query ListingOverview($id: Int!) {
      listingById(id: $id) {
        id
        kind
        title
        status
        statusChangedAt
        createdAt
        updatedAt
        analyzedAt
        reanalyzedAt
        favoritedAt
        archivedAt
        url
        description
        postingLanguage
        seniority
        employmentType
        schedule
        positionPercent
        workMode
        postedOn
        deadlineType
        deadlineOn
        dueOn
        jobRole {
          name
          category {
            name
          }
        }
        company {
          id
          name
          industry {
            name
          }
          kind
          sizeBand
          foundedYear
          description
          websiteUrl
          careersUrl
          linkedInUrl
          orgNumber
          favoritedAt
          avoidedAt
          listingCount
          applicationCount
        }
        locations {
          location {
            id
            city
            countryCode
            isTarget
          }
        }
        trainingProgram {
          endCompany {
            name
          }
          startsOn
          endsOn
          isPaid
          jobOffer
        }
        skills {
          skill {
            id
            name
          }
          level
          minYears
          isRequired
        }
        languages {
          language
          level
          isRequired
        }
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
          sizeBytes
          createdAt
          sentAt
          origin
          baseCvVersion {
            number
            baseCv {
              name
            }
          }
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

export type ListingOverview = NonNullable<ResultOf<typeof LISTING_OVERVIEW>['listingById']>

// Same shape as useListing: client-only (needs the session cookie), refs usable at once and
// awaitable, so the page can start the requirement map query before waiting.
export const useListingOverview = (id: number) => {
  const asyncData = useAsyncData(`listing-overview-${id}`, () => gql(LISTING_OVERVIEW, { id }), {
    server: false
  })
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
