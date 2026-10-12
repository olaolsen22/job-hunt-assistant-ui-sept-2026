# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
