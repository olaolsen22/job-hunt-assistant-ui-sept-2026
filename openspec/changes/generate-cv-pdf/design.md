# Design

## Context

See proposal.md for motivation. The unarchived `tailored-cv-drafts` implementation supplies the editor and draft state. `useListing` already fetches `documents { id kind fileName sentAt }` under shared key `listing-<id>`. `Application.vue` opens `/api/documents/<id>` in a new tab; the API serves inline PDF bytes with cookie authentication. `ApplyModal.vue` filters unsent documents for its existing picker.

The API schema already exposes `generateCvDocument`, returning a nullable document and `ListingNotFoundError` / `TailoredCvDraftNotFoundError`. Type generation belongs to implementation, not this proposal.

## Goals / Non-Goals

**Goals:** Coordinate saved-draft eligibility, mutation state, typed recovery, and listing refresh using existing queries and components.

**Non-Goals:** Client PDF rendering, document blob caching, new shared document abstractions, or duplicate generation entry points.

## Decisions

- **Editor placement:** Following UX advice, place Generate PDF beside Save draft in the sticky bar. Show it only for a persisted draft and disable it for dirty/saving/AI/generating state. Wrap touch-sized controls on phones and show save-first guidance. Give Generate PDF primary emphasis when saved; retain Save draft emphasis when dirty. A second action on `TailoredCvCard.vue` was considered but adds an entry point beyond the requested editor flow.
- **Mutation ownership:** Extend `useTailoredCvDraft.ts` with a literal `GenerateCvDocument($listingId: Int!)` document using the user's exact selection, sent with `gql`. Derive returned document types with `ResultOf`. Keep generation state independent from analysis/save state; return success document metadata and typed recovery state for the page. Follow `useMutation` loading/error conventions but handle the two errors explicitly: its generic `*NotFoundError` stale callback cannot distinguish a missing draft from a missing listing.
- **Save-first recovery:** A missing-draft response refreshes the shared draft query and marks persisted-draft eligibility absent while retaining the candidate. Ensure Save draft can recreate it even when the prior dirty comparison was clean. A missing listing shows an inline unavailable alert with Back to listings and refreshes the listing query.
- **Refresh boundary:** The page obtains `refresh` from its existing `useListing(id)` call. After creation, retain `{ id, fileName }`, confirm success, and refresh that shared listing query. Separate creation failure from refresh failure; offer refresh-only retry and keep Open PDF visible. Do not automatically retry the mutation, since each call creates another document.
- **Document access:** Use the existing same-origin endpoint and new-tab link pattern; browser PDF controls supply download. Avoid automatic tab opening after the asynchronous mutation, which can be blocked. Explain version retention near the generation control. No auto-selection or application submission occurs.

## Risks / Trade-offs

- [Unsaved edits could produce a stale PDF] → Require a clean saved draft before generation; indicate that the output uses the saved draft and preserve any edits made while the request runs.
- [Creation succeeds but refresh fails] → Retain returned metadata and provide refresh-only retry.
- [A transport error can leave creation outcome unknown] → No automatic retry; the next document refresh can reveal a created file.
- [Base editor is uncommitted and its spec is not in main specs] → Build on the current `tailored-cv-drafts` change and archive it before this change; `cv-documents` owns the new requirements without duplicating the draft capability.

## Migration Plan

No data migration. Regenerate the frontend schema types, then deploy the UI against the already updated API. Reverting the UI additions leaves created documents accessible through existing listing links.
