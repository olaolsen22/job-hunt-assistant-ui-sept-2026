# Proposal

## Why

The owner asked that CV template screens not stack every card in one column on desktop, because that wastes most
of the width. `rework-cv-template-flow` went the other way: the list became one full-width column at every width,
and the create and editor pages are a single `max-w-3xl` column. This change puts the width to use from `lg`/`xl`
up and leaves phone and tablet unchanged.

## What Changes

- List (`/cv-templates`): a card grid with 1 column below `xl`, 2 from `xl`, and 3 from `2xl`. Cards in a row match
  heights. Empty and loading states span the full row.
- Create and editor pages: from `lg`, a main column plus a sticky side rail of 20rem (22rem from `xl`). The page
  cap is removed.
  - Main column: the status banner, the Draft with AI / Replace with my profile actions, then the content editor.
  - Rail: the Details card on create, and the Layout card (CV style, entry format, PDF layout) stacked in one
    column.
- Below `lg` the order stays as it is today. On create, the Details card stays first.
- The content editor's section cards stay one column. They are shared with the tailored CV page.

Out of scope: moving Save/Create, language tabs into the rail, columns inside the content editor, and the tailored
CV page.

## Capabilities

### New Capabilities

### Modified Capabilities

- `cv-templates`: the list uses a grid from `xl` instead of one column at every width. The create and editor pages
  get a desktop side rail.

## Impact

- Code: `app/pages/cv-templates/{index,new,[id]}.vue`, `app/components/cvTemplates/Editor.vue` (Layout card
  placement; exposing it to the page's rail through a slot or split).
- Tests: `CvTemplatesList`, `CvTemplatePage` and `CvTemplateNewPage` keep passing. jsdom has no layout, so no new
  layout tests.
- Depends on `rework-cv-template-flow` (complete, uncommitted, not archived). Archive that change first, so this
  delta applies to its "Template list" wording.
- No API changes and no new packages.
