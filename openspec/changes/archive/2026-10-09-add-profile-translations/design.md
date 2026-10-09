# Design

## Context

`useProfile.ts` holds one `PROFILE_FIELDS` fragment shared by the query and the full-replace mutations. All four entry types render bullets through `profile/Bullets.vue`; mutations end in `emit('changed')` and `profile.vue` refetches. `useMutation` toasts `errors[0].message` and calls `onStale` for any `*NotFoundError`. The picker data (`LANGUAGE_OPTIONS`, `Language`) is in `app/constants/listing.ts`. Schema (checked): `setProfileBulletTranslation` and `setProfileTranslation` also take `isMachine: Boolean! = false`; delete-bullet-translation takes the translation `id`.

## Goals / Non-Goals

**Goals:** edit translations inline with the existing patterns; one place (Bullets) covers all four entry types.
**Non-Goals:** auto-translate, text-diff library, patching local state (always refetch).

## Decisions

- **Page-level "Translate to X" toggle** (`translating` ref in `profile.vue`) instead of always-visible translations. Keeps the normal profile as scannable as today, especially on phones. In Vue 2 terms: a plain `data` flag passed down as a prop. Assumption, easy to flip later.
- **Query:** add `contentLanguage`, `translations` and bullet `translations { id language text sourceText isMachine isStale }` to `PROFILE_FIELDS`. `sourceText` is needed for the stale comparison. Check the profile query against the API's cost limit once (existing task 7.3 style check); if too heavy, split into a separate translations query.
- **Language control:** a `USelect` of `LANGUAGE_OPTIONS` in the header area, disabled when any translation exists (computed client-side from the fetched data), saved via `setProfileContentLanguage`; on success refetch (text may change language).
- **Bullet translation line:** new `profile/BulletTranslation.vue`, rendered by `Bullets.vue` when `translating`. Own `useMutation` per row, inline form (`UInput` + counter, `maxlength=500`), stable keys. Drag/edit/delete of the source are hidden while translating. Sends `isMachine: false` so manual edits clear the machine badge. Aria-labels name the bullet and language.
- **Headline/summary:** new `profile/TranslationModal.vue` (matches other Profile modals, good on phones), opened from the Summary section in translating mode. Prefilled from the current translation; always sends both fields. Delete via `AppConfirmModal`. Summary rendered with `AppMarkdownContent`.
- **Stale:** `UBadge color="warning"` "Stale" + a "Show changes" toggle revealing previous vs current original (stacked; two columns from `sm`). Machine: `UBadge color="neutral"` "Machine" only when true. The toggle shows a stale count so staleness is visible outside the mode.
- **Errors:** reuse `useMutation` (`errors { __typename ... on Error { message } }`); no client-side validation beyond `maxlength` and non-empty trim. `onStale` → refetch once (avoid the double `changed` emit).
- **Empty state:** a bullet without a translation shows a ghost "Add translation"; no translation row is normal, not an error.

## Risks / Trade-offs

- Payload and query cost grow with bullets × languages → only the fields listed; verify against the real API.
- Full refetch per save is slightly slow → acceptable for a hobby app.
- Open inline editor must not be reset by a refetch → stable `v-for` keys; disable source drag while editing.
- Fixtures (`emptyProfile`, `bullet()`) must gain the new fields or tests drift.
