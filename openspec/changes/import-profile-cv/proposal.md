# Proposal

## Why

The backend now supports importing an English CV into an empty or populated profile. The UI needs a familiar parsing flow that lets the owner correct and select content before any profile changes are saved.

## What Changes

- Add an Import CV action on `/profile`, using the listing parsing modal's Paste / Use your own AI interaction pattern.
- Parse pasted English text or Markdown with `parseProfileCv`, or copy `profileCvParsePrompt` and preview external JSON with `previewProfileCvImport`.
- Feed both routes into one editable, sectioned preview with warnings and explicit add/update/skip choices for history entries and bullets.
- Save reviewed selections in one atomic `importProfileCv` request; preserve omitted content and Norwegian translations.
- Regenerate GraphQL types from the backend schema during implementation.
- Exclude built-in file upload, URL parsing, automatic duplicate matching, translation, tailoring, and changes to the existing listing flow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-profile`: Add reviewed English CV import alongside existing manual profile editing.

## Impact

`app/pages/profile.vue`, new profile import modal/review components, a dedicated CV import composable and selection utility, `app/graphql-env.d.ts`, focused unit tests, and profile documentation. Reuse existing profile field controls, GraphQL helpers, profile fragments, and modal conventions. The fixed backend contract and `docs/profile-cv-import.md` define parsing, selection, and save semantics; no backend changes or new packages are needed.
