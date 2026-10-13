# Proposal

## Why

The `llm-model-selection` change (built, not yet committed) puts the default model in a profile-page card and adds
a "Model" select before every built-in AI run. That scatters one account setting across six places. A general
Settings page is the right home; for now it only holds the AI model.

## What Changes

- New `/settings` page, linked as "Settings" in the sidebar and the user menu. It is a general page made of titled
  sections; its first and only section is "AI model" (pick the default model, or use the app default).
- The model is picked once there and saved on change (toast on success). All built-in AI actions use that saved
  default; they never send a per-run `model`.
- **Removed:** the profile page's AI model card and modal, `AppLlmModelSelect` and its use in the Analyze ad modal,
  quick add, add companies, CV import and the tailored CV AI modal, and the `model` argument threaded through the
  parse, CV import and tailored CV composables.
- `AiCostNotice` drops its `model` prop and "this run uses…" line; it names the default model and links to
  Settings to change it.
- `UnknownLlmModelError` (the saved default was removed server-side) still shows its message where the action
  shows errors and re-fetches the models; the Settings page then shows the new default.
- Out of scope: other settings, per-run model choice, per-model usage, any API change.

## Capabilities

### New Capabilities

- `app-settings`: the Settings page, its navigation entry and the AI model section.

### Modified Capabilities

None in `openspec/specs/`. This change replaces the profile-card, per-action-picker and unknown-model-reset
requirements of the unarchived `llm-model-selection` change; archive that change first or fold it in (see design).

## Impact

- New: `app/pages/settings.vue`, `app/components/settings/AiModelSection.vue`.
- Deleted: `app/components/profile/LlmModelCard.vue`, `LlmModelModal.vue`, `app/components/app/LlmModelSelect.vue`
  and `test/unit/LlmModelSelect.test.ts`.
- Changed: `app/layouts/default.vue`, `pages/profile.vue`, `useParsePrompt.ts`, `useProfileCvImport.ts`,
  `useTailoredCvDraft.ts`, `useLlmModels.ts`, `ParseModal.vue`, `pages/listings/quick-add.vue`,
  `pages/companies/add.vue`, `CvImportModal.vue`, `TailoredCvAiModal.vue`, `pages/listings/[id]/cv.vue`,
  `AiCostNotice.vue`, docs/inventory, and the tests for these.
