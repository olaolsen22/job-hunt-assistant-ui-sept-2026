## Context

`SkillWordingModal` + `useSkillWording` + `useTextRewriteReview` already implement the same flow
(built-in/own AI tabs, review rows, one-call apply). Two differences: scope arguments, and the own-AI
reply is checked by the API (`previewProfileBulletRefinement`), not parsed locally.

## Goals / Non-Goals

- Goals: reuse the AI modal parts and the review composable; keep the new code to one composable and one modal.
- Non-Goals: extracting a shared review modal (a third copy is tolerable), a per-bullet entry point
  (bullets are read-only on cards; the entry form is a modal in a modal), fact-checking.

## Decisions

- **New modal, not a scope prop on SkillWordingModal.** Its rows are headline/summary and it parses locally;
  the data differs, not only the scope. Mirror its structure and test ids (`refine-*`).
- **`useBulletRefinement(scope)`** (scope = `{}` | `{bulletId}` | `{kind, entryId}`) holds the prompt query,
  refine/preview/apply documents, and `suggest`, `preview(json)`, `apply`. Scope is passed as arguments, so the
  API never gets a mixed scope.
- **Rows:** reuse `useTextRewriteReview`; add optional `note` to `RewriteRow`. A null-text row uses the
  current text, `include: false`; "applicable" = ticked and text differs from current. Rows whose bullet id is
  not on the profile start unticked and disabled, as in skill wording.
- **Entry points:** `RowActions` gets an optional extra menu item (emit `refine`); `Entry` shows it when it has
  bullets and opens the modal lazily (`useOpenedOnce`, as `SkillList` does). The whole-profile action goes in
  the profile header next to Import CV. UX advisor suggested a section menu, but whole-profile covers all
  sections, so the header fits better. The ⋮ menu keeps rows uncluttered.
- **Layout:** wide modal; current and suggestion stack on small screens (as `AppAiReviewRow` already does).
- After apply: `emit('changed')` (parent `refresh()`), toast via `useAppToast`.

## Risks / Trade-offs

- Apply does not fact-check: the modal says the AI only sees the profile and suggestions need real facts.
- Translations of changed bullets go stale: notice only; the existing translation flow handles re-translation.
