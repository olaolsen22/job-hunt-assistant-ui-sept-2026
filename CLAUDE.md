# Job Hunt Assistant UI

Personal Nuxt 4 / Vue 3 app and GitHub showcase: Nuxt UI v4, Tailwind 4, Pinia,
with a fixed .NET API. REST for cookie auth and health; GraphQL for domain data.

## Scope and communication

- This is a personal project and portfolio showcase of effective AI-assisted development and
  proper Nuxt standards. Optimize for understandable code, useful behavior tests, a usable UI,
  and reviewable decisions. Keep rigor proportional to a single-owner app; no enterprise process,
  speculative architecture, production hardening, new packages, or unrelated cleanup.
- Answer briefly: result, relevant checks, remaining limitations. Explain a new Vue 3 / Nuxt 4
  concept once in 1–2 lines, with the Vue 2 equivalent when useful; the owner knows Vue 2 well.
- Treat clear action requests as authorization to finish the work, including fixes and relevant
  validation. Do not stop at a plan or offer to continue. Existing authorization carries forward;
  ask only when a missing answer changes behavior/scope or host permissions require approval.
  Prepare a concrete reviewable result before asking for final approval. Explain any required
  pause with its source. Use OpenSpec when requested or continuing an existing change; load only
  the selected workflow, and keep planning separate from implementation.
- Give short updates for meaningful findings or blockers; final replies cover outcome, checks,
  and limitations. Status questions and corrections steer ongoing work unless the owner cancels it.

## Context and efficiency

- Main session: check `git status --short` and relevant work-log entries once; read
  `git log -5 --oneline` only to reconcile commit state. After compaction, continue from the summary and read
  only missing/stale context. Code and git outrank notes; do not restart completed work.
- Search with `rg` first, then read relevant ranges. Batch independent reads. Reuse findings within
  the session; reread only after changes or when uncertain. Scope searches to likely paths, return
  filenames when sufficient, and limit noisy output without hiding failures. Avoid whole-repo dumps.
- For UI work, search `.claude/state/ui-inventory.md` and confirm relevant paths in `app/`.
  Read `docs/REUSABLES.md` for needed prop details and `docs/STATUS.md` for feature scope only.
- Reuse or extend existing code. New shared abstractions need two real uses.
  Use `ui-controller` for difficult reuse questions, `ui-ux-expert` for substantial new flows/layouts,
  and `ui-reviewer` only when a meaningful review helps. No mandatory advisor pipeline, except
  the major-change workflow below, which requires all three agents. Otherwise apply their
  instructions inline; delegate only when the owner asks, including built-in agents
  and agent teams. Give delegated agents one question, relevant paths, known findings, and a
  completion criterion. Do not duplicate their investigation or automatically resume a capped run.
- Efficiency means eliminating redundant work, not dropping requested behavior or useful checks.
  Keep durable rules here and task details in the log/specs. Usage troubleshooting and sources:
  `.claude/usage-guide.md` (read only when needed).
- Keep the work log to pending work, relevant decisions, files, checks, and a draft commit message.
  Update once before editing and at handoff; add intermediate updates only for decisions/blockers
  worth preserving. After a verified commit, clear only covered work and record hash + subject.
- Update the inventory only when reusable exports change. After a notable UI milestone, use
  `log-progress` (`/log-progress` in Claude) to update `docs/STATUS.md`; skip setup-only edits.

## Major changes and new features

Applies to new features, new screens/flows, and changes spanning several screens or shared
components; not bug fixes, copy/styling tweaks, or docs. This is standing authorization for
the steps below.

1. Regenerate types: `pnpm gql:gen`; note any `app/graphql-env.d.ts` diff relevant to the work.
2. Existing feature: build preview, then screenshot the affected screens at phone (375),
   tablet (768) and desktop (1440) widths, light mode, using the guest account or mocked
   `/api/auth/me` + `/graphql` responses. Save to the scratchpad, not the repo. New features
   skip this step.
3. Analyze the API team's message the owner pasted: what changed, fields/operations to use,
   breaking changes, and conflicts with the schema. If none was pasted, ask for it once, or
   proceed when the owner says there is none.
4. Before coding: run `ui-ux-expert` and `ui-controller` in parallel with the request, the
   findings from steps 1–3, screenshot paths, and relevant `app/` paths. Fold their advice into
   the plan or OpenSpec artifacts; note where you disagree and why.
