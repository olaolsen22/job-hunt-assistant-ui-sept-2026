# Design

## Context

- Settings (`pages/settings.vue`, `AiModelSection.vue`) and `useLlmModels` come from the uncommitted
  `llm-settings-page` change. AI errors are read as `errors[0].message` in `useParsePrompt.run`,
  `useProfileCvImport.parse` and `useTailoredCvDraft.runStep`; `isUnknownModel` is the only typed check.
- `auth.user.role` (`'Owner' | 'Guest'`, `stores/auth.ts`) is the only role signal.
- Contract: `ProviderKeyStatus`, `LlmCallLimit`, `LlmModel.keySource/provider`, `AiSafetyError { code }`,
  `TailoredCvAnalysisResult.errorCode`, optional `requestId: UUID` on the AI inputs. The UI never calls
  `analyzeAllTailoredCv`; it runs sections one by one.
- UI layout follows ui-ux-expert advice (two separate cards, modals for secrets/limits, inline retry warning).

## Goals / Non-Goals

**Goals:** typed safety handling in the three AI composables, not in each component; keys/limits as small
read-first cards consistent with the profile page.

**Non-Goals:** client-side validation of key format or limits beyond "integer ≥ 0" (API owns rules); polling usage.

## Decisions

1. **`useAiRequest()` per action instance** holds the pending `requestId`, the last input fingerprint and the last
   safety code. `idFor(input)` returns the kept id only when the previous attempt ended without an API answer and
   `JSON.stringify(input)` is unchanged; otherwise `crypto.randomUUID()`. Any API answer clears the kept id.
   `needsConfirm` is true after `operation-interrupted` / `result-unavailable`; `confirmRetry()` clears it and forces
   a new id. Alternative: generate ids in components — rejected, the composables already own the request and errors.
2. **Safety errors via `... on AiSafetyError { code }`** in each AI document; a small `aiSafetyCode(errors)` helper
   next to `isUnknownModel`. Outcomes gain an optional `code` so `useCollectedJobProcessing` and the CV analysis loop
   can stop on any safety code (same pattern as the existing unknown-model stop).
3. **`AppAiRetryConfirm`** (warning `UAlert` with "Try again (may be charged)" in its actions) is used by ParseModal,
   quick add, add companies, CvImportModal and the tailored CV page; the normal run button is disabled while
   `needsConfirm`. `daily-limit-reached` renders the message plus a `ULink` to `/settings` in the same error spot.
4. **`useProviderKeys()`** loads `providerKeys` (`provider-keys`) and `llmCallLimits` (`llm-call-limits`) with
   `useAsyncData({ server: false })`, plus set/remove/limit mutations through `useMutation`-style handling that returns
   the typed error for the modal. Success patches the row and refreshes `llm-models` and `llm-call-limits`. Sections
   mount only for the Owner (`v-if` in `settings.vue`), so a Guest makes no request.
5. **Modals reuse `AppFormModal`**: key modal has one `UInput type="password" autocomplete="off"` held in local state
   reset on close; the limit modal has a `URadioGroup` (No limit / Pause / Daily) and `UInputNumber` (min 1). Remove
   uses `AppConfirmModal`, whose text warns that models on that key stop being available.
6. **Provider labels** come from a small map (`gemini` → Gemini, `openai` → OpenAI …) with the raw id as fallback.
7. **Notice key source**: `useLlmModels` also fetches `provider` and `keySource`; `AiCostNotice` switches wording on
   the default model's `keySource` (info color + `i-lucide-key-round` for USER). Remaining requests come from
   `llm-call-limits`, fetched only for the Owner.
8. **Spec overlap**: `llm-settings-page`'s "No UI SHALL depend on the user's role" is narrowed to the AI model
   section in that change's spec before either is archived; archive `llm-settings-page` first.

## Risks / Trade-offs

- [`crypto.randomUUID` needs a secure context] → same-origin https or localhost in all use; no fallback.
- [`providerKeys` may list providers the UI has no label for] → raw id fallback, rows come from the API.
- [Transport failure after the server started work] → reuse of the same id lets the API deduplicate; a fresh id only
  after explicit user confirmation.
- [Mutations' `code` strings may grow] → unknown codes show the API message with no special handling.

## Migration Plan

API-side only (`AddUserProviderKeys` migration, persisted Data Protection key ring, backups); nothing in the UI.
