# Tasks

## 1. Settings page

- [x] 1.1 Add `app/pages/settings.vue` and `app/components/settings/AiModelSection.vue` (auto-saving select with "Use app default", toast, skeleton, error alert, disabled for one model) and the Settings link in `app/layouts/default.vue` sidebar and user menu; verify with a new `test/unit/SettingsPage.test.ts` (picked id sent, app default sends null, save error restores the previous value and shows the message, load failure shows an error)

## 2. Remove per-action and profile UI

- [x] 2.1 Delete `ProfileLlmModelCard`, `ProfileLlmModelModal`, `AppLlmModelSelect` and `LlmModelSelect.test.ts`; remove the card from `pages/profile.vue` and the pickers from `ParseModal.vue`, `quick-add.vue`, `companies/add.vue`, `CvImportModal.vue`, `TailoredCvAiModal.vue`; verify `ProfilePage.test.ts` no longer expects the section
- [x] 2.2 Remove the `model?` argument from `useParsePrompt`, `useProfileCvImport`, `useTailoredCvDraft` and the `analyze` emit payload / `cv.vue` wiring, keeping the unknown-model message, models refresh and `analyzeAll` stop; verify in the existing composable and page tests that requests carry no model and an unknown model still shows its message, stops the whole-CV run and refreshes models

## 3. Notice, docs, checks

- [x] 3.1 Update `AiCostNotice` (drop `model`, name the default or "the app default", link to `/settings`) and its callers; verify the link and label in `ParseModal.test.ts`
- [x] 3.2 Update `.claude/state/ui-inventory.md` and `docs/REUSABLES.md` (remove `AppLlmModelSelect`, change `AiCostNotice`), then run `docs/STATUS.md` via `log-progress`; verify references match the files
- [x] 3.3 Run `pnpm test`, `pnpm lint` and `pnpm typecheck`, then `pnpm build` and start `pnpm preview` in the background; report its URL and that the UI wasn't checked visually unless authorized
