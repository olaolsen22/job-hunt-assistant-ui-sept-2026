# Proposal

## Why

CV import currently disables Save whenever any selected field is invalid, leaving the owner without feedback at the point of clicking. Missing skill levels create avoidable blockers, while technical paths and duplicated warning lists make corrections difficult to find.

## What Changes

- Keep Save import actionable when content is selected; invalid attempts explain what to fix, open the affected entry, and move focus to its first invalid field without sending a save request.
- Make genuinely disabled Save styling clearly different from enabled styling, using theme-aware muted treatment rather than adding labels.
- Default missing standalone skill levels to 1, visibly editable before saving. Preserve existing profile levels for missing-level skills already present, and retain valid explicit candidate levels. Zero is unsupported by the API.
- Put plain-language validation and relevant parse warnings beside their fields or entries, using names such as employer and skill name instead of JSON paths.
- Remove the top-level technical error/warning walls and duplicate stale warnings. Corrected or skipped content stops demanding attention; uncertain source information remains a local review note when still relevant.
- Show a short status beside Save, make entries needing attention identifiable when collapsed, and keep only request-wide failures at modal level. Map recognizable server selection paths to reviewed fields while preserving useful backend explanations.
- Use compact history summaries with readable action labels; open entries needing correction and let the owner expand complete entries for review.
- Preserve atomic save, skipped-content omission, explicit update targets, translation preservation, and the two existing parsing routes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-profile`: Improve CV review defaults, error placement and Save feedback.

## Impact

Modify the existing CV import modal, review components, selection utility, error handling, focused behavior tests, and relevant documentation. No backend changes, new packages, or changes to manual profile editors are needed.

This follows the implemented but unsynced `import-profile-cv` change. Its `Editable CV review` and `Atomic reviewed CV save` requirements are the baseline for this delta; sync/archive that change before syncing/archiving this follow-up. This change explicitly replaces the missing-skill manual-level requirement with the visible default policy above. Planning does not sync or archive either change.
