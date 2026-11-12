# Proposal

## Why

Profile bullets are often vague (no own part, result or scale). The API now offers AI refinement of
bullets, but the UI has no way to use it, so the owner cannot sharpen bullets without rewriting by hand.

## What Changes

- Add "Refine bullets with AI" for the whole profile (profile header) and for one entry (entry ⋮ menu,
  only when the entry has bullets).
- A review modal, modelled on the skill wording modal: built-in AI or the owner's own AI (copy the
  prompt, paste the reply, preview), then each suggestion beside the current text, editable and tickable.
- Show the AI's `note` (a question asking for a missing fact) on its row. A note without new text is
  a question only; it becomes applicable once the owner types a changed text (e.g. a real metric).
- Apply sends all ticked, changed bullets in one call, refreshes the profile and toasts.
- An empty result is a success ("No bullets need changes").
- Single-bullet scope is supported by the composable and modal, but has no entry point yet.

## Capabilities

### New Capabilities

- `profile-bullet-refinement`: scoped AI suggestions for profile bullets, reviewed, edited and applied.

### Modified Capabilities

## Impact

- New: `useBulletRefinement` composable, `ProfileBulletRefinementModal`, unit tests.
- Small edits: `RowActions` (optional extra menu item), `Entry`, the profile page header, optional `note`
  on `RewriteRow`; `docs/REUSABLES.md` and the UI inventory.
- API: `refineProfileBullets`, `profileBulletRefinementPrompt`, `previewProfileBulletRefinement`,
  `applyProfileBulletRefinement` (already in the schema; `pnpm gql:gen` shows only the type refresh).
- Out of scope: per-bullet button, new packages, fact-checking (API does not), re-translating stale bullets.
