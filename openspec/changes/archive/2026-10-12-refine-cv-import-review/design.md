# Design

## Context

See proposal.md for the problem. Three read-only agents reviewed the uncommitted implementation from source: `ui-reviewer` for correctness and tests, `ui-ux-expert` for experience, and `ui-controller` for reuse and the GraphQL contract. A focused Vitest run showed two problems. `ProfileCvImportModal.test.ts` fails to load with a template SyntaxError, which traces to `CvReview.vue` skill level `@update:model-value`. `profileCvImport.test.ts` asserts an outdated duplicate-skill message.

The schema's `ImportProfileCvError` members (`InvalidProfileImportError`, `ProfileEntryNotFoundError`, `InvalidLocationError`) expose only `message`. Parsing paths out of messages therefore stays the only way to route server errors. A backend `path` field would remove it, but that is out of scope.

The current structure stays. `CvField` wraps `UFormField` and matches issues by path prefix through provide/inject. `CvReview.focusIssue` finds `[data-cv-field]` elements, opens ancestor `<details>` and focuses the first control. `reviewCvSelection`/`cvFeedback` remain the validity and warning authorities.

## Goals / Non-Goals

**Goals:** A review that compiles and is verified by tests, never shows a count without a visible message, and can be scanned on a phone. Reuse existing helpers where a second real use exists.

**Non-Goals:** Changing import semantics or level-default policy. A fullscreen mobile modal (reconsider only if the compacted review still feels cramped). Replacing message-based server error routing. Converting entry disclosures to `UCollapsible`.

## Decisions

### Fix and verify first

Rewrite the handler as an arrow function with `;`-separated statements and update the stale assertion. Then run the existing suites before any refinement. The first task group must leave the previous change's delivered behavior verified, so later failures are clearly attributable.

### One issue list, every path renderable

`CvReview` takes one `issues` list (local validation, active server issues and resolved warnings), each with a `severity`, plus `attempted`. This replaces the `errors`/`issues`/`attempted` trio and its `?? errors` fallbacks. `CvField` renders an error in the error slot and a warning in the help-style line. Needs-attention and section counts derive from the same list, so server errors mark entries.

Every path an issue can carry needs a rendered target. Add exact item-level `CvField`s for `links[i]`, `skills[i]`, `languages[i]` and `…bullets[j]`, and keep section/entry-level exact fields. Footer suppression of `saveError` applies only when every mapped issue has a rendered target. `focusIssue` already treats unmatched paths as missing, so the check reuses its matcher.

Checkboxes and the location toggle move outside field wrappers. Inside a `UFormField` they inherit the field id and their labels activate the wrong control. The location path wraps `ProfileLocationField` alone, so focus lands on the country picker. Entry-level source warnings are retired only by skipping the entry, not by snapshot change. Warning suppression by a child error requires an exact path match. Focus uses `preventScroll: true` after the smooth scroll starts.

One `cvPathWithin(path, prefix)` helper replaces the four copies of the prefix check. The `useCvFeedback` key and provide/inject helpers move into `profileCvImport.ts`, removing a single-use composable file. The inject default is dropped because `CvField` only renders inside `CvReview`.

### Compact rows following existing profile patterns

Skill and language rows follow `SkillList.vue`. Each is one `flex flex-wrap items-center gap-2` row:

- an include `UCheckbox` with `aria-label` "Include <name>"
- the name input (muted when skipped)
- the level `USelect`
- a neutral `UBadge` reading "Saved n/5" or "New"

Rows are separated with `divide-y divide-default` instead of a card per row. Skills get neutral soft "Include all"/"Skip all" buttons. Imported links and hobbies (`draft.links.slice(profile.links.length)` and the hobby equivalent) appear as a muted read-only list until Replace is ticked.

Entry headers follow `Entry.vue`. The title is the experience title or the school/name, the subtitle is the employer, degree or issuer, and dates use `formatMonthRange`. The needs-attention badge and an `aria-label`led action `USelect` sit on the right. A native `<details>` "Edit fields" disclosure stays, because `focusIssue` opens `<details>` ancestors. Skipped entries render muted with no disclosure. `cvEntryLabel` widens to accept a draft entry. Actions omit Update existing when the kind has no saved entries. Each bullet is one row (text `flex-1`, small action select) with `divide-y`, and the target picker and Current text appear only for updates.

Basics show the "empty value clears" help once under the heading, with checkbox labels reduced to the field name. The info alert shrinks to one sentence. Section headings get the profile page's lucide icons and a warning badge with the issue count.

### Footer

The footer has one status line, rendered as a `UButton variant="link"`. It is warning-colored before the first attempt and error-colored after, reads "N items need attention" and calls `focusCorrection`. With no issues it shows muted "N changes to save", or the empty-selection text. The save error stays a `UAlert`. Backend details go in its description as a disclosure, shown only when `apiErrors` exist, so network failures do not repeat themselves. Buttons use `flex flex-wrap justify-end gap-2`.

Disabled Save uses `:color="review?.count ? 'primary' : 'neutral'"` and `:variant="review?.count ? 'solid' : 'subtle'"`. The inline style and its computed are removed. While busy the button stays primary with `loading`, so the spinner remains legible. This narrows the previous scenario, which also applied muted styling while busy. The chosen alternative is built-in props over `disabled:` utility classes, which would be a custom override.

### Reuse beyond the CV files

- Extract the duplicated paid-AI cost notice from `ParseModal.vue` and `CvImportModal.vue` into `components/app/AiCostNotice.vue` with a `usage` prop.
- Add `isHttpUrl` to a small util used by the CV utility, `pages/listings/[id]/edit.vue` and `utils/collectedJobs.ts`.
- Build the CV location value with `locationInput` from `utils/locationInput.ts`, keeping the "Choose a country" check for a city without a country.
- Make the copy-prompt button match `ParseModal`: success color, and the copied state resets after 1500 ms.
- Change the ongoing checkbox label to "Current" to match the profile modals.
- Remove the `contentLanguage` validation branch: the page disables Import for non-English profiles and the API enforces it.
- Remove `const profile = computed(() => props.profile)`.

## Risks / Trade-offs

- [Item-level targets and moved checkboxes change DOM structure that focus depends on] → Cover focus for a location country, a bullet row, a skill row and a month field in modal tests.
- [Touching `ParseModal`, listing edit and collected jobs widens the change] → Extract only verbatim duplicates. Run their existing tests and `pnpm test`, because shared code changes.
- [Message-parsed server paths can misroute if backend wording changes] → An unmatched path falls back to the footer alert. Tests use realistic backend messages, not regex-tailored fixtures.
- [Three unsynced deltas modify the same requirements] → Sync/archive `import-profile-cv`, then `improve-cv-import-review`, then this change. Each MODIFIED block restates the full requirement.

## Migration Plan

No data migration. Apply over the uncommitted CV files. Run focused tests, `pnpm test`, lint, typecheck, build and production preview. Rollback is reverting the component edits.

## Open Questions

None blocking. The owner may later prefer collapsing skipped skills into "N skipped" or a fullscreen phone modal. Both are presentation-only follow-ups.
