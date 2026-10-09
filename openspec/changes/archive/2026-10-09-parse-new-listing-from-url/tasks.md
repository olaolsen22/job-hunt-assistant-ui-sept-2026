# Tasks

## 0. UX

- [x] 0.1 ui-ux-expert review of the first (inline button) version; owner chose the Analyze ad modal with its own link input (the expert's recommendation).

## 1. Parse call

- [x] 1.1 Add the `ParseUrl` mutation and `parseNewUrl(url)` / `parsingNewUrl` to `useParsePrompt`, returning `{ result } | { error }` like `parseFromUrl`; verify with `pnpm typecheck`.
- [x] 1.2 Move ParseModal's outermost-JSON extraction into `app/utils/parseDraft.ts`; `ParseModal.test.ts` still passes.

## 2. Add page

- [x] 2.1 Remove the inline URL-parse button, error and props from `ListingsForm` and `add.vue`, and delete `test/unit/ListingsAdd.test.ts`; ListingPage tests pass.
- [x] 2.2 Give `ListingsParseModal` a `url` prop and an Ad link input on From link (default tab) when there's no `listingId`: prefilled from `url`, parse disabled while empty, calls `parseNewUrl`; errors offer "Paste the ad instead"; `apply` also emits the link, which `add.vue` copies into the form.
- [x] 2.3 ParseModal tests: a pasted link is parsed and handed back (button disabled while empty); an unreadable link offers paste. `pnpm vitest run test/unit/ParseModal.test.ts` passes.

## 3. Wrap-up

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` pass; `pnpm build` (preview skipped: owner's `pnpm dev` holds :3000).
- [x] 3.2 Update `.claude/state/ui-inventory.md` and `docs/REUSABLES.md`; run `/log-progress`.
