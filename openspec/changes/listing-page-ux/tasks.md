# Tasks

## 1. Design check

- [x] 1.1 `ui-ux-expert` review of the listing page, edit page, form fields and parse modal; findings folded into
      proposal, spec and design (done during planning)
- [x] 1.2 Confirm `USelectMenu` `clear` and `UInputNumber` `increment`/`decrement` props exist in the installed
      Nuxt UI (docs or `pnpm typecheck` on a one-line use); adjust design 11/13 if not

## 2. Listing page

- [x] 2.1 Toolbar in `pages/listings/[id]/index.vue` (stacked on mobile, Analyze ad neutral subtle, Edit solid,
      More menu with Mark analyzed (confirm kept) / Archive / Unarchive); existing `listing-*` test ids still resolve
- [x] 2.2 Header (title, favorite with new `size` prop, same-size badge row, company/role/location rows, compact
      dates, View ad) and archived notice; move the Archived badge out of `Application.vue`; delete the
      `ListingsDates` `detail` branch and its tests; rename the list card's "View posting" to "View ad"; verify
      `pnpm vitest run test/unit/Dates.test.ts`
- [x] 2.3 Details card as a muted-label `dl`; Summary into the wide column; skills grouped Required / Nice to have;
      languages with required/optional text
- [x] 2.4 Application card: no status badge, "Not applied yet", neutral company count; Interviews "Add interview"
      neutral; loading skeleton matches the layout
- [x] 2.5 Add `test/unit/ListingPage.test.ts` (`mountSuspended` + `registerEndpoint`): header shows title and
      badges, More offers Mark analyzed + Archive for an unanalyzed listing, skills split into two groups; verify with
      `pnpm vitest run test/unit/ListingPage.test.ts`

## 3. Edit page

- [x] 3.1 Toolbar (Back to listing, Analyze ad) and saved-title heading with company in `pages/listings/[id]/edit.vue`;
      rename the add page's button to Analyze ad; confirm modal stays; `parse-open` still opens the modal on both pages
- [x] 3.2 Replace the "Form filled from the ad" toast with the dismissible notice on add and edit (edit adds the
      kept-values and marks-analyzed sentences); add a test case that applying a draft shows the notice

## 4. Form fields

- [x] 4.1 Reorder `Form.vue` fields per design 10; rename "Job" card to "Details"; labels/placeholders per design 14;
      Summary field gets its own label
- [x] 4.2 Clearable optional selects (employment type, seniority, ad language, CEFR level); one combined Deadline
      field; check `useListingForm` validation errors still show on the right field; verify
      `pnpm vitest run test/unit/useListingForm.test.ts`
- [x] 4.3 Skill and language rows: two-line mobile layout, `sm` column headers, "Level N" items, labelled min years
      without steppers, `Remove {name}` aria-labels (also locations), skill search below the rows; update
      `SkillsField.test.ts` if selectors change and verify it passes

## 5. Analyze-ad modal

- [x] 5.1 `useParsePrompt.parse` returns `{ result } | { error }`; quick-add toasts the error and keeps its fallback;
      verify `pnpm typecheck`
- [x] 5.2 Rebuild `ParseModal.vue` with tabs, shared ad text, footer button per tab, static header, From link note,
      numbered own-AI steps, inline built-in error, no dismiss while parsing, URL hint only without `listingId`; keep
      test ids; update `ParseModal.test.ts` and add a case for the inline built-in error; verify
      `pnpm vitest run test/unit/ParseModal.test.ts`

## 6. Wrap-up

- [x] 6.1 Update `.claude/state/ui-inventory.md` and `docs/REUSABLES.md` (ParseModal tabs, FavoriteButton `size`,
      Dates without `detail`, `parse` return shape, toggle-vs-select rule)
- [x] 6.2 `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass (E2E not run)
- [x] 6.3 `pnpm build` then `pnpm preview --port 3000`; ask the owner for a live check at mobile and desktop width
- [x] 6.4 Run `/log-progress` to update `docs/STATUS.md`
