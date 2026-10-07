# Design

## Context

`ListingsParseModal` is shared by add and edit and emits `apply` with a parsed draft; the pages decide how to
apply it. `useParsePrompt` owns the `parseListing` call. See proposal.md for scope.

## Decisions

- **Button lives in the modal, keyed on an optional `listingId` prop.** Only the edit page passes it, so add stays paste-only.
- **`parseFromUrl(listingId)` in `useParsePrompt`**, returning the `result` JSON string like `parse`, so the modal's `apply(reply)` is reused.
- **Errors inline, not toasts**, so they sit next to the paste fallback; cleared on retry or close.
- **No timeout.** `gql` uses `$fetch` with no timeout.
- `cleanDraft` already drops `url`, so the form's URL stays.

## Risks / Trade-offs

- The API parses the saved URL, so a URL edited but not yet saved is ignored → the hint says "saved link".
