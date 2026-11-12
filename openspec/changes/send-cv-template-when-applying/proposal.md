# Proposal

## Why

Sending a saved CV template instead of a tailored CV mostly works already: the Record application
dialog's CV picker lists active templates, previews a version, and turns it into a document on
submit before `applyToListing`. What's missing is a sensible default and a clear record. The picker
doesn't start in the listing's posting language, and the document list says "CV template: Frontend
v3" without the language, so EN and NO versions of a template look the same.

## What Changes

- CV picker in `ListingsApplyModal`: the user picks a template first, then its language and
  version, instead of choosing from one combined "Template · Language" list. The language defaults
  to the listing's `postingLanguage` when the template has a version in it. Otherwise it defaults
  to the language of the template's newest version, which matches `latestVersion(language:)` falling
  back to `latestVersion`. The language select shows only when the template has more than one
  language.
- Listing documents also fetch `baseCvVersion.language`. The origin label reads
  "CV template: Frontend · EN v3". Archived templates still show, because the label comes from the
  document rather than the active list.
- These keep working as they do now: active-only `baseCvs(archived: false)`, the inline preview
  (`GET /api/base-cv-versions/{id}/pdf`, stores nothing), `generateBaseCvDocument` only on submit
  and once per version across retries, `applyToListing` with the returned `document.id`, and the
  listing refresh afterwards. The tailored draft is never read or written by this path.
- No API change. `pnpm gql:gen` is needed only if the schema has moved since the last run.

Out of scope: a separate "Use a CV template" entry point outside the apply dialog, editing a
template for one listing (that is still the tailored editor), and showing archived templates in
the picker.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `application-tracking`: recording an application with a CV template version, and the language in
  the template origin label on listing documents.

## Impact

- `app/components/listings/DocumentPicker.vue` (template → language → version, default language),
  `app/components/listings/ApplyModal.vue` (passes the posting language)
- `app/composables/useListing.ts` (`baseCvVersion.language`), `app/utils/documents.ts` (label)
- Tests: `test/unit/ApplyModal.test.ts`, plus a label test next to existing document util tests
