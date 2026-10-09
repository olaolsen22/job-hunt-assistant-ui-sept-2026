# Tasks

## 1. Data

- [x] 1.1 Add `contentLanguage`, `translations` and bullet `translations` to `PROFILE_FIELDS` in `useProfile.ts`; run `pnpm gql:gen` and `pnpm typecheck` (passes, generated file committed if changed)
- [x] 1.2 Update `ProfilePage.test.ts` fixtures (`emptyProfile`, `bullet()`) with the new fields; existing profile tests still pass

## 2. Bullet translations

- [x] 2.1 `profile/BulletTranslation.vue`: show/add/edit/delete a bullet translation, stale + machine badges, "Show changes"; wired into `Bullets.vue` behind `translating`; test: add sends `{ bulletId, language, text, isMachine: false }`, stale/machine badges only when flagged
- [x] 2.2 Test: `InvalidProfileError` toasts the message and keeps the draft; `ProfileEntryNotFoundError` triggers one refetch

## 3. Language and profile translation

- [x] 3.1 Header: "Translate to X" toggle (with stale count) and content-language select in `profile.vue`, disabled with the API hint when any translation exists; test: disabled/enabled and save refetches
- [x] 3.2 `profile/TranslationModal.vue` for headline + summary (both fields always sent, limits 200/10k, per-field stale badge, delete with confirm); test: editing one field sends both

## 4. Wrap up

- [x] 4.1 Update `.claude/state/ui-inventory.md` and `docs/REUSABLES.md` with the new components
- [x] 4.2 `pnpm typecheck`, `pnpm lint`, `pnpm test`; `pnpm build` + `pnpm preview --port 3000`
- [x] 4.3 Ask the owner for a live check (phone + desktop), then `/log-progress`
