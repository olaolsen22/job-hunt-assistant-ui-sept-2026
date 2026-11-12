# Tasks

Design is skipped: a small change inside two existing components with no new pattern.

## 1. Origin label with language

- [ ] 1.1 Add `language` to `documents.baseCvVersion` in `app/composables/useListing.ts`. Run
      `pnpm gql:gen` first and note any relevant `app/graphql-env.d.ts` diff. Verify: typecheck.
- [ ] 1.2 Change `documentOriginLabel` in `app/utils/documents.ts` to
      `CV template: <name> · <languageCode> v<number>` and keep the other origins as they are.
      Verify: a unit test for template, tailored, uploaded and missing-origin labels.

## 2. Template → language → version picker

- [ ] 2.1 In `app/components/listings/DocumentPicker.vue`, replace the combined template·language
      select with a template select (active templates with ≥1 version). Add a language select, shown
      only for templates with more than one language, and keep the version select and Preview.
      Add a `postingLanguage` prop for the default language (posting language if the template has a
      version in it, else the newest version's language) and preselect the newest version in that
      language. Keep the existing clearing between template, uploaded file and new upload.
      Verify: test 3.1.
- [ ] 2.2 Pass `listing.postingLanguage` from `app/components/listings/ApplyModal.vue`. Leave
      generate-once-on-submit, `applyToListing` and `changed` emit untouched.

## 3. Tests and checks

- [ ] 3.1 In `test/unit/ApplyModal.test.ts`, with mocked `BaseCvs` / `/graphql`, cover the
      posting-language default, the fallback to the newest version's language, a single-language
      template showing no language select, and that only `archived: false` is requested. Keep the
      existing generate-once test passing.
- [ ] 3.2 Run `pnpm vitest run test/unit/ApplyModal.test.ts` and the label test, then `pnpm lint`
      and `pnpm typecheck`.
- [ ] 3.3 Build and restart preview (`echo '{}' | .claude/hooks/preview.sh`). Screenshot the Record
      application dialog with a template chosen and the listing documents at 375 and 1440 widths
      with mock data, and report the UI verification status.
