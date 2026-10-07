# Tasks

## 1. URL parse call

- [x] 1.1 In `useParsePrompt.ts`, add a `PARSE_LISTING_FROM_URL` document and `parseFromUrl(listingId)` returning `{ result }` or `{ error }` with a `parsingUrl` ref; no toast for expected failures. Verify: `pnpm typecheck`

## 2. Modal

- [x] 2.1 In `ParseModal.vue`, add an optional `listingId` prop and a "Parse automatically" button (`data-testid="parse-url"`, only with `listingId`, loading while `parsingUrl`) that feeds `result` into `apply`. Verify: unit test that a succeeded result emits `apply` and closes; no button without `listingId`
- [x] 2.2 Show failures in a `UAlert` (`data-testid="parse-url-error"`), cleared on retry/close. Verify: unit test

## 3. Pages

- [x] 3.1 Pass `:listing-id="id"` in `[id]/edit.vue`. Verify: typecheck, lint

## 4. Checks

- [x] 4.1 Run `pnpm vitest run test/unit/ParseModal.test.ts`, `pnpm typecheck`, `pnpm lint`; report E2E not run
- [x] 4.2 `pnpm build` then `pnpm preview --port 3000`; say the UI is unverified unless the owner allows a live check
- [x] 4.3 Update `.claude/state/ui-inventory.md` (`parseFromUrl`, ParseModal props), run `/log-progress`