5. After coding and checks: rebuild preview, take the same screenshots, and run `ui-reviewer`
   on the diff plus before/after screenshots. Fix confirmed issues; report the rest.

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

- Use idiomatic Vue 3 / Nuxt 4: `<script setup lang="ts">`, typed props/emits, composables for
  reusable logic, and Nuxt auto-imports. Respect SSR: browser APIs belong in client lifecycle/code;
  use Nuxt data helpers where appropriate and preserve the existing GraphQL/cache conventions.
  Avoid duplicate fetches, hydration mismatches, hand-written API types, and Vue 2 workarounds.
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

- Code changes: run relevant Vitest tests, `pnpm lint`, and `pnpm typecheck` once after a coherent
  batch of edits, not after each file, task checkbox, or advisor pass.
  Repeat only for failures or subsequent relevant changes. Run `pnpm test` for broad/shared changes
  or when requested; one file: `pnpm vitest run test/unit/<Name>.test.ts`.
- Add tests for consequential behavior and likely regressions; reversible low-impact edits need
  no new tests. No snapshots or tests mirroring implementation. Existing Nuxt helpers: `mountSuspended`, `registerEndpoint`;
  select by role or `data-testid`. Styling/docs-only changes need no new behavior tests.
- Docs/instructions-only changes: check changed-file formatting and references; skip app tests,
  lint, typecheck, and build. `pnpm format:check` checks the repo; prefer changed-file checks.
- Never run E2E, Playwright, browser setup, or live UI checks without explicit authorization.
  Screenshots for UI verification and the major-change workflow are authorized (guest account or
  mock data); the E2E suite still is not. Report checks honestly; for UI changes include E2E/UI verification status. Do not claim
  skill-format validation proves workflow behavior.
- `pnpm gql:gen` regenerates `app/graphql-env.d.ts` after schema changes; include it in the next
  requested commit. Never run `pnpm dev` / `nuxt dev`.
- No `nuxt dev`: serve `nuxt preview` on :3000 (the `tailscale serve` target). Once your code
  changes are done and checked, build and restart preview yourself by running
  `echo '{}' | .claude/hooks/preview.sh` (Bash timeout 600000). The script builds, then restarts
  preview detached and records its stamp, so the same script running as the Stop hook skips the
  work. Fix any build failures it reports. Serving is not UI verification; say so.
- Command time limits: a foreground Bash command is stopped after 10 minutes at most, and a
  background one after 2 hours. Only a detached process (`setsid nohup … &`) outlives those limits
  and the session. Never run a server (`pnpm preview`, `pnpm dev`) as a foreground or background
  command; detach it, log to a file, and check that file.

## Boundaries and commits

- Do not read `.env`, `.nuxt/`, `.output/`, `node_modules/`, or `pnpm-lock.yaml`.
  Do not run `pkill` or `killall`. Repo-installed tools may use their normal generated/dependency files.
  Skill instructions and requested tooling are outside the backend-project restriction above.
- Preserve unrelated owner edits. Commit only when asked; review the diff first.
  Subject says why, blank line, short change bullets, then the owner's chosen footer:
  `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Compact instructions

Preserve the active goal, owner decisions/authorization, changed paths, checks and their outcomes,
unresolved blockers, and next step. Drop verbose tool output and abandoned approaches. Compaction
does not finish or reset the task; continue without repeating exploration, edits, or passing checks.

## Starting and restarting Job Hunt UI

- Owner preference (2026-10-23): "start Job Hunt UI" or "restart Job Hunt UI"
  means run `pnpm dev --host` in Ubuntu WSL at
  `/home/ola/development/job-hunt-assistant-ui-sept-2026`.
  "development/ui" refers to this directory.
- Explicit start/restart requests override the default no-dev-server rule above.
  Host permission requirements still apply.
- Inspect processes and confirm their working directory before stopping them.
  For restart, send TERM to the confirmed UI dev process group, then start it again.
  For start, reuse a matching running server or launch it if absent.
  Do not use `pkill` or `killall`.
- Ensure Node and pnpm are on PATH. Verified paths are
  `/home/ola/.nvm/versions/node/v24.21.0/bin` and `/home/ola/.local/share/pnpm`;
  use the current installed runtime if these change.
- Keep the server running after the command returns, for example with `nohup`,
  logging to `/tmp/job-hunt-ui-dev-host.log`. Check startup output and the listening
  socket; expect all interfaces on port 3000. Report the actual URLs.
