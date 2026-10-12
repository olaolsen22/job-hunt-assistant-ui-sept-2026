# Tasks

## 1. Skill defaults and feedback data

- [x] 1.1 Update `createCvDraft` to use saved levels for missing-level existing skills and level 1 for missing-level new skills, retaining explicit valid levels and editable default notes; verify utility tests for new/existing/case-insensitive names, explicit levels, user edits and no level-0 default.
- [x] 1.2 Provide field-local plain-language issue keys/messages, warning deduplication/resolution and submission path-to-draft mapping in the existing CV utility; verify tests for skipped entries/bullets, duplicate targets, corrected/defaulted/skipped warnings, and source notes that remain relevant.
- [x] 1.3 Update the utility/default contract in `docs/REUSABLES.md`; verify documented defaults, issue keys and omission semantics against the exported behavior.

## 2. Inline review and compact entries

- [x] 2.1 Bind errors and relevant warnings to `UFormField` or local entry/section messages across all CV fields, remove the top technical warning/error lists, and put only non-actionable source notes in collapsed Import notes; verify component tests show each issue once beside its control without JSON path prefixes and remove it after correction or skip.
- [x] 2.2 Make complete history entries initially compact, with readable title/action and needs-attention indication visible while collapsed; register focus/expansion targets for nested fields and reuse existing responsive controls. Verify entry tests cover expanding edits, visible skip/update actions, retained values and keyboard correction targets.
- [x] 2.3 Document the revised component feedback/navigation contract in `docs/REUSABLES.md` and update inventory only if reusable exports change; verify paths and signatures against the components.

## 3. Save feedback and server recovery

- [x] 3.1 Keep Save enabled for invalid selected content when idle, show a short footer correction status on an invalid attempt, open ancestors and focus/scroll the first invalid control without calling import; make disabled styling clearly distinct through muted/neutral background, border and foreground with no enabled hover/active treatment, without adding labels. Replace the current disabled-invalid-Save test with observable recovery tests, including compound month input, missing language proficiency, empty selections, busy locking and corrected atomic save; verify disabled styling uses light/dark theme tokens and report any live visual verification as unrun unless authorized.
- [x] 3.2 Preserve structured API save errors, route recognizable selection paths through the sent payload map to local fields, and show unknown/request-wide failures beside Save with readable guidance and optional original details; verify mocked API tests cover skipped row/bullet index mapping, missing update targets/reselection, network uncertainty, edit retention and no automatic retry or duplicate save.
- [x] 3.3 Update `docs/STATUS.md` through log-progress after implementation, describing defaults, inline correction and compact review; verify statements against delivered behavior and report live/E2E status accurately.

## 4. Integration verification

- [x] 4.1 Run focused CV utility/modal/entry and ProfilePage tests, `pnpm lint`, `pnpm typecheck`, changed-file formatting and whitespace checks; verify all pass, and report browser/E2E verification as unrun unless separately authorized.
- [x] 4.2 Run `pnpm build` and leave the production preview on `0.0.0.0:3000`, checking port ownership and stopping only an identified stale preview per CLAUDE.md; verify startup or report the port conflict without touching the owner's dev server.
