import type { ResultOf } from 'gql.tada'

// Shared by the company page, the listing page and the People pages so every contact row gets
// the same shape. followUpOn and lastInteractionAt come from the latest logged interaction.
export const CONTACT_FIELDS = graphql(`
  fragment ContactFields on Contact {
    id
    companyId
    name
    title
    email
    phone
    url
    notes
    followUpOn
    lastInteractionAt
  }
`)

export type CompanyContact = ResultOf<typeof CONTACT_FIELDS>

// The company page and the person page both delete contacts; their interactions go with them.
export const DELETE_CONTACT = graphql(`
  mutation DeleteContact($input: DeleteContactInput!) {
    deleteContact(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

// One logged message, call or meeting, for the person page's timeline and its edit form.
export const INTERACTION_FIELDS = graphql(`
  fragment InteractionFields on ContactInteraction {
    id
    occurredAt
    direction
    channel
    note
    followUpOn
  }
`)

export type ContactInteraction = ResultOf<typeof INTERACTION_FIELDS>
