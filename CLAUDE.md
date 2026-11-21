# Job Hunt Assistant UI

Personal Nuxt 4 / Vue 3 SPA (`ssr: false`, also a portfolio piece) for job listings, companies,
contacts, a CV profile and AI-assisted application documents, on a fixed .NET API (REST for
cookie auth/health, GraphQL for domain data). Nuxt UI v4, Tailwind 4, Pinia (auth only), VueUse,
gql.tada, Vitest + `@nuxt/test-utils`, Playwright, `@vite-pwa/nuxt`. Node 24, pnpm. `rg` available.

## Commands

- Unit test: `pnpm vitest run test/unit/<Name>.test.ts` (only files you touched); then `pnpm lint`,
  `pnpm typecheck`. Never `pnpm test` or `pnpm test:e2e` unless asked; say "E2E not run".
- `pnpm gql:gen` regenerates `app/graphql-env.d.ts` (generated, large: search, don't read).
- After code changes: run the `rebuild-preview` skill (stop preview, build, restart detached on
  :3000). Never run `pnpm preview`/`pnpm dev` in the foreground or as a Bash background job.

## Data flow

- Call same-origin `/api/**` and `/graphql` (proxied to `API_URL`), never the backend URL.
- `utils/graphql.ts`: literal `graphql()` docs (fragments as 2nd arg), `gql(doc, vars)`,
  `batchDocument()`. Types via `ResultOf<typeof DOC>`; never hand-write API types.
- Schema: `../job-hunt-assistant-api-sept-2026/schema.graphql` — read only relevant types, never
  edit; ask before reading anything else outside this repo.
- Mutations via `useMutation` (toasts API error, refetches on `*NotFoundError`); AI via
  `useAiRequest()` + `AppAi*` components; toasts via `useAppToast()`, never `useToast()`.
- Auth: `stores/auth.ts`, `middleware/auth.global.ts`; roles `Owner`/`Guest`.
- List views keep state in the URL query (`useListingsView`, `utils/urlQuery.ts`).

## Finding code

Components auto-import by path (`listings/Row.vue` → `<ListingsRow>`); composables/utils
auto-import, `constants/` doesn't. Pages mirror routes under `app/pages/`; each feature has
`components/<feature>/*` and `use<Feature>*` composables. Before writing a helper, search
`docs/REUSABLES.md` by name (update it when exports change). Non-obvious homes:
`use{Companies,Contacts,Listings}View` → `useListingsList.ts`; `usePossibleDuplicates` →
`listingCompareFields.ts`; `useLeaveConfirm`/`useAiLeaveGuard` → `useLeaveGuard.ts`;
`useLlmCallLimits` → `useProviderKeys.ts`; `usePendingImportCount` → `useListingImports.ts`;
`useAiInFlight` → `useAiRequest.ts`; CV templates are `BaseCv` in the API (`useBaseCvs.ts`).

Docs: `docs/STATUS.md` (per-page behaviour + decisions; search it), `docs/BACKLOG.md`.

## Conventions

- `<script setup lang="ts">`, typed props/emits, arrow functions. Comments explain why.
- Nuxt UI props/slots and Tailwind built-ins first; `:ui`/custom CSS only with a stated reason.
  Icons `i-lucide-*`. Use the `nuxt-ui` skill when writing templates.
- Handle loading, empty and error states; show API error messages.
- Prettier formats (no semicolons, single quotes, width 100).
- Don't read `.env`, `.nuxt/`, `.output/`, `node_modules/`, `pnpm-lock.yaml`.
- Tests: `test/unit/<Name>.test.ts`; how-to in the `unit-tests` skill.

## Workflow for real features (not small fixes)

1. User flow first: ask the owner for the user flow. If changing a feature with no documented
   flow, ask before touching it. Brainstorm it together; agree a brief overview of the flow.
2. `ux-designer` agent on the agreed flow before placing new UI.
3. Tests first (light: cover the flow's key behaviour, not every edge), then implement here,
   rebuild preview.
4. `tester` agent: fill test gaps + screenshots (its screenshots count as your visual check; open only the
   ones it flags or the owner should see).
5. `senior-reviewer` on the diff; fix what it finds.

Pass agents a short brief (files changed, intent) so they don't re-explore the repo.

## Commits and branches

The history is public (hiring portfolio): keep it clean.

- Before the first edit of any change (feature, fix, docs, tests), without asking:
  1. `git branch --show-current`. On `development` or `master`, or on another change's branch:
     `git switch -c <type>/<slug> development`. Never edit files on `development` or `master`.
     If the working tree holds uncommitted work from another change, flag it before switching.
  2. Add its entry to `.local/changelog.md` (private, gitignored, never pushed), newest first:
     ```md
     ## YYYY-MM-DD · <area>: <what>

     - Goal: <the request's goal, neutral and concise; never quote the owner>
     - Why: <problem it solves>
     - Files: <main files; keep updated as you go>
     - Branch: <type>/<slug>
     - Status: uncommitted
     ```
- Commit boundary: when the change is done and its checks pass, stop and propose the commit
  subject. Commit only when the owner says yes; never auto-commit. After committing, set
  `Status` to the short hash.
- On "commit": every uncommitted file must belong to a changelog entry (write missing entries
  first; ask about files that fit none, e.g. stray screenshots). Commit each entry on its own
  branch: `git switch -c <branch> development` (or `git switch <branch>`), add only that
  entry's files, commit, then `git switch development` for the next; the other changes carry
  over in the working tree. Never commit feature work directly on `development`. Don't stash or
  verify each intermediate commit.
- Subject: Conventional Commits `<type>(<scope>): <imperative>`, ≤50 chars (`feat`, `fix`,
  `refactor`, `test`, `docs`, `chore`, `style`). Body: the why as product reasoning in 1–3 lines,
  wrapped at 72. No prompts, "owner requested" or AI wording. Keep the `Co-Authored-By: Claude`
  trailer.
- Branches: `development` is the integration branch; `master` is for publishing and only gets
  `development` merged in when the owner asks. Each feature or fix gets a short-lived branch off
  `development` named `<type>/<slug>` (e.g. `feat/listing-shortlist`, `fix/login-redirect`), one
  feature in one or more small commits (created as above, before the first edit).
- After a commit round: push the new branches, then end with the commits' log
  (`git log --no-walk`) and one link per branch for the owner to open its PR manually:
  `https://github.com/olaolsen22/job-hunt-assistant-ui-sept-2026/compare/development...<branch>?expand=1`.
  Never create PRs yourself. PRs merge into `development` with a merge commit (not squash), and
  the branch is deleted afterwards.
