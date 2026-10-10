# Tasks

## 1. Design check

- [x] 1.1 Layout per state confirmed with ui-ux-expert (done during propose); note any change in design.md

## 2. Explicit save

- [x] 2.1 Make Save `type="button"` calling `form.submit()`; verify by the test in 2.2
- [x] 2.2 Add `test/unit/QuickAdd.test.ts` (`mountSuspended` + `registerEndpoint` for `/graphql`): Enter in a row title saves nothing; clicking Save sends one request; verify with `pnpm vitest run test/unit/QuickAdd.test.ts`

## 3. Leave action and status

- [x] 3.1 Replace Cancel/Done with "Back to listings" / primary "View listings" per state, hiding Save when all are saved; verify by test in 3.3
- [x] 3.2 Add the leave confirmation (`AppConfirmModal`) when saved + pending, the "N saved · M need fixing" status line, and the state-based top summary; verify by test in 3.3
- [x] 3.3 Extend `QuickAdd.test.ts`: after a partial save the status line shows counts and Back to listings opens the confirm; after all saved, "View listings" shows and Save is gone

## 4. Wrap-up

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; all pass (UI unverified unless the owner allows a live check)
- [x] 4.2 Run `/log-progress` to update `docs/STATUS.md`
