# user-profile Specification

## Purpose

Lets the user see and maintain their own profile: who they are, what work they want, and their
experience, education, certifications, projects, skills and languages. It is the base for matching
listings and writing applications later.

## Requirements

### Requirement: Profile page

`/profile` SHALL load the whole profile with one request and show it as a read-first CV. A header row SHALL show identity (name, headline) on the left and a primary action button plus an overflow menu on the right. A second row SHALL show contact details (email, phone, location) and links as compact inline items. The overflow menu SHALL hold Import CV, Refine bullets and Clear CV content. On mobile, only the primary action button (Edit details) SHALL have a visible label; other actions SHALL be in the overflow menu.

Below the header, a compact language indicator SHALL show the content language and a translate badge. Translate actions (Translate to [language], Translate with AI) SHALL move into the overflow menu or appear as an inline prompt when untranslated items exist.

The page SHALL use a two-column grid at lg and above (`lg:grid-cols-3`): the main column (`lg:col-span-2`) SHALL show Summary, Experience, Projects, Education, and References; the side column SHALL show Skills, Languages, Hobbies, Certifications, then Preferences last. Cards SHALL use `items-start` so short sidebar cards do not stretch to match tall main-column cards.

Below the two-column grid, a visually separated "Cover letter material" zone SHALL show Address, My story and Writing samples full-width.

At tablet width (md), sidebar cards SHALL render in a 2-column grid (`md:grid-cols-2`) after the main content. On mobile, Skills SHALL appear right after Experience for scannability, before the remaining sections stack single-column.

Cards SHALL NOT show inline edit inputs outside translation mode. The sidebar nav and user menu SHALL link to the page. While loading it SHALL show a skeleton, and a failed load SHALL show the generic error.

#### Scenario: Opening the profile

- **WHEN** the user clicks Profile in the sidebar
- **THEN** `/profile` shows every section filled from the profile

#### Scenario: Load fails

- **WHEN** the profile request fails
- **THEN** the page shows the generic error message instead of the sections

#### Scenario: Desktop layout

- **WHEN** the page is shown at lg width or wider
- **THEN** the main column shows Summary, Experience, Projects, Education and References, and the side column shows Skills, Languages, Hobbies, Certifications and Preferences, with cards aligned to top (not stretched)

#### Scenario: Mobile section order

- **WHEN** the page is shown on a phone-width screen
- **THEN** Skills appears immediately after Experience, before Projects and Education

#### Scenario: Tablet sidebar layout

- **WHEN** the page is shown at tablet width (md breakpoint)
- **THEN** sidebar cards render in a 2-column grid after the main content sections

#### Scenario: Cover letter zone

- **WHEN** Address, My story or Writing samples have content
- **THEN** they appear in a visually separated group below the two-column grid, labelled as cover letter material

#### Scenario: Header overflow menu

- **WHEN** the user opens the overflow menu in the header
- **THEN** it contains Import CV, Refine bullets, Clear CV content, and translate actions

#### Scenario: Read view

- **WHEN** the profile has experiences with bullets and translation mode is off
- **THEN** the Experience card shows each entry's bullets as plain text, with no drag handles, inputs or per-bullet buttons

#### Scenario: Preferences last

- **WHEN** the page is shown on a wide screen
- **THEN** Preferences is the last card in the side column, after Certifications

### Requirement: Empty sections

A section with no content SHALL show a compact empty row: a muted icon, a short message and an "Add …" action, all in one line (~80 px tall). The centered-icon pattern SHALL only be used for the page-level empty state.

When the profile has no content at all, a single onboarding card SHALL appear at the top with a primary Import CV action and a secondary "or add sections manually" link. Individual empty section cards SHALL still render below it.

Minor sections (Hobbies, Preferences, References, Writing samples) SHALL be hidden when empty and the profile is otherwise empty, consolidating behind an "Add more sections" row or menu at the bottom. Core sections (Summary, Experience, Education, Skills, Languages) SHALL always show their empty row.

#### Scenario: No experience yet

- **WHEN** the profile has no experiences
- **THEN** the Experience card shows a compact single-line empty row with "No experience yet" and an "Add experience" action

