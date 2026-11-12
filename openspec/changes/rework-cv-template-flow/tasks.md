# Tasks

## 1. Prerequisites

- [x] 1.1 Run `pnpm gql:gen` and note any `app/graphql-env.d.ts` diff relevant to base CVs (none expected). Verify:
      the command succeeds and the diff is recorded in the work log.

## 2. Per-entry reply splitting (shared)

- [x] 2.1 In `app/utils/tailoredCv.ts`, make `changedCvSections` pair experiences, educations and projects by
      `sourceEntryId` and emit:
  - per-entry keys for changed entries
  - removal values for entries the reply left out
  - the whole list only when the reply adds entries or changes their order

  Add a removal case to `setCvSection`. Verify: `tailoredCv.test.ts` covers changed-in-place entries, a left-out
  entry, added entries and reordered entries.

- [x] 2.2 Make the tailored CV page render per-entry and removal suggestions, including a label for a removal.
      Update the `TailoredCvPage.test.ts` expectations that assumed "All experience". Verify: a page test where an
      external reply changes two experiences shows two experience-card suggestions.

## 3. Composable

- [x] 3.1 Fold `useNewBaseCv` into `useBaseCvEditor(id | 'new', language)`:
  - new mode starts with empty content, with Start from profile and AI draft as the ways to fill it
  - new mode's save calls `createBaseCv`
  - an empty (non-translated) new-language draft

  Verify: the existing CvTemplatePage and CvTemplateNewPage tests still pass after the call sites are updated.

- [x] 3.2 Add suggestions with offer, accept, dismiss, accept all and dismiss all to the template editor, mirroring
      `useTailoredCvDraft`. When there is no content to compare against, load the reply directly. Verify: covered by
      the page tests in 4.4.

## 4. Template components and pages

- [x] 4.1 Add `cvTemplates/NameFields.vue` for the name and description fields and the duplicate-name error with its
      link. Make `DetailsModal` rename-only. Verify: a `CvTemplatePage` test renames from Edit details, and a
      `CvTemplateNewPage` test shows the duplicate error on the field.
- [x] 4.2 Add `cvTemplates/Editor.vue`, holding:
  - the empty state with Draft with my AI and Start from my profile
  - Draft with AI and Replace with my profile actions at the top of the content
  - the Layout card
  - `CvContentEditor`, in review-only AI mode with no Analyze buttons
  - the status banner
  - the AI dialog
  - the save-bar frame
  - the leave confirmation, noting that suggestions are lost

  Remove `OptionsCard`. Verify: the page tests in 4.3 and 4.4.

- [x] 4.3 Rewrite `new.vue`: Details card plus Editor, with Create template opening the editor. Rewrite `[id].vue`:
  - header with Versions, Preview PDF (never disabled; "Preview last saved" while dirty) and the ⋮ menu (Edit details,
    Archive, Delete)
  - language tabs with "+ Add language" (Translate or Draft with my AI)
  - a post-save toast with Preview PDF
  - a one-line hint that templates are sent from a listing's Apply

  Verify: `CvTemplateNewPage.test.ts` covers empty state → profile → Create template and the no-dialog entry.
  `CvTemplatePage.test.ts` covers the Add language menu with AI draft and Preview enabled while dirty.

- [x] 4.4 Add `cvTemplates/StatusBanner.vue`, which shows one message (invalid content > suggestions > translation),
      with count, Next, Accept all and Dismiss all (with a confirm). Remove `AiDraftAlert`. In `AiDraftModal`:
  - remove the style radio and show the Layout card's style read-only
  - offer the reply as suggestions
  - keep the `rewrite` and Detailed-verbatim hint

  Verify: `CvTemplatePage.test.ts` covers:
  - a reply with two changed experiences, where accepting one changes only that one
  - a left-out entry kept on Dismiss
  - Save with pending suggestions
  - banner priority

- [x] 4.5 In `index.vue`: one-column rows (chips and date wrap below md) and New linking to `/cv-templates/new`.
      Verify: `CvTemplatesList.test.ts` checks the New link and that no create dialog exists.

## 5. Docs and integration checks

- [x] 5.1 Update `.claude/state/ui-inventory.md` for the cvTemplates components, `useBaseCvs` and `changedCvSections`.
      Verify: the entries match the new exports.
- [x] 5.2 Run `pnpm test`, `pnpm lint` and `pnpm typecheck`, and fix any failures. Then run
      `echo '{}' | .claude/hooks/preview.sh`. Verify: all pass, and the preview serves.
- [x] 5.3 Take after screenshots at 375, 768 and 1440 in light mode (guest account plus mocked templates) and run
      ui-reviewer on the diff and the before/after screenshots. Fix confirmed issues, then run `log-progress`.
      Verify: reviewer findings are fixed or reported, and `docs/STATUS.md` is updated.
