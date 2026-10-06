# Job Hunt Assistant UI

Hobby Nuxt 4 frontend (Nuxt UI v4, Tailwind 4, Pinia) for the Job Hunt Assistant .NET API.
REST for auth (HttpOnly cookie session) and health, GraphQL for domain data, GraphQL subscriptions
over SSE for LLM parse-job updates.

## Communication and scope

- Short, natural answers. Lead with the result, then only useful details. Code over prose; show changed
  snippets, not whole files.
- No lengthy plans, repeated summaries, formal review pipelines, agent teams, speculative abstractions,
  or production hardening.
- Follow standard frontend practice and the existing stack. Change only what the request needs.
- The owner is a senior Vue 2 engineer, new to Vue 3 / Nuxt 4. When a Vue 3 / Nuxt 4 concept first comes
  up, explain why it works that way in 1–2 lines, with the Vue 2 equivalent if one exists.

## Session start

1. Read `.claude/state/work-log.md` and reconcile it with `git status`, `git log -5`, and the actual code.
2. Use `.claude/state/ui-inventory.md` as the reuse index (verify an entry before relying on it).
   `docs/STATUS.md` (what exists) and `docs/REUSABLES.md` (prop details) are the tracked references.

Do the same after context loss.

## Commands

- Dev: `pnpm dev` (the owner runs it; don't start or stop it)
- Lint / format: `pnpm lint`, `pnpm format:check`
- Typecheck: `pnpm typecheck`
- Unit/integration: `pnpm test` (vitest only, `test/unit`). One file: `pnpm vitest run test/unit/<Name>.test.ts`
- E2E: `pnpm test:e2e` (Playwright). Owner only, see Tests.
- GraphQL types: `pnpm gql:gen` after the schema changes (regenerates `app/graphql-env.d.ts`; commit it)
- Always, once all changes are finished: `pnpm build` then `pnpm preview --port 3000`. If a stale preview
  server holds port 3000, kill it first (check with `lsof -i :3000`) and start the new one. Leave `pnpm dev` alone.

## Reuse and agents

- Before substantial UI work, use the `ui-controller` agent to find existing components, composables,
  utils, types, styles, and API helpers. For tiny edits, check the inventory/Grep yourself.
- Reuse or extend existing code before creating an equivalent. New abstractions need 2+ real uses.
- `ui-ux-expert` for design input on a new screen, flow, or layout change, within the existing visual language.
- `ui-reviewer` is optional, for meaningful changes only.
- Agents advise; the main agent implements and owns the state files. No other subagents unless asked.

## Persistent notes (`.claude/state/`, local only via `.git/info/exclude`)

`work-log.md` holds pending work only: reason (from the owner's prompt), actual changes, affected files,
checks run, remaining work, relevant decisions, and a draft commit message.

- Update it before editing, after meaningful progress, and before ending a session.
- After a verified successful commit (`git log -1` shows it), clear only the notes that commit covers.
  Keep unfinished work and lasting owner decisions. Replace the receipt with the new hash + exact message.
- A failed commit clears nothing. If the owner committed manually, reconcile against `git log` first.

`ui-inventory.md` lists verified paths, exports, and one-line purposes for reusable components,
composables, utils, types, styles, and API helpers, plus test commands and shared conventions.
Update it when relevant code changes. Skip private helpers.

## Backend contract

The API is a fixed contract. Adapt the UI to it.

- `../job-hunt-assistant-api-sept-2026/schema.graphql` is the full source of truth for queries, mutations,
  types, and errors. gql.tada reads it from there; don't copy it into this repo, so it stays current. REST endpoints: `../job-hunt-assistant-api-sept-2026/docs/STATUS.md`.
  These two are the only files outside this repo you may read; read only the parts you need. Never edit
  the API repo or assume changes to it.
- Treat the schema as sufficient. Never invent fields, arguments, or types. Before concluding something
  is unsupported, reread and search the schema.
- If the UI needs something the schema doesn't give directly, solve it client-side (filter, sort, derive,
  combine queries, extra requests). Only if that is clearly worse (real N+1, missing data, security),
  ship the best workaround, then optionally add one short "Backend suggestion": what, why, what the
  workaround costs. Never block on it, repeat it, or re-argue it after the owner decides.
- Validation, duplicate rules, and permissions belong to the API. Display returned errors; don't
  reimplement those rules.

## Conventions

- Nuxt 4 layout: app code under `app/`. Components auto-import by path:
  `components/<feature>/<Name>.vue` → `<FeatureName>`.
- Nuxt UI components (`U*`) first, then Tailwind utilities. SCSS (`assets/scss/`) only for what utilities
  can't express. Theme via `app.config.ts` and `--ui-*` tokens in `assets/css/main.css`. Icons: `i-lucide-*`.
- Built-ins by default: props/slots, Tailwind's default scale, Nuxt UI token classes. Arbitrary values,
  `!important`, `:ui` overrides, and custom CSS only when nothing built-in works, with a comment saying why.
- All backend calls go through the same-origin proxy (`/api/**`, `/graphql`), never the API URL directly.
  REST only for auth and health, GraphQL for domain data.
- GraphQL documents are literal ``graphql(`...`)`` strings (gql.tada), sent with `gql(doc, vars)`. No `${}`
  interpolation. Derive types with `ResultOf`; never hand-write API shapes.
- Pinia only for state shared across pages.
- Handle loading, empty, and error states where data loads.
- Fetch only needed fields, avoid request waterfalls, paginate lists, lazy-load heavy components.
- Arrow functions (`const foo = () => {}`), not `function` declarations. Comments explain why.
- No defensive code for impossible cases; only catch errors you handle. Delete dead code.
- Use Nuxt / Nuxt UI built-ins before adding a package.
- No i18n or dedicated accessibility work beyond Nuxt UI defaults, but don't ship obvious a11y bugs
  (missing labels, non-button click targets).
- Prettier owns formatting; lint-staged runs ESLint + Prettier on commit. Secrets in `.env` only.

## Tests

- After code changes, run the relevant unit tests plus `pnpm lint` / `pnpm typecheck`. Avoid repeated
  full-suite runs without a reason.
- Never run E2E (`pnpm test:e2e`, Playwright, browser suites, or their setup) unless explicitly asked.
  `pnpm test` is vitest-only today; if that ever changes to include E2E, use a separate unit command or
  report that none exists.
- Add tests for changed behavior (`mountSuspended` + `registerEndpoint`), not tests that mirror the
  implementation. No snapshots. Select by `data-testid` or role.
- Report validation briefly and honestly, including "E2E not run".

## Commits

- Commit only when asked. Review the diff and leave out unrelated changes.
- Format: short natural subject saying why (from the owner's prompt), blank line, concise bullets of what
  changed. No long descriptions, inflated claims, or attribution footers.

```
Make saved jobs easier to scan

- Add status filters
- Reuse the existing job card
- Test filter behavior
```

## Working rules

- Targeted reads (Grep, then a line range). Never read `.nuxt/`, `.output/`, `node_modules/`, `pnpm-lock.yaml`.
- Stay inside this repo, apart from the two backend files above. Ask before touching anything else.
- If a live UI check is needed, ask first; otherwise say the UI is unverified.
- After a milestone or notable feature, run `/log-progress` to update `docs/STATUS.md`.