#### Scenario: Fully empty profile

- **WHEN** every profile field is empty
- **THEN** an onboarding card appears at the top with Import CV as the primary action, minor empty sections are hidden, and core sections show compact empty rows

#### Scenario: Minor section hidden when empty

- **WHEN** the profile has experience but no hobbies and no references
- **THEN** the Hobbies and References sections do not render; an "Add more sections" control appears

### Requirement: Mobile collapsible sections

On mobile only (below the md breakpoint), section cards SHALL be collapsible with a header toggle (chevron icon, `aria-expanded`). Summary and Experience SHALL default to open. All other sections SHALL default to collapsed, showing a count in the header ("Skills · 12", "Education · 2"). Tapping the header SHALL toggle the section open or closed. On desktop and tablet, all sections SHALL remain permanently open.

#### Scenario: Collapsed section on mobile

- **WHEN** the user views the profile on a phone-width screen
- **THEN** Skills shows "Skills · 12" in its header with a collapsed chevron, and tapping the header expands it to show the skill list

#### Scenario: Default open sections

- **WHEN** the user opens the profile on mobile
- **THEN** Summary and Experience are expanded, and other sections are collapsed

#### Scenario: Desktop always open

- **WHEN** the user views the profile at desktop width
- **THEN** no collapse toggles are shown and all section content is visible

### Requirement: Basics

The header SHALL show full name, headline, email, phone, location and links (opening in a new tab),
and the Summary card SHALL render the summary as Markdown. Three forms SHALL edit these fields:

- Details: name, headline, email, phone, location, date of birth, nationality, work authorization
  and up to 10 links, under group headings.
- Summary: the summary.
- Hobbies: the hobbies.

Each form SHALL send the whole profile. Fields the form doesn't show SHALL be sent with their current
values. The page SHALL show the returned profile without another request.

#### Scenario: Editing the headline

- **WHEN** the user changes the headline in the Details form and saves
- **THEN** the header shows the new headline and every other basic field keeps its value

#### Scenario: Editing the summary

- **WHEN** the user clicks Edit summary, changes the text and saves
- **THEN** only the Summary form was shown, the card shows the new summary, and the details and
  hobbies are unchanged

#### Scenario: Adding hobbies

- **WHEN** the user clicks Add hobbies on an empty Hobbies card, adds "Climbing" and saves
- **THEN** the Hobbies card shows Climbing and the summary and details are unchanged

#### Scenario: Link limit

- **WHEN** the Details form already has 10 links
- **THEN** "Add link" is disabled

#### Scenario: Blank rows are ignored

- **WHEN** the user adds a link row, leaves it empty and saves
- **THEN** the profile is saved without that link

#### Scenario: Changing the country

- **WHEN** the user changes the location's country
- **THEN** the city is cleared

#### Scenario: Clearing the location

- **WHEN** the user clears the country and saves
- **THEN** the profile is saved without a location

### Requirement: Preferences

The Preferences card SHALL show job roles, work modes, employment types, minimum salary with
currency, notice period in months and target locations, as read-only content. One Preferences form
SHALL edit them all. Job roles can be picked from existing ones or typed as new names. Saving SHALL
send every field except target locations, and the page SHALL show the returned profile without
another request.

#### Scenario: Adding a new job role

- **WHEN** the user types a job role that doesn't exist yet, adds it and saves
- **THEN** the role appears in the Preferences card

#### Scenario: Salary without currency

- **WHEN** the user enters a minimum salary with no currency and saves
- **THEN** the API's message is shown and the form stays open with the input kept

#### Scenario: Notice period range

- **WHEN** the user edits the notice period
- **THEN** only whole values from 0 to 12 can be entered

### Requirement: Target locations

The Preferences form SHALL list the user's target locations. The user SHALL be able to add one
(country plus optional city) and remove one there, each saved right away, independently of the
form's Save. The form SHALL say that these changes save immediately. Adding or removing one SHALL
also change its Preferred mark on company pages.

#### Scenario: Adding a target location

