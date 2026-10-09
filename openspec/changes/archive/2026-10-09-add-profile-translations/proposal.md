# Proposal

## Why

The profile now has a content language and the API stores translations of it (profile headline/summary and every bullet). The `/profile` page can't show or edit any of that yet, so the owner can't produce a profile in the second language.

## What Changes

- Show the profile's content language in the header; let it be changed only while no translation exists.
- A "Translations" mode on `/profile`: each bullet (experience, education, certification, project) gets an inline translation line with add / edit / delete.
- Headline + summary translation block (edited and saved together) with delete.
- "Stale" badge (with previous original shown next to the current one) and "machine" badge (only when `isMachine`).
- Extend the profile query with `contentLanguage` and the translation fields.

## Capabilities

### New Capabilities

- `profile-translations`: choosing the content language and managing translations of profile headline, summary and bullets in the other language.

### Modified Capabilities

<!-- None: no existing profile spec (profile-page is not archived yet). -->

## Impact

- `app/composables/useProfile.ts` (query fragment), `app/pages/profile.vue`, `app/components/profile/Bullets.vue`, new small components for the bullet translation line, the headline/summary translation and the language control.
- `test/unit/ProfilePage.test.ts` fixtures and new tests; `app/graphql-env.d.ts` unchanged (schema already has the fields) unless `pnpm gql:gen` shows a diff.
- No API changes.

**Out of scope:** auto-translate (only the `machine` badge for existing rows), translating titles, degrees, entry names, references and hobbies, a third language, a text-diff library, i18n of the UI itself.
