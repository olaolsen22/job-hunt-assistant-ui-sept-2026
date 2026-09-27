import type {
  CefrLevel,
  DeadlineType,
  EmploymentType,
  Language,
  Schedule,
  Seniority,
  WorkMode
} from '~/constants/listing'

export interface ListingDetail {
  id: number
  title: string
  company: { name: string }
  jobRole: { name: string }
  seniority: Seniority | null
  employmentType: EmploymentType | null
  schedule: Schedule | null
  workMode: WorkMode | null
  description: string | null
  url: string
  postedOn: string
  deadlineType: DeadlineType
  deadlineOn: string | null
  postingLanguage: Language | null
  favoritedAt: string | null
  analyzedAt: string | null
  locations: { location: { city: string | null; countryCode: string } }[]
  languages: { language: Language; level: CefrLevel | null; isRequired: boolean }[]
  skills: { skill: { name: string }; level: number; minYears: number | null; isRequired: boolean }[]
}

const LISTING_QUERY = `
  query ListingById($id: Int!) {
    listingById(id: $id) {
      id
      title
      company { name }
      jobRole { name }
      seniority
      employmentType
      schedule
      workMode
      description
      url
      postedOn
      deadlineType
      deadlineOn
      postingLanguage
      favoritedAt
      analyzedAt
      locations { location { city countryCode } }
      languages { language level isRequired }
      skills { skill { name } level minYears isRequired }
    }
  }
`

// Client-only (`server: false`) since it needs the session cookie.
export const useListing = async (id: number) => {
  const { data, status, error, refresh } = await useAsyncData(
    `listing-${id}`,
    () => gql<{ listingById: ListingDetail | null }>(LISTING_QUERY, { id }),
    { server: false }
  )

  const listing = computed(() => data.value?.listingById ?? null)
  const loading = computed(() => status.value === 'pending')

  return { listing, loading, error, refresh }
}
