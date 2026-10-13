# Tasks

## 1. Safety plumbing

- [x] 1.1 Add `useAiRequest()` (request id, input fingerprint, safety code, `needsConfirm`, `confirmRetry`) and an
      `aiSafetyCode(errors)` helper; verify with `test/unit/useAiRequest.test.ts` (new id per action, same id only after
      a transport failure with unchanged input, confirm codes set `needsConfirm`)
- [x] 1.2 Add `AppAiRetryConfirm` (warning alert, "Try again (may be charged)" action) and `AppAiLimitLink` (daily-limit
      Settings link); verify by a mount test that the action emits (the link's `/settings` target is checked in 2.1)

## 2. AI actions

- [x] 2.1 `useParsePrompt`: send `requestId`, select `... on AiSafetyError { code }`, return `code` in the outcome; wire
      ParseModal, quick add and add companies to show the safety message, the retry confirm and the disabled run
      button; verify in `ParseModal.test.ts`, `QuickAdd.test.ts`, `CompaniesAdd.test.ts` (requestId sent, reused after
      a network error, confirm required after `operation-interrupted`)
- [x] 2.2 `useCollectedJobProcessing`: keep the safety code of a failed batch (the run already pauses on any error and
      sends no further batch on its own); verify in `QuickAdd.test.ts` that no further batch is sent after
      `daily-limit-reached` and that an interrupted batch needs the retry confirm
- [x] 2.3 `useProfileCvImport` + `CvImportModal`: same request id and safety handling; verify in
      `ProfileCvImportModal.test.ts`
- [x] 2.4 `useTailoredCvDraft` + cv page: `requestId` per section request, fetch `errorCode` and show it with the
      message for FAILED/SKIPPED, stop whole-CV analysis on any `AiSafetyError`, retry confirm on the page; verify in
      `useTailoredCvDraft.test.ts` / `TailoredCvPage.test.ts` (skipped section shows code, earlier suggestions kept,
      no request after a safety error)

## 3. Provider keys and limits on Settings

- [x] 3.1 Add `useProviderKeys()` (keys and limits queries, set/remove key, set limit, refresh of `llm-models` and
      `llm-call-limits` on success) and the provider label map; extend `test/fixtures/llmModels.ts` with
      `provider`/`keySource`; verify with `test/unit/useProviderKeys.test.ts`
- [x] 3.2 Add `SettingsProviderKeysSection` with the key modal (password field cleared on close, inline
      `ProviderKeyError`) and remove confirm; verify in `SettingsPage.test.ts` (set, invalid key, remove)
- [x] 3.3 Add `SettingsDailyLimitsSection` with the limit modal (No limit / Pause / Daily number), empty state and
      shared-Gemini note; verify in `SettingsPage.test.ts` (set 50, pause → `0`, row texts)
- [x] 3.4 Show both sections only for the Owner in `pages/settings.vue`; verify a Guest test sees only AI model and
      no keys/limits requests are made
- [x] 3.5 Fetch `provider`/`keySource` in `useLlmModels`, mark own-key models in `AiModelSection`, and switch
      `AiCostNotice` wording on the default model's key source with remaining requests; verify in
      `SettingsPage.test.ts` and an `AiCostNotice`/`LlmUsage` test for both wordings

## 4. Docs and checks

- [x] 4.1 Narrow the "No UI SHALL depend on the user's role" line in `llm-settings-page`'s spec to the AI model
      section; verify `openspec validate llm-settings-page` and `openspec validate ai-provider-keys-and-safeguards`
- [x] 4.2 Update `docs/REUSABLES.md` and `.claude/state/ui-inventory.md` for `AppAiRetryConfirm`, `useAiRequest` and
      `useProviderKeys`; verify the references match the exports
- [x] 4.3 Run the changed unit tests, `pnpm test` (shared composables changed), `pnpm lint` and `pnpm typecheck`;
      report E2E/live UI as not run, then use `log-progress` for `docs/STATUS.md`
