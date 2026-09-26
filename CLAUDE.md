# Job Hunt Assistant UI

Hobby Nuxt 4 frontend (Nuxt UI v4, Tailwind 4, Pinia) for the Job Hunt Assistant .NET API.
REST for auth (HttpOnly cookie session) and health, GraphQL for domain data, GraphQL subscriptions
over SSE for LLM parse-job updates.

## Read first (instead of exploring the codebase)

- `docs/STATUS.md` — what exists right now: pages, components, stores, API operations in use. **Start here.**
- Backend contract: `../job-hunt-assistant-api-sept-2026/schema.graphql` (GraphQL schema) and
  `../job-hunt-assistant-api-sept-2026/docs/STATUS.md` (REST endpoints). These are the only files
  outside this repo you may read. Read them only for API work, and only the parts you need.

## Commands

- Dev: `pnpm dev` (the owner runs it; don't start or stop it)
- Lint / format: `pnpm lint`, `pnpm format`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test` (single file while iterating: `pnpm vitest run test/unit/<Name>.test.ts`)
- E2E: `pnpm test:e2e` (builds prod, serves on :3100, API mocked per test, no backend needed)

## Conventions

- Nuxt 4 layout: all app code is under `app/`. Components are auto-imported by path:
  `components/<feature>/<Name>.vue` → `<FeatureName>` (e.g. `dashboard/ApiHealth.vue` → `<DashboardApiHealth>`).
- Nuxt UI components (`U*`) first, then Tailwind utilities. SCSS (`assets/scss/`) only for what
  utilities can't express. Theme via `app.config.ts` (colors) and `--ui-*` tokens in `assets/css/main.css`.
  Icons: lucide (`i-lucide-*`).
- All backend calls go through the same-origin proxy (`/api/**`, `/graphql`). Never call the API URL
  directly: the proxy is what makes the HttpOnly cookie and SSE work without CORS.
- Mirror the backend split: REST only for auth and health, GraphQL for all domain data.
- Pinia only for state shared across pages. Everything else stays in the component or a composable.
- Tests: keep them simple and few. Unit tests (`test/unit`, `mountSuspended` + `registerEndpoint`) cover
  the happy path of components with real logic. E2E (`test/e2e`, `page.route` mocks) only for key flows.
  No snapshot tests. Select by `data-testid` or role, never by class.
- Prettier owns formatting; lint-staged runs ESLint + Prettier on commit.
- Secrets: `.env` only (see `.env.example`). Never commit them.

## Code style: simple over clever

- This is a simple hobby project. No accessibility work or i18n beyond Nuxt UI's defaults.
- Performance matters: fetch only the fields a view needs, avoid request waterfalls, paginate lists,
  lazy-load heavy components, and don't add heavy packages. Don't micro-optimize without a reason.
- Write the simplest code that works. Readable beats reusable.
- No abstractions (composables, wrapper components, base components, generic helpers) until there are
  2+ real uses.
- No defensive code for impossible cases. Only catch errors you actually handle.
- Comments explain _why_, never _what_.
- Change only what the task needs. No drive-by refactors or renames.
- Use Nuxt and Nuxt UI built-ins before adding a package.
- Delete dead code; don't comment it out.

## Commits

- Atomic: one logical change per commit. Don't mix features, refactors, and formatting.
- Subject: imperative, ≤ 50 chars, no trailing period (e.g. `Add application status history`).
- Body: 1–3 lines of _why_.
- Commit only when asked.
- **Record the why at change time**, not commit time: after each change, append one line to `.claude/commit-notes.md` (`- <area>: <what> — <why>`). When committing, build messages from it, then remove the lines you used. This survives long chats, compaction, and `/clear`.

## Working rules (token budget: personal plan)

- Don't spawn subagents unless the user asks or the task clearly matches `ui-ux-designer`,
  `api-integration`, or `frontend-consultant`.
- Prefer targeted reads (Grep, then a line range) over whole-file reads. Never read `.nuxt/`,
  `.output/`, `node_modules/`, or `pnpm-lock.yaml`.
- Stay inside this repo, apart from the two backend files listed under "Read first". Ask before
  touching anything else outside it.
- Answer style: direct, like pre-2020 StackOverflow/GitHub. Answer first, no preamble, no recap,
  no closing offers. Code over prose.
- Show changed snippets, not whole files.
- Verify with `pnpm typecheck`, `pnpm lint`, and `pnpm test`. If a live check is truly needed, ask first.
- After finishing a milestone or a notable feature, run `/log-progress` to update `docs/STATUS.md`.
- The owner is a senior Vue 2 engineer, new to Vue 3 and Nuxt 4. When a Vue 3 / Nuxt 4 concept first
  comes up (Composition API, `<script setup>`, auto-imports, `useFetch`/`useAsyncData`, `useState`,
  hydration, Pinia, macros like `defineModel`), explain _why it works that way_ in 1–2 lines, with the
  Vue 2 equivalent if one exists (e.g. `ref()` ≈ a `data()` field, Pinia ≈ Vuex without mutations).
  Skip web basics and anything that works the same as in Vue 2.
