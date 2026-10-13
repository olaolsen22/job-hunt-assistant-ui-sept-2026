# Proposal

## Why

The API now offers several LLM models per account, a saved default, and a per-call `model` on every built-in AI
mutation. The UI always uses the server's choice and its usage numbers no longer say which model they count, so the
owner (and guests) can't pick a cheaper or stronger model or read the quota correctly.

## What Changes

- Load `llmModels` once and share it; every picker below shows only when the account has more than one model.
- Profile page: new read-first "AI model" section showing the current default, with an Edit modal that saves it via
  `setDefaultLlmModel` (or resets it to the app default with `null`), then refreshes models and usage.
- Built-in AI actions get a "Model" select by their run button, preset to the default and reset on each open:
  the Analyze ad modal (From link / Paste ad), quick add (including collected-job batches), add companies, the profile CV import modal and the tailored
  CV AI modal. A pick other than the default is sent as `model`; the default is sent as nothing.
- `UnknownLlmModelError` from any of these shows its message in the existing error spot, re-fetches the models and
  resets the picker to the (new) default. Whole-CV analysis stops instead of sending the remaining sections.
- Usage: the dashboard widget and the AI cost notice show the default model's label next to the request count; the
  notice says when the picked model differs from the one the numbers count. The widget drops "Counts all users of
  the API".
- Out of scope: showing `ParseJob.model`, remembering a per-action pick, role-based UI, any API change.

## Capabilities

### New Capabilities

- `llm-model-selection`: listing the available models, saving the default, choosing a model per built-in AI action,
  and handling an unknown model.

### Modified Capabilities

- `dashboard-overview`: the LLM usage widget shows the model its numbers are for and no longer claims to count all
  users.

## Impact

- New: `app/composables/useLlmModels.ts`, `app/components/app/LlmModelSelect.vue`, a profile AI model section.
- Changed: `useParsePrompt.ts`, `useProfileCvImport.ts`, `useTailoredCvDraft.ts` (optional `model`, unknown-model
  handling), `ParseModal.vue`, `pages/listings/quick-add.vue`, `pages/companies/add.vue`, `CvImportModal.vue`,
  `TailoredCvAiModal.vue`, `pages/listings/[id]/cv.vue`, `pages/profile.vue`, `useLlmUsage.ts`, `LlmUsage.vue`,
  `AiCostNotice.vue`, and their unit tests. `app/graphql-env.d.ts` is already regenerated (`pnpm gql:gen`) and
  needs committing with this change.

## Superseded

The profile card, per-action pickers and unknown-model reset above were replaced by `llm-settings-page` before archiving.
Only the dashboard-overview change was synced to main specs; its `llm-model-selection` delta was not (the
requirements live in `app-settings`).
