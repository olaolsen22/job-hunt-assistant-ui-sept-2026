# Job Hunt Assistant UI

Personal Nuxt 4 / Vue 3 app and GitHub showcase: Nuxt UI v4, Tailwind 4, Pinia,
with a fixed .NET API. REST for cookie auth and health; GraphQL for domain data;
SSE subscriptions for parse-job updates.

## Scope and communication

- Prefer clear, idiomatic, maintainable code, useful behavior tests, and a usable responsive UI.
  No production hardening, speculative architecture, new packages, or unrelated cleanup.
- Answer briefly: result, relevant checks, remaining limitations. Explain a new Vue 3 / Nuxt 4
  concept once in 1–2 lines, with the Vue 2 equivalent when useful; the owner knows Vue 2 well.
- Implement clear requests directly. Ask only for material ambiguity or actions requiring approval;
  existing authorization carries forward. Use OpenSpec when requested or continuing an existing
  change; tiny fixes and documentation edits need no new proposal.

## Context and efficiency

- At session start or after context loss, read `.claude/state/work-log.md`, run `git status --short`
  and `git log -5 --oneline`. Reconcile only entries relevant to the task; code and git outrank notes.
- Search with `rg` first, then read relevant ranges. Batch independent reads. Reuse findings within
  the session; reread only after changes or when uncertain. Avoid whole-repo dumps.
- For UI work, search `.claude/state/ui-inventory.md` and confirm relevant paths in `app/`.
  Read `docs/REUSABLES.md` for needed prop details and `docs/STATUS.md` for feature scope only.
- Reuse or extend existing code. New shared abstractions need two real uses.
  Use `ui-controller` for difficult reuse questions, `ui-ux-expert` for substantial new flows/layouts,
  and `ui-reviewer` only when a meaningful review helps. No mandatory advisor pipeline.
  Apply their instructions inline; delegate only when the owner asks.
- Keep the work log to pending work, relevant decisions, files, checks, and a draft commit message.
  Update once before editing and at handoff; add intermediate updates only for decisions/blockers
  worth preserving. After a verified commit, clear only covered work and record hash + subject.
- Update the inventory only when reusable exports change. After a notable UI milestone, use
  `log-progress` (`/log-progress` in Claude) to update `docs/STATUS.md`; skip setup-only edits.

## Backend and data

- Contract: `../job-hunt-assistant-api-sept-2026/schema.graphql`; REST reference:
  `../job-hunt-assistant-api-sept-2026/docs/STATUS.md`. Read only relevant sections. These are
  the only project files outside this repo to access; never edit the API or copy its schema here.
- Never invent API fields/types/arguments. Search the schema before declaring a feature unsupported.
  Derive API types with `ResultOf`; documents are literal ``graphql(`...`)`` strings, without
  interpolation, sent through `gql(doc, vars)` and existing mutation helpers.
- Use same-origin proxies `/api/**` and `/graphql`, never the backend URL directly.
  API owns validation, duplicate rules, and permissions; display its errors.
- Solve missing convenience operations client-side. For actual missing data, security issues, or
  costly N+1 requests, state the limitation and best feasible workaround; optionally make one
  short backend suggestion. Do not imply a workaround exists when the contract cannot support it.
- Fetch needed fields, paginate lists, avoid waterfalls, and lazy-load heavy components.
  Pinia is for shared state; use local state or existing URL-view patterns otherwise.

## Frontend conventions

- App code is under `app/`; path-based component auto-imports:
  `components/<feature>/<Name>.vue` → `<FeatureName>`.
- Prefer Nuxt/Nuxt UI built-ins, then Tailwind defaults and theme tokens (`--ui-*`);
  icons are `i-lucide-*`. Custom CSS/SCSS, arbitrary values, `!important`, and `:ui` overrides
  need a concrete reason; comment when that reason is not obvious.
- Follow existing screen patterns. Handle loading, empty, and error states.
  Empty lists: centered muted icon above text; stretching cards let the body fill.
- Use arrow functions. Comments explain why; catch only handled errors, remove dead code,
  and avoid defensive branches for impossible states.
- Keep basic accessibility (labels, semantic controls, keyboard use) and mobile/light/dark usability.
  No dedicated accessibility audit, i18n, or elaborate design system unless requested.
- Prettier owns formatting; lint-staged runs ESLint/Prettier on commit. Secrets stay in `.env`.

## Validation and commands

- Code changes: run relevant Vitest tests, `pnpm lint`, and `pnpm typecheck` once after edits.
  Repeat only for failures or subsequent relevant changes. Run `pnpm test` for broad/shared changes
  or when requested; one file: `pnpm vitest run test/unit/<Name>.test.ts`.
- Add a few tests for observable changed behavior and likely regressions; no snapshots or tests
  mirroring implementation. Existing Nuxt helpers: `mountSuspended`, `registerEndpoint`;
  select by role or `data-testid`. Styling/docs-only changes need no new behavior tests.
- Docs/instructions-only changes: check changed-file formatting and references; skip app tests,
  lint, typecheck, and build. `pnpm format:check` checks the repo; prefer changed-file checks.
- Never run E2E, Playwright, browser setup, or live UI checks without explicit authorization.
  Report checks honestly; for UI changes include E2E/UI verification status. Do not claim
  skill-format validation proves workflow behavior.
- `pnpm gql:gen` regenerates `app/graphql-env.d.ts` after schema changes; include it in the next
  requested commit. Never run `pnpm dev` / `nuxt dev` or stop the owner's dev server.
- After app code changes in any session, run `pnpm build`, then serve the built app with
  `HOST=0.0.0.0 pnpm preview --port 3000` and leave it running for the owner.
  Check `lsof -i :3000` before starting or replacing a preview; stop only an identified stale
  preview process and leave the owner's dev server alone. Report a port conflict if it prevents
  serving the build. Docs/instructions-only changes still skip build/preview.

## Boundaries and commits

- Do not read `.env`, `.nuxt/`, `.output/`, `node_modules/`, or `pnpm-lock.yaml`.
  Do not run `pkill` or `killall`. Repo-installed tools may use their normal generated/dependency files.
  Skill instructions and requested tooling are outside the backend-project restriction above.
- Preserve unrelated owner edits. Commit only when asked; review the diff first.
  Subject says why, blank line, short change bullets, then the owner's chosen footer:
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
