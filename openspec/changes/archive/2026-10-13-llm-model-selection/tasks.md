# Tasks

## 1. Shared models source and picker

- [x] 1.0 Run `pnpm gql:gen` to regenerate `app/graphql-env.d.ts` from the current schema; verify it now contains `llmModels`, `setDefaultLlmModel`, `UnknownLlmModelError` and `UsageToday.model`
- [x] 1.1 Add `app/composables/useLlmModels.ts` (shared `llm-models` key, `label()`, `setDefault()` writing the returned `llmModels` and refreshing `dashboard-llm-usage`, `isUnknownModel()`); verify with a new `test/unit/useLlmModels.test.ts` covering save, null reset, and unknown-model refresh
- [x] 1.2 Add `app/components/app/LlmModelSelect.vue` (labelled USelect, hidden while loading, for one model, or on fetch failure; follows the default when it changes); verify in a small test that one model renders nothing and several list their labels

## 2. Per-action model

- [x] 2.1 Thread `model?` through `useParsePrompt` (three documents, one shared result helper) and use the picker in `ParseModal.vue`, `pages/listings/quick-add.vue` (single parse and collected-job batches, reading the pick per batch) and `pages/companies/add.vue`, resetting on open/mount and on default change, and handling unknown model; verify by updating `ParseModal.test.ts` / `QuickAdd.test.ts` (no model by default, picked id sent, unknown model shows message and resets, batch Retry after unknown model sends no model)
- [x] 2.2 Thread `model?` through `useProfileCvImport.parse` and `CvImportModal.vue`; verify in `ProfileCvImportModal.test.ts` that a picked model is sent and an unknown-model error shows inline
- [x] 2.3 Thread `model?` through `useTailoredCvDraft` (`analyzeAll`, `analyzeSection`, `runStep`), put the picker in `TailoredCvAiModal.vue` and pass the pick via its `analyze` emit to `pages/listings/[id]/cv.vue`; stop `analyzeAll` after an `UnknownLlmModelError` and refresh models; verify in `useTailoredCvDraft.test.ts` / `TailoredCvPage.test.ts` that every section request carries the picked id, an unknown model stops the run after one request, and the pick resets on reopen

## 3. Usage and default setting

- [x] 3.1 Add `model` to `useLlmUsage`, show the label badge in `DashboardLlmUsage` (drop "Counts all users of the API"), and add the `model` prop and differing-model line to `AppAiCostNotice`; verify in `LlmUsage.test.ts` and a notice assertion in `ParseModal.test.ts`
- [x] 3.2 Add `ProfileLlmModelCard` + `ProfileLlmModelModal` to the profile page's right column (hidden for one model; Save and "Use app default"); verify in a profile test that saving sends the id, reset sends null, and the section shows the returned label
- [x] 3.3 Update `.claude/state/ui-inventory.md` and `docs/REUSABLES.md` with `useLlmModels`, `AppLlmModelSelect` and the `AiCostNotice` `model` prop; verify the references match the files

## 4. Checks

- [x] 4.1 Run `pnpm test` (shared composables changed), `pnpm lint` and `pnpm typecheck`, then `pnpm build` and start `pnpm preview` in the background; report its URL and that the UI wasn't checked visually unless authorized
