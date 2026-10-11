# Tasks

## 1. Design check

- [x] 1.1 Layout confirmed with ui-ux-expert during propose (see design.md); owner chose Got it for applied-before rows and a closed-by-default group

## 2. Note actions

- [x] 2.1 Duplicate note: replace per-match Compare links with one primary "Compare" / "Compare (N)" button first in the actions; restyle Keep both (neutral/subtle) and rename Remove to "Remove new one"; drop `size="sm"`; verify with a test that clicking Compare opens the modal on the first match
- [x] 2.2 Previous-attempts note: add a Got it button that clears the flag; give match/attempt title links `target="_blank"`; verify with a test that Got it removes the note

## 3. Sections after save

- [x] 3.1 Add `flagged` / `added` computeds and render "Needs a look (N)", the `UCollapsible` "N listings added" group (closed, compact list), and "Not saved (N)" above Save, headings only once something is saved; verify with `QuickAdd.test.ts` tests for a mixed batch (counts, group closed, failed row under Not saved) and Keep both moving a row into the group
- [x] 3.2 Update existing `QuickAdd.test.ts` selectors that changed; verify with `pnpm vitest run test/unit/QuickAdd.test.ts`

## 4. Wrap-up

- [ ] 4.1 Archive `quick-add-duplicate-compare` before archiving this change (this one modifies its requirement)
- [x] 4.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; all pass (E2E not run; UI unverified unless the owner allows a live check)
- [x] 4.3 Note `UCollapsible` usage in `.claude/state/ui-inventory.md` conventions if it's reused; run `/log-progress` to update `docs/STATUS.md`
