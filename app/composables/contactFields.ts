import type { ResultOf } from 'gql.tada'

// Shared by the company page and the listing page so both contact cards get the same shape.
export const CONTACT_FIELDS = graphql(`
  fragment ContactFields on Contact {
    id
    name
    title
    email
    phone
    url
    notes
  }
`)

export type CompanyContact = ResultOf<typeof CONTACT_FIELDS>