- **WHEN** the user adds Oslo, Norway as a target location in the Preferences form
- **THEN** it appears in the form's list and on the Preferences card

#### Scenario: Removing a target location

- **WHEN** the user removes a target location and confirms
- **THEN** it disappears from the form's list and the card

#### Scenario: Card is read-only

- **WHEN** the Preferences card is shown
- **THEN** it has no inputs for adding target locations

### Requirement: Profile entries

Experience, Education, Certifications and Projects SHALL each list their entries in the order the API
returns. The user SHALL be able to add, edit and delete one entry at a time. Each entry SHALL have
one actions menu with Edit and Delete. Delete asks for confirmation first. Editing SHALL open the
form filled with the entry, and saving SHALL send the whole entry. Saving an entry SHALL NOT change
its bullets.

#### Scenario: Adding an experience

- **WHEN** the user adds an experience with employer, title, start month and skills
- **THEN** it appears in the Experience list with its date range and skills

#### Scenario: Deleting a certification

- **WHEN** the user picks Delete in a certification's actions menu and confirms
- **THEN** it disappears from the Certifications list

#### Scenario: Entry deleted elsewhere

- **WHEN** the user saves or deletes an entry that no longer exists
- **THEN** the API's message is shown and the profile is reloaded

### Requirement: Entry fields

The Experience form SHALL edit employer, title, start month, end month or "current", and skills. The
Education form SHALL edit school, degree, field, start month and end month. The Certifications form
SHALL edit name, issuer, issued month, expiry month and URL. The Projects form SHALL edit name, URL,
optional start and end month, and skills.

#### Scenario: Current job

- **WHEN** the user ticks "Current" on an experience
- **THEN** the end month is cleared and disabled, and the saved entry shows "– Present"

#### Scenario: Skills on an entry

- **WHEN** the user tags an experience with an existing skill and a new one
- **THEN** both show on that experience after saving

### Requirement: Entry bullets

Every experience, education, certification and project SHALL show its bullets as plain text on its
card, in the order the API returns. The user SHALL be able to add, edit, delete and drag to reorder
bullets in the entry's edit form. Each bullet change SHALL be saved right away, independently of
the form's Save, and the form SHALL say so. An entry SHALL have at most 20 bullets.

#### Scenario: Adding a bullet

- **WHEN** the user opens an experience's edit form and adds the text "Led a team of 4"
- **THEN** it appears as the last bullet in the form and on the experience's card

#### Scenario: Bullets on every kind

- **WHEN** the user adds a bullet in a certification's edit form
- **THEN** it appears on that certification

#### Scenario: Editing a bullet

- **WHEN** the user edits a bullet's text and saves it
- **THEN** the bullet shows the new text in the same position

#### Scenario: Reordering

- **WHEN** the user drags the third bullet to the top
- **THEN** it is first, and the list stays in that order after the profile reloads

#### Scenario: Deleting a bullet

- **WHEN** the user deletes a bullet and confirms
- **THEN** it disappears and the others keep their order

#### Scenario: Bullet limit

- **WHEN** an entry already has 20 bullets
- **THEN** "Add bullet" is disabled

#### Scenario: Rejected text

- **WHEN** the user saves a blank or over-long bullet and the API rejects it
- **THEN** the API's message is shown and the typed text stays in the field

#### Scenario: New entry

- **WHEN** the user is adding a new entry
- **THEN** the form says bullets can be added after saving, and the user can add them from the
  entry's edit form

#### Scenario: Bullet saved, form cancelled

- **WHEN** the user adds a bullet in an edit form and then cancels the form
- **THEN** the bullet stays saved

### Requirement: Month values

Every entry date SHALL be picked as a month and year. It SHALL be sent as the first day of that month,
and shown as short month plus year in the profile's content language (English or Norwegian); the
date of birth SHALL follow the same language. A range with no end SHALL read "Present" for
experience and education, and show just the start for undated-end projects.

#### Scenario: Half-cleared month

- **WHEN** the user clears only the year of an entry's start month and tries to save
- **THEN** the form is not saved and the start field shows that a full month is needed

#### Scenario: Picking a start month

