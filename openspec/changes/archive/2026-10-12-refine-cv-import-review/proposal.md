# Proposal

## Why

The applied `improve-cv-import-review` work does not compile: `CvReview.vue` has a two-statement inline handler without `;`, so the review screen cannot render. The modal test file fails to load, one utility test fails, no tasks are checked off and the documentation tasks were skipped. A source review by `ui-reviewer`, `ui-ux-expert` and `ui-controller` also found item-level issues that are counted but never shown, a badge that ignores server errors, focus that lands on the wrong control, and a review that is still too dense to scan for a long CV.

## What Changes

- Fix the template compile error and the stale test expectation, and verify the delivered behavior with passing tests and a build.
- Show every counted issue: give link, skill, language and bullet rows their own item-level message. Count server errors in the needs-attention state, and stop suppressing a mapped server error that has no visible target.
- Move location errors to the country picker. Take checkboxes out of shared field wrappers so that labels toggle the right control. Focus without fighting the smooth scroll.
- Keep entry-level source notes until the entry is skipped. Editing a field no longer resolves them. Remove the unreachable content-language check.
- Show skills and languages as compact one-line rows. Keep the name visible when an item is skipped and show saved-level badges ("Saved 3/5" / "New"). Add Include all / Skip all for skills.
- Give history entries a header with a title, subtitle and formatted dates. Put the action picker and needs-attention badge at the right of the header, and the fields behind an "Edit fields" disclosure. Mute skipped entries. Offer Update existing only when saved entries exist. Bullets become one row each.
- Make the footer a single status line from the start: warning tone before a save attempt, error tone after, as a link that focuses the first correction. Network-failure text should not repeat under Error details. Buttons wrap side by side on phones.
- Replace the inline disabled-Save style with built-in `color`/`variant` props. The muted treatment applies when nothing is selected. While saving, the button keeps its normal look and shows the loading indicator.
- Add section issue counts, say the basics help text once, and show imported links/hobbies before the owner opts into replacing them.
- Reuse existing code: extract the AI cost notice shared with `ParseModal` and an `isHttpUrl` helper shared with listings. Use `formatMonthRange`, a widened `cvEntryLabel` and one path-prefix helper. Fold `useCvFeedback` into the CV utility. Remove dead code.
- Complete the documentation the previous change left out (`docs/REUSABLES.md`, inventory, `docs/STATUS.md`).

Out of scope: backend path fields on import errors, a fullscreen mobile modal, changes to import semantics (atomic save, omission, explicit targets, translation preservation, level defaults).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-profile`: CV review layout, issue visibility, footer status and disabled Save treatment.

## Impact

Affected code: the CV import modal and review components, the CV field wrapper, the CV import utility and composable, and `ParseModal` (shared cost notice). Also a small URL utility used by the listing edit page and collected jobs, plus focused tests and the docs and inventory.

No API or package changes. This builds on the unsynced `import-profile-cv` and `improve-cv-import-review` changes. Sync or archive them in that order before this one, and treat their requirements as the baseline.

The work stays on the uncommitted CV import files and preserves unrelated owner edits.
