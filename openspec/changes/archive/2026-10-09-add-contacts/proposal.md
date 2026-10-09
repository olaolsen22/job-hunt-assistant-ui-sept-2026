# Proposal

## Why

The API now stores contacts (recruiters, hiring managers) per company and links them to listings,
and the FULL parse returns the contacts named in an ad. The UI has no way to see or keep them.

## What Changes

- Company page: a Contacts card listing the company's contacts (name, title, email, phone, link,
  Markdown notes) with add, edit, and delete.
- Listing page: a read-only Contacts card showing the listing's linked contacts, pointing to the
  company page for editing.
- Parsing (FULL, pasted JSON, URL): contacts in the draft are cleaned and sent as
  `ListingInput.contacts` on save. Quick parse is unchanged (it returns none).
- Listing form (add/edit): a Contacts card to edit the listing's linked contacts; parsed contacts
  fill it (merged by name on an existing listing). The list is always sent, so removing a row unlinks.
- API errors (`DuplicateContactError`, `InvalidContactError`, `ContactNotFoundError`,
  `InvalidListingError`) are shown as returned.
- Regenerate GraphQL types.

## Capabilities

### New Capabilities

- `company-contacts`: viewing and managing a company's contacts, and showing a listing's linked contacts.

### Modified Capabilities

- `listing-creation`: parsed drafts carry contacts into the saved listing (added requirement).

## Out of scope

- Contacts in quick-add, the listings list, cards, filters, or the dashboard.
- A separate contacts page or search across companies.
- Client-side duplicate checks (the API owns them).

## Impact

- `app/pages/companies/[id]/index.vue`, `app/pages/listings/[id]/index.vue`
- `app/composables/useListing.ts`, `app/composables/useListingForm.ts`, `app/components/listings/Form.vue` + new `ContactsField.vue`
- New `app/components/companies/ContactModal.vue` (and a small list component if the card grows)
- `app/graphql-env.d.ts` (regenerated), tests in `test/unit/`
