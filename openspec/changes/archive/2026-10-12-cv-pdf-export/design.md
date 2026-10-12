# Design

## Context

`useTailoredCvDraft.ts` owns draft queries and mutations; `cv.vue` has the sticky action bar with Save draft. `useListing` fetches `documents` under key `listing-<id>`, and `Application.vue` already links `/api/documents/{id}` in a new tab. Education analysis (`education:<id>` keys, `EDUCATION` result handling) already exists in the working tree.

## Decisions

- **Mutation:** add a literal `GenerateCv($listingId: Int!)` document to the composable, selecting `document { id fileName originalFileName kind sizeBytes createdAt sentAt }` and `errors { __typename ... on Error { message } }` as the API owner specified; derive types with `ResultOf`. Run `pnpm gql:gen` first.
- **Errors:** handle the two typed errors explicitly instead of the generic not-found callback of `useMutation`, which cannot tell them apart. Missing draft keeps the candidate and lets Save draft recreate it.
- **Placement:** Generate PDF sits beside Save draft in the sticky bar (primary when saved, Save draft primary when dirty); no second entry point.
- **Refresh:** after success keep `{ id, fileName }`, call `refresh()` from the page's `useListing(id)`, and treat refresh failure separately with a refresh-only retry.
- **Access:** plain new-tab link to `/api/documents/{id}`; no auto-open (popup blockers) and no auto-selection when applying.

## Risks

- Transport failure leaves the outcome unknown; no automatic retry because every call creates a document.
- Overlap with the unimplemented `generate-cv-pdf` change; pick one before applying.
