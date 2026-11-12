# Proposal

## Why

Making a CV template is disjointed. The New dialog splits into two paths that land on two different pages:

- "My profile" saves an unreviewed v1 at once.
- "AI draft" opens a separate page that asks for the name again.

There are more problems on the editor pages:

- "Draft with AI", the main way to get a good template, is buried in a settings card.
- CV style is picked twice.
- Alerts stack.
- Preview PDF is disabled while editing.
- An AI reply replaces the whole CV with no review.
- On the tailored CV page, a whole-CV reply shows all work experience as one plain-text block instead of per company.

## What Changes

- List: one full-width column of template rows at every width, where the 2-column grid used to be. "New CV template"
  opens the create page directly, with no dialog.
- Create (`/cv-templates/new`):
  - A Details card holds name, description and language.
  - Content starts empty, with two choices: Draft with my AI, or Start from my profile.
  - "Create template" saves v1. Nothing is created before that.
  - **BREAKING (UI):** the New dialog and its "My profile" instant save are removed.
- Editor (`/cv-templates/[id]`):
  - The header holds Versions (renamed from History), Preview PDF, and a ⋮ menu with Edit details, Archive and
    Delete.
  - "+ Add language" offers Translate or Draft with my AI.
  - One status banner replaces the stacked alerts.
  - Draft with AI and Replace with my profile sit at the top of the content.
  - A Layout card is the only place for CV style, entry format and PDF layout. The AI dialog shows the style
    read-only.
  - Preview PDF is never disabled. While there are edits, it reads "Preview last saved".
- AI replies become suggestions (template editor and tailored CV page):
  - Experience, education and projects are reviewed per entry (per company), with Accept and Dismiss on each card.
  - An entry the AI left out gets a removal suggestion, and Dismiss keeps it.
  - The whole list is a single suggestion only when the AI added entries or changed their order.
  - The template editor gets the pending-suggestions banner (count, Next, Accept all, Dismiss all with a confirm).
    Save is never blocked.
- Edit details becomes rename-only (name and description).

Out of scope:

- per-bullet accept
- undo after accept
- a two-column editor
- showing where a template was used (the API has no usage data)
- unsaved PDF previews (the API renders saved versions only)
- renaming "CV style" (it stays as is unless the owner asks)
- API changes

## Capabilities

### New Capabilities

- `cv-templates`: reusable CV templates (the API's base CVs). Covers the list, unsaved creation, the editor with
  languages and versions, AI drafts reviewed as suggestions, and archive or delete.

### Modified Capabilities

- `tailored-cv-drafts`: whole-CV AI replies are offered per entry (per company) instead of one suggestion per list.

## Impact

- Code:
  - `app/pages/cv-templates/{index,new,[id]}.vue`
  - `app/components/cvTemplates/*`: a new Editor, StatusBanner and NameFields. OptionsCard and AiDraftAlert are
    removed. DetailsModal becomes rename-only. AiDraftModal is updated.
  - `app/composables/useBaseCvs.ts`: `useNewBaseCv` is folded into `useBaseCvEditor`, which also gains suggestions.
  - `app/utils/tailoredCv.ts`: `changedCvSections` pairs entries, and `setCvSection` gains a removal case.
  - `app/components/cv/ContentEditor.vue`: a review-only AI mode.
- Tests:
  - `CvTemplatesList`, `CvTemplateNewPage`, `CvTemplatePage`, `tailoredCv`
  - `TailoredCvPage`, where the expectations assumed an "All experience" suggestion
- No API or schema changes, and no new packages.
- Overlap: `streamline-tailored-cv-flow` (complete, not archived) built the pending-suggestions banner that this change
  reuses. This change alters only how a whole-CV reply is split into suggestions. Archive that change first, or at
  least before archiving this one, so the `tailored-cv-drafts` delta applies to its synced requirements.
