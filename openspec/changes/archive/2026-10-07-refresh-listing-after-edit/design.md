# Design

## Context

Root cause (reproduced with a throwaway unit test, since removed): `useListing(id)` uses `useAsyncData('listing-<id>')`, and the detail page and the edit page share that key, so they share one cached `data` ref. When a second component asks for a key that another mounted component still holds, Nuxt reuses the existing data and does **not** fetch again. On save, the detail page mounts while the edit page is still mounted, so it gets the pre-edit data. Only after both unmount (a manual refresh) does the next mount fetch.

Vue 2 parallel: like two components reading the same Vuex state that nobody re-dispatched after a mutation; `useAsyncData` is a keyed cache, and the key outlives navigation while any consumer is mounted.

## Goals / Non-Goals

**Goals:**

- Detail page shows the saved values right after Save changes.

**Non-Goals:**

- Changing `useListing`, the key scheme, or Nuxt's cache behavior globally.
- Other mutations: the detail page already calls its own `refresh` after its actions.

## Decisions

- In `edit.vue`, after a save without errors, `await refreshNuxtData(`listing-${id}`)` before `navigateTo`. `refreshNuxtData` re-runs the handler of every `useAsyncData` with that key, including the edit page's own, so the shared data is fresh when the detail page mounts. Alternative `clearNuxtData`: makes the edit page flash "Listing not found" before navigation (its template shows that when there is no listing), so it was rejected.

## Risks / Trade-offs

- If the refetch itself fails, `refreshNuxtData` does not throw (the error lands on the shared `error` ref), so the save toast and navigation still happen and the detail page shows its error state. Acceptable for a hobby app.
- One extra request on save; the detail page would otherwise have fetched it anyway on a cold load.
