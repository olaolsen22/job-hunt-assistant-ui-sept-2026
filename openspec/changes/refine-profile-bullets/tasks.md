## 1. Data layer

- [x] 1.1 Add `useBulletRefinement(scope)` (prompt query, refine / preview / apply documents; `suggest`, `preview(json)`, `apply`) using `useAiRequest`, `useAiPrompt`, `ResultOf` types
- [x] 1.2 Add optional `note` to `RewriteRow`; keep headline/summary callers unchanged

## 2. Modal

- [x] 2.1 `ProfileBulletRefinementModal` (`v-model:open`, `profile`, `scope`, `@changed`): tabs, review rows with note callout, select all, stale-translation notice, empty state, apply/discard confirm, errors
- [x] 2.2 Apply only ticked rows whose text differs from current; note-only rows start unticked

## 3. Entry points

- [x] 3.1 `RowActions` optional refine item; `Entry` shows it when bullets exist and opens the modal lazily
- [x] 3.2 Whole-profile action in the profile page header; refresh profile on `@changed`

## 4. Checks

- [x] 4.1 Unit tests (mirror `SkillWordingModal.test.ts`): scope args sent; edit + apply sends only changed ticked rows; note-only row; empty result; FAILED preview keeps pasted text; apply error keeps review open
- [x] 4.2 `pnpm gql:gen` diff noted, `pnpm lint`, `pnpm typecheck`, relevant Vitest
- [x] 4.3 Rebuild preview, screenshots (phone/tablet/desktop, mock data) and run `ui-reviewer`
- [x] 4.4 Update `docs/REUSABLES.md` and `.claude/state/ui-inventory.md`