- **WHEN** the user picks March 2021 as a start month and saves
- **THEN** the API receives `2021-03-01` and the entry shows March 2021 as a short month and year

#### Scenario: English profile dates

- **WHEN** the profile's content language is English
- **THEN** an experience from January 2020 with no end reads "Jan 2020 – Present", and the date of
  birth reads like "17 May 1990"

#### Scenario: Norwegian profile dates

- **WHEN** the profile's content language is Norwegian
- **THEN** month names and the date of birth are in Norwegian

### Requirement: Skills

The Skills card SHALL list skills in API order with name, level out of 5, and years of experience
derived from the experiences tagged with that skill. The user SHALL be able to add a skill (existing
or new name) with a level, change a level, and remove a skill. Each change is saved right away.
Removing a skill SHALL NOT remove it from entries.

#### Scenario: Years of experience

- **WHEN** a skill has 30 months of tagged experience
- **THEN** it shows "2.5 yrs"

#### Scenario: Less than a year

- **WHEN** a skill has under 12 months of tagged experience
- **THEN** it shows "<1 yr"

#### Scenario: No tagged experience

- **WHEN** no experience is tagged with a skill
- **THEN** no years are shown for it

#### Scenario: Changing a level

- **WHEN** the user changes a skill's level from 3 to 4
- **THEN** the list shows level 4 for that skill

### Requirement: Languages

The Languages card SHALL list languages in API order with their CEFR level (A1–C2), as read-only
content with an actions menu per language. A Language form SHALL add a language not yet listed, or
change a listed language's level (not the language itself). Removing SHALL ask for confirmation.
Each change is saved when the form or confirmation is accepted. Adding SHALL be hidden once every
supported language is listed. With no languages, the card SHALL show the standard empty state.

#### Scenario: Adding a language

- **WHEN** the user adds Norwegian at B2
- **THEN** the Languages card shows "Norwegian · B2"

#### Scenario: Changing a level

- **WHEN** the user picks Edit on English, changes the level to C1 and saves
- **THEN** the card shows English at C1

#### Scenario: All languages listed

- **WHEN** both English and Norwegian are listed
- **THEN** there is no way to add another language

### Requirement: Save errors

When a profile save fails, the page SHALL show the API's message, keep the open form and the user's
input, and not change the shown profile.

#### Scenario: Invalid basics

- **WHEN** the API rejects the Basics form with a validation message
- **THEN** that message is shown and the form stays open with the input kept

### Requirement: English CV import entry point

The profile page SHALL offer Import CV for empty and populated English-primary profiles. The modal SHALL use the listing parsing modal's paste and external AI pattern, with no built-in upload or URL input. Norwegian-primary profiles SHALL disable Import CV, explain why in its tooltip, and SHALL NOT switch language automatically.

#### Scenario: Existing English profile

- **WHEN** the owner opens Import CV on an English-primary profile with Norwegian translations
- **THEN** the import modal opens and translations do not block import

#### Scenario: Norwegian-primary profile

- **WHEN** the profile's content language is Norwegian
- **THEN** Import CV is disabled, and its tooltip explains that import needs an English-primary
  profile and points to the content-language control

### Requirement: Built-in CV parsing

The modal SHALL accept English text or Markdown and parse it without saving profile content. It SHALL show the paid AI notice and usage information following the existing parsing modal pattern. Failed parsing SHALL keep the input and show the API error with retry and external AI available.

#### Scenario: Successful parse

- **WHEN** the owner parses accepted CV text and parsing succeeds
- **THEN** the returned candidate opens in the editable review and no import save is sent

#### Scenario: Parse fails

- **WHEN** parsing returns a failed result, typed error, or transport failure
- **THEN** the modal stays open, shows the error, and preserves the CV text

### Requirement: External CV parsing

The modal SHALL let the owner copy the backend CV prompt, use it with their CV externally, and paste JSON for server validation. Prompt copy SHALL NOT require CV text in the app. Both parsing routes SHALL share the same candidate review.

#### Scenario: External prompt and JSON

