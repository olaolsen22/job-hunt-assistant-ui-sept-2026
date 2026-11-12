# Tasks

## 1. Before state

- [ ] 1.1 Run `pnpm gql:gen` and note any `app/graphql-env.d.ts` diff (expected: none relevant). Reuse the before
      shots in `/tmp/claude-1000/cv-pages-shots/` and add `/cv-templates/[id]` at 375/768/1440 with mocked
      `/graphql` (the guest has no saved template), plus one filled tailored CV with mocked data. Verify: the PNG
      files exist for all three pages and widths.

## 2. Shared collapsible card

- [ ] 2.1 Add `app/composables/useCollapsibleCard.ts` (`{ id, collapsible, defaultOpen, locked }` →
      `{ isCollapsible, isOpen, toggle }`, injects `mobile-collapsible` and `jump-target`) and
      `app/components/app/CollapsibleHeader.vue` (title, count, chevron, `aria-expanded`, keyboard toggle, `actions`
      slot). Verify: `pnpm typecheck`.
- [ ] 2.2 Move `ProfileSection` onto both and rename the provide keys in `app/pages/profile.vue`. Update the keys in
      `test/unit/ProfileSection.test.ts`. Verify: `pnpm vitest run test/unit/ProfileSection.test.ts
  test/unit/ProfilePage.test.ts` passes with no other test edits.
- [ ] 2.3 Add the two exports to `.claude/state/ui-inventory.md` and `docs/REUSABLES.md`. Verify: both files name
      the composable and the component with their props.

## 3. Editor section cards

- [ ] 3.1 `TailoredCvSection`: use `AppCollapsibleHeader` in the card header; add `count`, `icon`, `defaultOpen` and
      `locked` props; hide the body while collapsed; lock open when it has suggestions, a warning or an error;
      replace the centered empty block with the compact row, keeping `${testid}-empty`. Add
      `test/unit/TailoredCvSection.test.ts` covering: count in the title, compact empty row, toggle with
      `aria-expanded` when the phone flag is provided, no toggle without the flag, and no toggle plus open body when
      a suggestion, warning or error is set. Verify: that test file passes.
- [ ] 3.2 `CvContentEditor`: provide `mobile-collapsible` from `useMediaQuery('(min-width: 768px)')`; pass counts
      for the six list sections, `default-open` for contact, summary and experience only, an icon per section, and
      `locked` for list sections whose entries hold a suggestion, flag or error. Verify:
      `pnpm vitest run test/unit/TailoredCvPage.test.ts test/unit/CvTemplatePage.test.ts
  test/unit/CvTemplateNewPage.test.ts` passes, with a new TailoredCvPage case that a suggestion for a collapsed
      section shows it open.

## 4. Tailored CV desktop rail

- [ ] 4.1 `app/pages/listings/[id]/cv.vue`: lift the cap from `lg`; main column (suggestions banner, content, error
      alerts, save bar) and sticky rail (Tailor with AI / style card, PDF card) using the template editor's grid
      classes and `contents` wrappers; style fields single-column in the rail; fieldset around the grid. Add
      `data-testid="tailored-cv-rail"` and a TailoredCvPage test that the AI card and PDF card are inside the rail
      and the save bar is not. Verify: `pnpm vitest run test/unit/TailoredCvPage.test.ts` passes.

## 5. Template header on phones

- [ ] 5.1 `app/pages/cv-templates/[id].vue`: hide the Versions button below `sm` and add a Versions menu item there
      with the same disabled rule. Add a CvTemplatePage test that the menu item opens the versions panel. Verify:
      `pnpm vitest run test/unit/CvTemplatePage.test.ts` passes.

## 6. Checks and review

- [ ] 6.1 Run `pnpm test`, `pnpm lint` and `pnpm typecheck` (shared components changed). Verify: all pass.
- [ ] 6.2 Build and restart preview with `echo '{}' | .claude/hooks/preview.sh`, then retake the step 1 screenshots
      for profile, tailored CV, template page and new template at 375/768/1440, plus tailored CV at 1024 and one
      dark shot at 375. Verify by eye: compact empty rows, counts, phone collapse with locked cards open, rail
      sticky and scrollable, profile unchanged.
- [ ] 6.3 Run `ui-reviewer` on the diff with the before/after screenshots; fix confirmed issues and list the rest.
      Verify: its findings are answered in the handoff.
- [ ] 6.4 Update the work log, and `docs/STATUS.md` through `log-progress`. Verify: STATUS names the shared section
      cards and the tailored CV rail, with check results and "no E2E".
