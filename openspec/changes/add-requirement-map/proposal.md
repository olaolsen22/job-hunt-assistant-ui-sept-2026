# Proposal

## Why

The API supports a requirement map per listing: what the job needs, which profile bullets and entries are evidence
for each need, and which needs are gaps. The UI has no way to create or read it, so the user still decides "send a
template, tailor a CV, or skip" from the raw ad.

## What Changes

- New "Requirements" card on the listing page: after Summary for Saved listings; after Application and before
  Tailored CV for other statuses, preserving the existing application-first order. It shows the
  saved map as match counts plus the needs that drive the decision (gaps and partial matches, required first), or an
  empty state with a "Map requirements" button.
- New editor page `/listings/[id]/requirements`: get a candidate from the built-in AI or from an external chat
  (copy prompt, paste JSON), review and edit the needs, then save. Nothing is stored before Save; Save replaces the
  whole map.
- Each need can be edited: text, kind, importance, match, note, and evidence picked from the profile's bullets and
  entries. Needs can be added, removed, and capped at 30.
- Both AI paths show the API-returned corrected candidate, never the raw model reply. External paste help requires
  a JSON object without fences and `schemaVersion: 1`. Neither AI path saves anything.
- The editor checks every strict save limit, requires notes for evidenced/partial Language and Practical needs,
  removes evidence from gaps, and skips stale profile ids. API errors preserve edits and remain visible.
- The saved map can be deleted from the editor page.
- A hint when the listing changed after the map was saved.

Out of scope: renaming the existing "Analyze ad" button, feeding the map into CV or cover letter generation (the API
does not read it yet), choosing a model per run (the saved default is used, as for cover letters), and keeping an
unsaved candidate across a page reload.

## Capabilities

### New Capabilities

- `requirement-map`: creating, reviewing, editing, saving and deleting a listing's requirement map on its editor
  page.

### Modified Capabilities

- `listing-page`: adds the Requirements card to the listing page.

## Impact

Audit baseline (2026-11-10): `app/graphql-env.d.ts` already contains the six operations and enums. No executable
requirement-map documents, composable, page, components, or tests were found in `app/` or `test/`. All implementation
tasks remain open. The owner reports restarting the API; the local guide and schema agree, but running-endpoint
compatibility must be checked separately during implementation without triggering a paid generation.

- New: `app/composables/useRequirementMap.ts`, `app/components/listings/RequirementMapCard.vue`,
  `app/components/listings/RequirementMapAiModal.vue`, `app/components/listings/RequirementNeedRow.vue`,
  `app/components/listings/RequirementEvidenceModal.vue`, `app/pages/listings/[id]/requirements.vue`,
  `app/utils/requirementMap.ts`, and unit tests.
- Changed: `app/pages/listings/[id]/index.vue` (card in both layouts), `app/utils/profileBullets.ts` (entry lookup),
  `app/graphql-env.d.ts` (regenerated), `.claude/state/ui-inventory.md`, `docs/STATUS.md`.
- API: UI integration with `requirementMap`, `requirementMapExternalPrompt`, `generateRequirementMap`,
  `previewRequirementMap`, `saveRequirementMap`, `deleteRequirementMap`. No new packages.