- **WHEN** the owner copies the prompt and submits valid external JSON
- **THEN** the server-validated candidate opens for review without saving profile content

#### Scenario: Invalid JSON candidate

- **WHEN** the preview API rejects the JSON
- **THEN** the modal shows its message and preserves the JSON for correction

### Requirement: Editable CV review

The review SHALL show editable basics, links, hobbies, experience, education, certifications, projects, skills, languages, and bullets with relevant warnings beside their fields or entries. Selected invalid values SHALL prevent the save request until corrected or skipped, while Save remains actionable to guide correction. Missing skill levels SHALL use visible defaults; dates and language proficiency SHALL require review rather than guessed values.

#### Scenario: Incomplete candidate

- **WHEN** a candidate lacks a required start month or language level
- **THEN** the owner can correct or skip the affected item, and clicking Save opens and focuses the first correction with a plain-language inline message

#### Scenario: Current or ongoing entry

- **WHEN** a selected entry has no end month
- **THEN** the review makes the current/ongoing interpretation explicit for confirmation and shows any needed correction at the related control

#### Scenario: Empty candidate

- **WHEN** no supported content is available or all content is skipped
- **THEN** the footer explains that nothing is selected and Save import is disabled with styling clearly distinct from its enabled state, without adding labels as a substitute for that distinction

### Requirement: Explicit CV import selections

History entries and bullets SHALL offer add/update/skip with manual selection of same-kind existing entries and same-parent bullets for updates. No automatic matching SHALL occur. Basics SHALL allow per-field inclusion and explicit clearing; links and hobbies SHALL require explicit inclusion as replacement lists. Skills and languages SHALL show their upsert behavior and allow skipping.

#### Scenario: Add or update an entry

- **WHEN** the owner chooses Add
- **THEN** no entry ID is sent, even if similar content exists
- **WHEN** the owner chooses Update and selects an existing entry
- **THEN** that entry's ID and complete reviewed structural fields are sent, with retained values visible before save

#### Scenario: Bullet update scope

- **WHEN** the owner updates an existing bullet
- **THEN** only a bullet belonging to the chosen parent can be selected, its ID is sent, and unselected bullets remain unchanged

#### Scenario: Preserve omitted content

- **WHEN** the owner skips entries, bullets, basic fields, links, or hobbies
- **THEN** those selections are omitted and the saved content remains unchanged

#### Scenario: Replace a list or clear a field

- **WHEN** the owner explicitly includes links or hobbies, or clears an included optional basic field
- **THEN** the review explains replacement and sends the reviewed list (including an empty list to clear) or explicit null respectively

### Requirement: Atomic reviewed CV save

Save import SHALL send one valid reviewed selection, disable duplicate submissions, and update the profile only on success. Invalid attempts SHALL give actionable feedback without sending a mutation. Failed saves SHALL keep edits and show readable errors at affected fields or beside Save. Import SHALL preserve Norwegian translations and omitted content; changed translated sources can become stale. Import SHALL NOT delete or reorder bullets.

#### Scenario: Successful save

- **WHEN** the atomic import succeeds
- **THEN** the returned profile is shown and the modal closes with success feedback

#### Scenario: Rejected save

- **WHEN** validation rejects any selected item
- **THEN** no partial profile changes are displayed, edits remain available, and recognized field errors appear inline with focus moved to the first correction

#### Scenario: Unknown target ID

- **WHEN** an update target no longer exists
- **THEN** the error asks the owner to choose the saved entry or bullet again, existing target options are refreshed, and reviewed edits are preserved for reselection

#### Scenario: Close unsaved review

- **WHEN** the owner dismisses a populated review
- **THEN** discarding it requires confirmation; dismissal and repeated submission are disabled while saving or parsing

#### Scenario: Invalid Save attempt

- **WHEN** the owner clicks Save import while selected fields need correction
- **THEN** the footer announces a short correction count, the first affected entry opens, its invalid control receives focus, and no import mutation runs

#### Scenario: Request-wide failure

- **WHEN** saving fails without a recognizable field location
- **THEN** readable feedback appears beside Save, backend details are available on demand only when they add information, and the owner retains all edits

