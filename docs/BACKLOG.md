# Backlog

Known bugs, refactors and deferred features that are not part of the current branch. Remove an
item once it ships; feature status lives in `STATUS.md`.

## Bugs

- Lazy modals mounted with `v-if="xOpen"` (CV import, profile AI translation) unmount on close, so
  the closing animation is cut off.

## Refactoring (app-wide, own branch)

- One helper for the AI suggest/run boilerplate (busy flag, `attempt`, refresh models on an unknown
  model, map the first payload error, catch). Repeated in useParsePrompt, useCoverLetterDraft,
  useTailoredCvDraft, useProfileCvImport, useSkillCleanup, useSkillWording, useProfileSummary and
  useProfileTranslationAi.
- Fold the AI modal setup into `useAiModalState`: `useLlmUsage(false)` + `usage` computed (9 places)
  and `retryConfirmed` (6 modals).
- One `genericError(e)` for `${ERROR_MESSAGES.generic} (${errorDetail(e)})` (9 places).
- Use `useAiModalState` in the CV import modal.

## Features / UX

- Discard prompt on Cancel when an entry form has unsaved bullet drafts.
- Retry-confirm checkbox; revisit the "Use reply" label.
- Group review rows in the CV import review.
- Bulk "set category" for ticked skills on the skills page.
- Profile translation mode: move to the next untranslated bullet after saving one.
- Bulk manual translation: the API now has `applyProfileTranslation`, so this is no longer blocked.
