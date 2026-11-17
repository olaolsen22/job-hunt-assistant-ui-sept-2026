---
name: unit-tests
description: How unit tests are written and run in this repo (Vitest + @nuxt/test-utils, mocked /graphql). Use when adding or updating tests for a page, component, composable or util, or when a test fails.
---

## Where and what

- One file per page/component/composable/util: `test/unit/<Name>.test.ts`, named after the thing
  under test (`ShortlistButton.test.ts`, `CompaniesList.test.ts`, `useAiRequest.test.ts`).
  Extend the existing file before creating a new one (`rg -l '<ComponentName>' test/unit`).
- Fixtures: `test/fixtures/*.ts`. Shared helpers: `test/unit/helpers/` (e.g. `apiInputContract.ts`
  checks runtime-built query arguments against the schema's input types).
- Test behaviour the owner would notice: what renders, what is sent to the API, what happens on an
  API error, empty and loading states. No snapshots, no testing Nuxt UI internals.
- Good models to copy: `ShortlistButton.test.ts` (mutation + error rollback),
  `CompaniesList.test.ts` (page, list, pagination), `AppFormModal.test.ts` (modal content).

## Two Vitest projects

`vitest.config.ts` runs pure tests (no Nuxt runtime) in `node` — only the files in its
`standaloneTests` list. Everything else runs in the `nuxt` environment. A new pure util test can
stay in the nuxt project; add it to `standaloneTests` only if it imports nothing Nuxt-specific.

## Nuxt test pattern

```ts
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CompaniesPage from '~/pages/companies/index.vue'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)

// Mounting at a route runs the global auth middleware, so /api/auth/me must answer.
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const respond = (data: unknown, calls: unknown[] = []) =>
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      calls.push({ query, variables })
      return { data }
    }
  })
```

- Mount with `await mountSuspended(Component, { props })`; pages mount the same way.
- `registerEndpoint` replaces the previous handler for the same path. When one screen sends several
  operations, branch on `query` (e.g. `query.includes('mutation')` or a regex on the field name).
- Mutation payloads carry typed errors — test the failure path with
  `{ <entity>: null, errors: [{ __typename: 'ListingNotFoundError', message: '...' }] }`.
  `useMutation` toasts that message and refetches on `*NotFoundError`.
- Response shapes must match the real query: copy field names from the `graphql()` document in the
  component/composable, and check `../job-hunt-assistant-api-sept-2026/schema.graphql` (read only the
  relevant type) if unsure. Never invent fields.
- Select by role or `data-testid` (`wrapper.get('[data-testid="listing-shortlist"]')`). Add a
  `data-testid` to the component if there's no stable role or label.
- Async UI: `await vi.waitFor(() => expect(...))`, or `flushPromises()` from `@vue/test-utils`.
- Modals, slideovers, dropdowns and toasts teleport out of the wrapper: mount with
  `attachTo: document.body`, query `document.body`, and clear it in `afterEach`
  (`document.body.innerHTML = ''`). Nuxt UI components for slots: `import { UInput } from '#components'`.

## Running

- Only the files you touched: `pnpm vitest run test/unit/<Name>.test.ts [more files]`.
- Never `pnpm test` (whole suite) or `pnpm test:e2e` unless the owner asks. Say "E2E not run".
- Then `pnpm lint` and `pnpm typecheck` (typecheck covers test files too).
- A failing test: first decide whether the test or the code is wrong; never loosen an assertion
  just to go green. Report the failure output if it stays red.
