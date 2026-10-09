# Tasks

## 1. Merge logic

- [x] 1.1 In `useListingForm.ts`, split `fillDraft`'s normalization into one helper that returns the cleaned draft values, keep `fillDraft` behaviour unchanged (existing `fillDraft` tests still pass)
- [x] 1.2 Add `mergeDraft(draft)`: assign only parsed values that are non-empty (empty string / undefined / `UNSPECIFIED` deadline / empty list = keep saved), never touch `url`, set `isAnalyzed: true`; don't default `postedOn` to today. Verify with a `useListingForm.test.ts` case: fill from a listing, merge a partial draft, check replaced scalars, kept description/postedOn/deadline/url, replaced skills, kept locations

## 2. Edit page

- [x] 2.1 In `pages/listings/[id]/edit.vue`, add a "Paste from ad" button (same look as add page, `data-testid="parse-open"`) and `<ListingsParseModal @apply="onDraft">`; `onDraft` calls `mergeDraft`, revalidates the form, shows the "Form filled from the ad" toast. Verify: typecheck passes, no save request until "Save changes"
- [x] 2.2 Call `provideNewNames()` on the edit page and `checkNewNames(state)` in `onDraft`, so new names are flagged. Verify: typecheck
- [x] 2.3 Open the parse modal on load when the route has `?analyze`; verify by reading the page (query read once, modal open state)

## 3. Detail page

- [x] 3.1 In `pages/listings/[id]/index.vue`, add an "Analyze" button (`i-lucide-sparkles`, `data-testid="listing-analyze"`) linking to `/listings/{id}/edit?analyze=1`. Verify: typecheck, lint

## 4. Checks

- [x] 4.1 Run `pnpm vitest run test/unit/useListingForm.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm test`; report E2E not run
- [x] 4.2 `pnpm build` then `pnpm preview --port 3000`; say the UI is unverified unless the owner allows a live check
- [x] 4.3 Update `.claude/state/ui-inventory.md` (`mergeDraft`) and run `/log-progress`