#### Scenario: Uncertain network outcome

- **WHEN** the save request fails without a response
- **THEN** the footer warns that the import could not be confirmed and the profile should be checked before retrying, the edits remain, and no second request is sent automatically

#### Scenario: Disabled styling is recognizable

- **WHEN** Save import is unavailable because nothing is selected
- **THEN** it uses a muted neutral treatment visibly different from the enabled primary button in light and dark modes, without adding labels

#### Scenario: Saving state

- **WHEN** a save request is in progress
- **THEN** Save import keeps its primary appearance with a loading indicator and cannot be activated again

### Requirement: CV skill level defaults

Missing imported standalone skill levels SHALL default to 1 for new names and retain the saved level for existing names. Valid supplied levels SHALL be retained. Defaults SHALL be visible and editable without requiring a separate confirmation. Save SHALL use the displayed reviewed level; 0 SHALL NOT be used as a default.

#### Scenario: Missing new-skill level

- **WHEN** a new imported skill has no level
- **THEN** its control shows level 1, a short note explains the default, and its missing-level warning does not block saving

#### Scenario: Missing existing-skill level

- **WHEN** an imported skill name already has saved level 4 and the CV supplies no level
- **THEN** the review displays and retains level 4 rather than lowering it

#### Scenario: Supplied or edited skill level

- **WHEN** the CV supplies a valid level or the owner changes the displayed level
- **THEN** that level is used on save; an invalid supplied level receives inline correction feedback

### Requirement: Local and readable CV review feedback

Review feedback SHALL use field labels and entry names, without raw JSON paths in primary messages. Each issue SHALL appear once beside the affected field, item or entry, and every issue counted by the footer or a needs-attention indicator SHALL be visible somewhere in the review. Resolved and skipped issues SHALL disappear from actionable feedback. Entry-level source notes SHALL remain until their entry is skipped. Source notes that cannot be tied to a current item SHALL remain in a collapsed Import notes area.

#### Scenario: Missing month on an experience

- **WHEN** an experience has an incomplete start date
- **THEN** its Start month control shows “Choose a start month and year,” with no `experiences[0].startMonth` prefix

#### Scenario: Correct or skip an issue

- **WHEN** the owner fixes a value or skips its item
- **THEN** its correction message and needs-attention state disappear without leaving a duplicate original warning

#### Scenario: Item-level issue

- **WHEN** a warning or save error refers to a whole link, skill, language or bullet rather than one of its fields
- **THEN** its message appears on that row and the row is focusable as the correction target

#### Scenario: Server selection path differs from draft position

- **WHEN** a save error refers to a selected row or bullet after earlier draft rows or bullets were skipped
- **THEN** its inline feedback appears on the actual selected row and field, the entry shows needs attention, and the path is not shown as a user label

#### Scenario: Location correction

- **WHEN** a selected location has no country
- **THEN** the message appears at the country picker and Save correction focuses that picker

#### Scenario: Entry-level source note

- **WHEN** the parser flags uncertainty about a whole entry and the owner edits one of its fields
- **THEN** the note remains visible on the entry until the entry is skipped

### Requirement: Compact CV history review

History entries SHALL show a compact header with their readable title, subtitle, formatted dates, Add new/Update existing/Skip choice, and current needs-attention state. Fields SHALL be behind an expandable area that is initially collapsed unless the entry needs attention. Skipped entries SHALL appear muted without an empty expandable area. Update existing SHALL be offered only when saved entries of that kind exist. Save correction navigation SHALL open all ancestors of the targeted field and bring it into view within the modal.

#### Scenario: Long CV review

- **WHEN** a CV contains many complete history entries
- **THEN** the owner sees scan-friendly headers with title and dates and can expand an entry to review all its fields

#### Scenario: Experience without employer

- **WHEN** an imported experience has a title but no employer
- **THEN** its header shows the title rather than a generic incomplete label

#### Scenario: Hidden invalid field

- **WHEN** the first invalid selected field is inside a collapsed entry
- **THEN** clicking Save expands it, scrolls it into view, and focuses its control for keyboard correction

