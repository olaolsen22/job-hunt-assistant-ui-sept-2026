# Design

## Context

`llm-model-selection` (all tasks done, uncommitted) added `useLlmModels` (shared `llm-models` key, `label()`,
`setDefault()`, `isUnknownModel()`), `AppLlmModelSelect`, the profile card/modal and a `model?` argument through the
AI composables. The owner rejected that placement. The API still has `llmModels`, `setDefaultLlmModel(model | null)`
and a per-call `model`; this change just stops using the per-call one.

## Decisions

- **Apply on top of `llm-model-selection`.** Its code and `useLlmModels` stay; this change removes the pieces above.
  Archive or commit that change first so the main specs contain the unknown-model and usage requirements this change
  relies on. The delta here is a new capability, so it needs no main spec to exist.
- **General page, one section.** `pages/settings.vue` renders a container with a heading and
  `SettingsAiModelSection` (an `AppCard` titled "AI model"). A new section later is another card; no tabs or
  settings framework now. Nav: `Settings` (`i-lucide-settings`) after Profile in both `items` and `userItems` in
  `layouts/default.vue`; `definePageMeta({ title: 'Settings' })` like the other pages.
- **Auto-save select.** One setting, so no Save button: `USelect` with items `[{ label: 'Use app default', value: null },
…models]` calling `setDefault(value)` on change. If `USelect` rejects `null`, map a sentinel string to `null`.
  On failure `setDefault` already toasts the typed error; the section resets the select to `defaultModel`. Success
  toast comes from the section (`useToast`). Loading shows `USkeleton`; a failed load shows a `UAlert`.
- **Drop the per-run argument.** Remove `model?` from `parse`, `parseFromUrl`, `parseNewUrl`, CV import `parse` and
  `analyzeAll` / `analyzeSection` / `runStep`, and the `$model` variable can stay optional in the documents (the
  server picks its own default) or be removed; remove it to keep documents minimal. Keep the unknown-model handling:
  show the message, `refresh()` models, stop `analyzeAll`. Quick add's batch call goes back to `parse(posting)`.
- **Notice.** `AiCostNotice` loses `model`; it reads `useLlmModels()` for the default label and renders
  `<ULink to="/settings">Change model</ULink>`. Usage lines stay as they are (they already count the default model).
- **Dashboard widget unchanged.** It keeps its model badge. Usage is not duplicated on Settings (assumption: the
  owner only asked for the model setting there; revisit if wanted).

## Risks / Trade-offs

- Without per-run picks, trying a stronger model for one run means changing the setting. Accepted per the owner's
  direction.
- The notice cannot name the app default model when none is saved (the API doesn't expose it); it says
  "the app default".
