# Tasks

## 1. Typed API and reviewed selection model

- [x] 1.1 Run `pnpm gql:gen` against the configured backend schema; verify `app/graphql-env.d.ts` includes all CV prompt, candidate, parse/preview/import and selection types.
- [x] 1.2 Add `useProfileCvImport` with literal prompt, parse, preview and atomic save documents, all supported candidate fields, returned `PROFILE_FIELDS`, and inline error results; verify focused mocked GraphQL tests cover success, failed parse, preview rejection and save errors without parse-time import calls.
- [x] 1.3 Add local draft initialization, manual target selection, validation and typed selection serialization; verify utility tests cover omission versus null, complete structural updates, add IDs absent, same-parent bullet IDs, parent changes, repeated target rejection, skills/languages upserts and list replacement opt-in.
- [x] 1.4 Document the new composable/types in `docs/REUSABLES.md` and inventory only for reusable exports introduced; verify paths and signatures against delivered files.

## 2. Parsing modal inputs

- [x] 2.1 Build `ProfileCvImportModal` input tabs following `listings/ParseModal.vue`: English text/Markdown, paid AI usage, prompt copy without CV input, external JSON preview, busy states and inline errors; verify modal tests preserve input across tabs/errors and ensure both routes reach review without saving.
- [x] 2.2 Implement prompt loading/copy failure states, input size limits and retry; verify tests cover blank/oversized text, invalid JSON, failed prompt retrieval and clipboard failure without losing draft input.

## 3. Editable shared review

- [x] 3.1 Build sectioned local editors for basics, links/hobbies replacement lists, all four history kinds, bullets, standalone skills and languages using existing field controls and inline ui-ux-expert recommendations in design.md; verify tests show warnings and enable Save only for valid nonempty selections, including corrected dates/levels and current/ongoing confirmation.
- [x] 3.2 Add explicit add/update/skip and manual entry/bullet target pickers with current values visible and complete retained structural values; verify tests prevent automatic matching, cross-parent bullet updates and repeated targets, and omit skipped content from the request.
- [x] 3.3 Add Back/resume, replace-review/discard confirmations and disabled dismissal during parse/save; verify tests preserve edits when returning to input or canceling discard and send no save on dismissal.
- [x] 3.4 Document the modal's review and save event contract in `docs/REUSABLES.md`; verify documented local-only editing and replacement behavior against the implementation.

## 4. Profile integration and atomic save

- [x] 4.1 Add the lazy-loaded Import CV action to `/profile`, refresh profile targets before review, and explain disabled import on Norwegian-primary profiles through the existing language control; verify ProfilePage tests cover empty/populated English profiles, preserved Norwegian translations and the Norwegian-primary restriction.
- [x] 4.2 Connect Save import to one mutation, prevent double-submit, display path errors, retain edits on failures, refresh invalid target choices and replace page data with the returned profile on success; verify integration tests assert one reviewed payload, no partial displayed changes after rejection and modal close on success.
- [x] 4.3 Update `docs/STATUS.md` using log-progress and relevant inventory entries after the feature milestone; verify docs describe both routes, atomic save, preservation and explicit selection limitations.

## 5. Integration verification

- [x] 5.1 Run relevant CV import and ProfilePage unit tests, `pnpm lint`, `pnpm typecheck`, changed-file formatting and diff whitespace checks; verify all pass and report E2E/live UI as unrun unless separately authorized.
- [x] 5.2 Run `pnpm build`, inspect port 3000 ownership and serve the production build with `HOST=0.0.0.0 pnpm preview --port 3000` per CLAUDE.md; verify the process starts or report an identified port conflict without stopping the owner's dev server.