#### Scenario: No saved entries of a kind

- **WHEN** the profile has no saved entries of an imported entry's kind
- **THEN** its action choices are Add new and Skip

### Requirement: Compact CV item review

Imported skills and languages SHALL each appear as one compact row with an include control named after the item, its name, its level, and whether it is new or already saved with a level. Skipped items SHALL remain identifiable. The owner SHALL be able to include or skip all imported skills at once. Imported links and hobbies SHALL be visible before the owner opts to replace the saved lists. Each bullet SHALL appear as a single row with its text and action.

#### Scenario: Skipped skill

- **WHEN** the owner skips an imported skill
- **THEN** its name remains visible in a muted row and can be included again

#### Scenario: Saved-level indication

- **WHEN** an imported skill matches a saved skill by trimmed, case-insensitive name
- **THEN** its row shows the saved level; otherwise it is marked as new

#### Scenario: Bulk skill selection

- **WHEN** the owner chooses Skip all or Include all for skills
- **THEN** every imported skill row changes its include state and the footer count updates

#### Scenario: Imported links before opting in

- **WHEN** the CV contains links or hobbies and the owner has not chosen to replace the saved lists
- **THEN** the imported items are listed read-only so the owner can decide whether to opt in

### Requirement: CV review status

The review footer SHALL show one short status line from the start of review: the number of items needing attention (warning tone before a save attempt, error tone after) or the number of changes to save. When items need attention, the status SHALL act as a control that opens and focuses the first one. Section headings SHALL show how many of their items need attention.

#### Scenario: Issues visible before saving

- **WHEN** the review opens with items needing attention
- **THEN** the footer shows their count in a warning tone, and activating it focuses the first one without saving

#### Scenario: Clean review

- **WHEN** no selected item needs attention
- **THEN** the footer shows how many changes will be saved

#### Scenario: Section counts

- **WHEN** a section contains items needing attention
- **THEN** its heading shows that count, and the count updates as items are corrected or skipped

### Requirement: Profile form behaviour

Every profile add/edit form SHALL save when the user presses Enter in a single-line field. When the
user tries to save with a required field missing or incomplete, the form SHALL show an inline error
on that field and move focus to it, without sending a request. If the form has unsaved changes,
closing it (Cancel, close button, Escape or clicking outside) SHALL ask the user to confirm discarding
them. On phones, a form SHALL use the full screen height, and Save SHALL stay reachable.

#### Scenario: Enter saves

- **WHEN** the user edits an experience's title and presses Enter in that field
- **THEN** the experience is saved and the form closes

#### Scenario: Missing required field

- **WHEN** the user clicks Save on a new experience with no employer
- **THEN** no request is sent, the Employer field shows an error, and the field has focus

#### Scenario: Closing with unsaved changes

- **WHEN** the user changes the headline and presses Escape
- **THEN** a "Discard changes?" confirmation appears, and the form stays open with the input kept
  unless the user confirms

#### Scenario: Closing an unchanged form

- **WHEN** the user opens a form, changes nothing and presses Escape
- **THEN** the form closes without asking

#### Scenario: Typed but not added name

- **WHEN** the user types a hobby, does not press Add, and saves
- **THEN** the typed hobby is saved along with the others

### Requirement: Consistent remove actions

Every removal on the profile page SHALL ask for confirmation first. This covers entries, bullets,
skills, languages, references and target locations. Every item that can be removed SHALL use the same
remove icon.

#### Scenario: Removing a language

- **WHEN** the user chooses Remove on a language
- **THEN** a confirmation names the language, and the language is removed only after the user
  confirms

#### Scenario: Deleting a bullet

- **WHEN** the user deletes a bullet in an entry form
- **THEN** it is removed only after the user confirms

### Requirement: CV review on phones

On phones, the CV import modal SHALL use the full screen height. Its Save and Cancel actions SHALL
stay visible while the user scrolls the review, even when an error message or the status line is
showing.

#### Scenario: Long review on a phone

- **WHEN** the user scrolls a long CV review on a phone-sized screen
- **THEN** Save import and Cancel stay visible at the bottom of the modal
