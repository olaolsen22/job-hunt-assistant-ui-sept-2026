# Proposal

## Why

The listing page (`/listings/[id]`), its edit page and the ad parser are confusing to use, even for the owner. The
job title and deadline sit halfway down the page, the toolbar is a row of same-colored buttons sharing a line with
Back on mobile, statuses are scattered across cards, explanations sit in headers, and "Analyze", "Paste from ad",
"Parse listing from ad" and "Mark analyzed" name overlapping things. The edit form has its own problems: optional
selects can't be cleared, the field order zigzags, and the skill/language rows wrap unpredictably on phones.

## What Changes

Findings from the owner's review and a `ui-ux-expert` pass. All fixes are UI-only.

**Listing page (`/listings/[id]`)**

- Toolbar: Back on its own row on mobile, actions below it. Edit is the only solid primary; "Analyze ad" and an
  icon-only "More" (⋮) menu are neutral subtle. Mark analyzed / Archive / Unarchive live in More. Mark analyzed keeps
  its confirm (it can't be undone in the UI).
- Header above the cards, built like the list card: title + favorite (larger tap target), one badge row (status,
  analyzed, archived, all the same size), muted icon rows for company, role and locations, the color-coded posted /
  deadline dates, and a "View ad" button.
- Archived listings show a notice with an Unarchive action.
- Details card (was "Job"): small muted labels, normal values, "Not stated" in muted text. Ad language sits next to
  language requirements. URL, locations and dates move to the header.
- Large screens: Details and Summary in the wide column, Skills beside them.
- Skills grouped into "Required" / "Nice to have"; languages say required / optional in text instead of solid vs
  subtle badges.
- Application card: no duplicate status badge; "Not applied yet" next to Apply on a saved listing; clearer company
  application count; "Add interview" becomes neutral like other secondary actions.
- Loading skeleton matches the new layout.

**Edit page (`/listings/[id]/edit`)**

- Same toolbar: Back to the listing, "Analyze ad" (neutral subtle). The saved title and company show as a heading.
- After analyzing the ad, a dismissible notice says the fields were filled from the ad, fields the ad didn't
  mention kept their saved values, nothing is saved yet, and saving marks the listing analyzed.
- Save keeps its "Save changes?" confirm modal.

**Edit / add form fields (`ListingsForm` and field components)**

- Field order follows the questions a job seeker asks: title, company, role, ad link; seniority + employment type;
  work mode + schedule; locations; language requirements + ad language; posted on + deadline.
- Optional selects (employment type, seniority, ad language, language level) can be cleared back to "Not stated".
- Deadline type and date share one field.
- Skill and language rows: two lines on phones (name + remove, then controls), one line with column headers from
  `sm` up. Skill level reads "Level 3" instead of a bare "3"; min. years has a proper label and no stepper buttons.
- The add-skill search moves below the rows, like Add language / Add location.
- Remove buttons and the summary field get accessible labels. Label and placeholder fixes: "Ad link", "City (blank =
  whole country)", "Any level".

**Ad parser modal (shared with `/listings/add`)**

- Header holds only the title "Analyze ad"; instructions move to the body.
- Methods become tabs: "From link" (saved listings only, with a note that it reads the saved link, not unsaved form
  changes), "Paste ad" (built-in parser), "Use your own AI" (numbered steps). The pasted ad is shared between tabs.
  The footer's main button follows the tab.
- A failed built-in parse shows the error in the tab and keeps the ad text.
- While parsing, the modal can't be closed and tabs are disabled, so the result isn't lost.
- The "URL isn't included" hint only shows on the add page.

**Naming**: "Analyze ad" for the action everywhere (listing, edit and add pages, modal title); "Mark analyzed" for the
flag only; "View ad" for the link (the list card's "View posting" is renamed to match).

## Capabilities

### New Capabilities

- `listing-page`: how a single listing is shown and edited — header, actions, details, edit page framing, form
  fields, and the analyze-ad modal.

### Modified Capabilities

None. `listing-creation`'s "Saved edits show on the listing page" still holds.

## Out of scope

- Backend changes (none needed).
- The listings list beyond the "View ad" label, quick-add (apart from adapting to the parse return shape),
  companies, dashboard.
- New form fields or validation rules.
- Timeline, interview, apply and outcome modal internals; interview row tap-target sizes.
- Sticky save bars, unsaved-changes warnings, delete-listing UI.

## Impact

- Pages: `listings/[id]/index.vue`, `listings/[id]/edit.vue`, `listings/add.vue`, `listings/quick-add.vue` (parse
  call only)
- Components: `ParseModal`, `Form`, `SkillsField`, `LanguagesField`, `LocationsField`, `Application`, `Interviews`
  (button color), `Dates` (detail branch removed), `FavoriteButton` (size prop), `Card` (label)
- Composable: `useParsePrompt.parse` return shape
- Tests: `ParseModal.test.ts`, `Dates.test.ts`, `SkillsField.test.ts`, new `ListingPage.test.ts`
- Docs: `docs/REUSABLES.md`, `docs/STATUS.md`, `.claude/state/ui-inventory.md`
