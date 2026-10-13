# Proposal

## Why

The API now lets the owner run AI on their own provider keys (Gemini, Anthropic, OpenAI, Mistral) with optional daily
call limits, and it guards every AI call with a `requestId`, one running operation per user and typed
`AiSafetyError` codes. The UI can't manage keys or limits yet, sends no `requestId`, and shows safety errors as plain
failures, so a lost or interrupted (possibly paid) run can be repeated without the owner noticing.

## What Changes

- `app/graphql-env.d.ts` is regenerated from the new schema (`pnpm gql:gen`, already run).
- Settings gets two Owner-only sections under "AI model": **Provider keys** (one row per provider with `last4` and
  dates; set/replace in a password-field modal, remove with a confirm) and **Daily limits** (per personal provider:
  no limit / paused / daily allowance, with consumed, remaining and reset time). Guests keep only "AI model".
- The model select marks models that run on the owner's own key; saving or removing a key refreshes models and limits.
- The paid-AI notice names who pays: the app's shared key (as now) or "your own <provider> key", with the remaining
  daily requests when a limit is set.
- All five AI mutations the UI uses (`parseListing`, `parseListingFromUrl`, `parseUrl`, `parseProfileCv`,
  `analyzeTailoredCvSection`) send a fresh `requestId` per user action; the same id is reused only when the user
  retries after a transport failure with unchanged input. Nothing retries automatically.
- `AiSafetyError` messages show where each action shows its errors. `daily-limit-reached` links to Settings.
  After `operation-interrupted` or `result-unavailable`, the next attempt needs an explicit "Try again (may be
  charged)" confirmation. Whole-CV analysis stops and collected-job batches pause on any `AiSafetyError`.
- Tailored CV analysis shows `errorCode` with the message for `FAILED` and `SKIPPED` sections; completed suggestions
  stay, and saving remains the existing explicit save.
- Out of scope: `analyzeAllTailoredCv` (unused by the UI), retired-key history (`includeRetired`), per-credential
  daily usage (`usageDaily`), deployment/key-ring backup (API side), any API change.

## Capabilities

### New Capabilities

- `ai-provider-keys`: managing personal provider keys and their daily call limits on the Settings page, and showing
  which key pays for a run.
- `ai-call-safeguards`: request ids on AI actions, handling `AiSafetyError` codes, and confirming a retry that may be
  charged again.

### Modified Capabilities

- `tailored-cv-drafts`: built-in analysis shows the error code of failed/skipped sections and stops on safety errors.

## Impact

- New: `app/components/settings/ProviderKeysSection.vue`, `DailyLimitsSection.vue`, their modals,
  `app/composables/useProviderKeys.ts`, `useAiRequest.ts` (request id + safety-error state),
  `app/components/app/AiRetryConfirm.vue`, unit tests.
- Changed: `pages/settings.vue`, `AiModelSection.vue`, `useLlmModels.ts`, `AiCostNotice.vue`, `useParsePrompt.ts`,
  `useProfileCvImport.ts`, `useTailoredCvDraft.ts`, `useCollectedJobProcessing.ts`, `ParseModal.vue`,
  `pages/listings/quick-add.vue`, `pages/companies/add.vue`, `CvImportModal.vue`, `TailoredCvAiModal.vue` /
  `pages/listings/[id]/cv.vue`, docs/inventory, related tests.
- Depends on the uncommitted `llm-settings-page` change (Settings page). Its "No UI SHALL depend on the user's role"
  line is narrowed to the AI model section.
