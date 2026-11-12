# Spec Delta

## Purpose

Lets the user map what a listing needs against their profile, review and correct that map, and save it, so they can
decide whether to send a CV template, tailor a CV, or skip the listing.

## ADDED Requirements

### Requirement: Requirements editor page

The app SHALL provide a page at `/listings/[id]/requirements` that loads the listing's saved requirement map into an
editor. With no saved map it SHALL show an empty state offering to create one with AI or to add a need by hand. The
page SHALL show loading and error states and a way back to the listing.

#### Scenario: Open with a saved map

- **WHEN** the user opens the page for a listing with a saved map
- **THEN** the needs are shown in saved order and nothing is marked unsaved

#### Scenario: Open with no map

- **WHEN** the listing has no saved map
- **THEN** the page shows the empty state and no needs

### Requirement: Candidate from the built-in AI

The page SHALL let the user generate a candidate map with the built-in AI. The candidate SHALL load into the editor
as unsaved. The run SHALL use the app's shared AI safeguards: usage notice, one request id per action reused on
retry, a confirmation before a possibly charged retry, and the safety and daily-limit error displays.

#### Scenario: Successful run

- **WHEN** the user runs the built-in AI and it succeeds
- **THEN** the editor shows the candidate's needs, marked as unsaved, and the saved map is unchanged

#### Scenario: Failed run

- **WHEN** the run fails or the API returns an error such as a listing with no description and no skills
- **THEN** the message is shown in the AI dialog and the editor is unchanged

### Requirement: Candidate from an external AI

The page SHALL let the user copy the listing's external prompt and paste the chat's JSON reply to get a candidate,
which SHALL load into the editor as unsaved. The paste field SHALL say to paste the JSON object without a code
fence and to include `schemaVersion: 1`. Pasted JSON SHALL NOT be saved.

#### Scenario: Valid reply

- **WHEN** the user pastes a valid reply and previews it
- **THEN** the editor shows the candidate's needs, marked as unsaved

#### Scenario: Invalid reply

- **WHEN** the API rejects the pasted JSON
- **THEN** the API's message is shown next to the paste field and the editor is unchanged

#### Scenario: Prompt cannot be built

- **WHEN** the prompt request fails, as for a listing with no description and no skills
- **THEN** the dialog shows an error instead of a prompt

### Requirement: Candidates are reviewed before saving

When a candidate is loaded, the page SHALL say that it is unsaved and that the API may have adjusted it (dropped
unknown evidence, turned unsupported needs into gaps), so it can differ from what the AI wrote. Loading a candidate
over unsaved edits SHALL require confirmation. The user SHALL be able to discard the candidate and return to what
was in the editor before it.

#### Scenario: Candidate notice

- **WHEN** a candidate loads
- **THEN** a notice says it is unsaved and may differ from the AI's reply

#### Scenario: Discard

- **WHEN** the user discards a loaded candidate
- **THEN** the editor shows the needs it held before the candidate

#### Scenario: Unsaved edits

- **WHEN** the editor has unsaved edits and the user asks for a candidate
- **THEN** the user is asked to confirm before the edits are replaced

### Requirement: Editing needs

Each need SHALL be editable: text (up to 200 characters), kind, importance, match, and a note (up to 500
characters). The user SHALL be able to add and remove needs, up to 30. Each need SHALL show its match with an icon
and a label, not color alone.

#### Scenario: Add a need

- **WHEN** the user adds a need
- **THEN** a new empty need appears and the editor is marked unsaved

#### Scenario: Thirty needs

- **WHEN** the map has 30 needs
- **THEN** adding another is unavailable and the reason is shown

### Requirement: Evidence from the profile

For skill, duty and qualification needs that are not gaps, the user SHALL be able to pick evidence from their
profile: up to 10 bullets and up to 10 entries (experience, education, certification, project). Evidence SHALL be
shown by its profile wording and entry name. Evidence ids the profile no longer has SHALL be left out of the display
and of the next save.

#### Scenario: Pick evidence

- **WHEN** the user picks two bullets and one experience for a need
- **THEN** the need lists those three by name

#### Scenario: Evidence limit

- **WHEN** a need already has 10 bullets
- **THEN** no further bullet can be picked for it

#### Scenario: Removed profile item

- **WHEN** a saved need points at a bullet the profile no longer has
- **THEN** that bullet is not shown, and saving sends the need without it

#### Scenario: Gap

- **WHEN** a need's match is Gap
- **THEN** no evidence is shown or sent for it, and the row says a gap is stored without evidence

#### Scenario: Language or practical need

- **WHEN** a need's kind is Language or Practical
- **THEN** no evidence picker is offered and the note is marked as required unless the need is a gap

### Requirement: Saving

Save SHALL fully replace the listing's single map with the validated editor content, preserve need order, and
adopt the returned saved state. API errors SHALL remain visible and preserve unsaved edits. Leaving with unsaved
changes, including browser reload, SHALL request confirmation.

#### Scenario: Successful save

- **WHEN** the user saves a valid map
- **THEN** the map is stored, the page shows it as saved, and the listing page's Requirements card shows it

#### Scenario: Note missing

- **WHEN** a Language need is Evidenced with an empty note and the user saves
- **THEN** nothing is sent, the need shows that a note is needed, and it is brought into view

#### Scenario: API rejects the save

- **WHEN** the API returns a validation error
- **THEN** its message is shown and the editor keeps the unsaved needs

#### Scenario: Leave with unsaved changes

- **WHEN** the user navigates away with unsaved changes
- **THEN** a confirmation asks whether to discard them

### Requirement: Deleting the map

The page SHALL let the user delete a saved map after a confirmation. After deletion the user SHALL land on the
listing page, whose Requirements card shows the empty state.

#### Scenario: Delete

- **WHEN** the user confirms deleting the map
- **THEN** the map is deleted and the listing page shows no map

#### Scenario: No saved map

- **WHEN** the listing has no saved map
- **THEN** no delete action is offered

### Requirement: Out-of-date hint

When the listing was changed after the map was last saved, the page and the listing page's card SHALL show a hint
that the map may be out of date.

#### Scenario: Listing edited later

- **WHEN** the listing's last change is newer than the map's last save
- **THEN** the hint is shown with a way to open the editor

#### Scenario: Map is newer

- **WHEN** the map was saved after the listing's last change
- **THEN** no hint is shown

### Requirement: Strict save validation

The editor SHALL validate the outgoing content before sending: 1–30 needs, nonblank text of at most 200 characters,
note of at most 500 characters, and at most 10 bullet ids and 10 entry refs per need, all belonging to the loaded
profile. Evidenced/partial needs SHALL have evidence or a nonblank note. Language/Practical SHALL send no ids and
require a note unless Gap. Gap SHALL send no evidence. Invalid content SHALL remain editable.

#### Scenario: Boundary values

- **WHEN** the user saves 1 or 30 otherwise valid needs with text of 200 characters, notes of 500 characters,
  10 bullet ids and 10 entry refs per applicable need
- **THEN** the editor permits the request

#### Scenario: Invalid sizes

- **WHEN** content has 0 or 31 needs, blank or 201-character text, a 501-character note, 11 bullet ids, or 11 entry refs
- **THEN** no save request is sent, the reason is shown, and the first invalid field is brought into view

#### Scenario: Evidence or note

- **WHEN** an Evidenced or Partial need has neither remaining evidence nor a nonblank note
- **THEN** save is blocked; a nonblank note alone is sufficient for an otherwise valid need

#### Scenario: Kind and match changes

- **WHEN** a need with evidence is changed to Language, Practical, or Gap
- **THEN** no evidence is sent for it, and Language/Practical needs require a note when not Gap

### Requirement: Server-corrected candidates

Both AI paths SHALL display the content returned by the API, preserving its need order and bullet order. The UI
SHALL NOT reconstruct the candidate from the pasted reply or reject a returned candidate merely because it differs
from the model output. No generation or preview SHALL call save implicitly.

#### Scenario: Corrected reply

- **WHEN** preview returns a candidate with unknown ids removed, unsupported matches changed to Gap, shortened
  text, and needs beyond 30 removed
- **THEN** review shows that returned candidate rather than the pasted values and makes no save request

#### Scenario: Corrected built-in output

- **WHEN** generation succeeds with corrected content
- **THEN** review shows that content as unsaved and makes no save request

#### Scenario: Failed result

- **WHEN** generation returns FAILED with an error and errorCode, or a payload error
- **THEN** the dialog displays the failure and preserves the editor without loading a candidate

#### Scenario: Missing schema version

- **WHEN** preview rejects a missing or wrong schemaVersion, malformed JSON, an unknown enum, or an empty needs list
- **THEN** the API error is shown and both the pasted reply and existing editor content are retained

### Requirement: Unsaved candidate lifecycle

A loaded candidate SHALL remain explicitly unsaved until saved or discarded, including when its content equals the
saved map. Discard SHALL restore the pre-candidate editor and its unsaved status. Failed requests and background
refreshes SHALL NOT overwrite local edits. The UI SHALL explain that unsaved work is lost on reload.

#### Scenario: Identical candidate

- **WHEN** a candidate has the same needs as the saved map
- **THEN** review still identifies it as an unsaved candidate and offers Save and Discard

#### Scenario: Cancel replacement

- **WHEN** the user declines replacing unsaved edits with another AI candidate
- **THEN** no generation or preview starts and the editor stays unchanged

#### Scenario: Refresh during editing

- **WHEN** saved-map data refreshes while the user has unsaved edits
- **THEN** the edits are preserved

### Requirement: Evidence resolution failures

Evidence SHALL be resolved only after the profile loads successfully. Missing ids SHALL be omitted from display and
outgoing content without changing match labels or marking an otherwise unchanged saved map dirty. A profile load
failure SHALL show an error with Retry rather than remove evidence as if the profile were empty.

#### Scenario: Entry id collision

- **WHEN** an experience and a project share the same numeric id
- **THEN** each evidence reference resolves to its own kind and entry

#### Scenario: Last evidence deleted

- **WHEN** all evidence for an Evidenced or Partial need has been deleted and it has no note
- **THEN** its match stays unchanged, stale ids are omitted, and save requires a note, new evidence, or a match change

#### Scenario: Profile load failure

- **WHEN** the profile request fails
- **THEN** the editor offers Retry and does not prune evidence or permit saving against an unresolved profile

### Requirement: Delete failure recovery

A failed delete SHALL show the API error and preserve the editor and saved card. A successful delete SHALL clear the
shared saved-map state before returning to the listing, so a previously cached map is not shown as saved.

#### Scenario: Delete fails

- **WHEN** delete returns RequirementMapNotFoundError or a transport error
- **THEN** the editor stays open with the message and retains its content

### Requirement: Generation request identity

Built-in generation SHALL use the saved default model when model is omitted, send a UUID for each new action, and
reuse that UUID only for transport retries of unchanged input. A confirmed potentially charged retry SHALL be a new
action. Both built-in validation errors and external prompt GraphQL errors SHALL remain recoverable in the dialog.

#### Scenario: Transport retry

- **WHEN** a generation gets no usable response and the same action is retried with unchanged input
- **THEN** the same requestId is sent without an implicit save

#### Scenario: Confirmed new run

- **WHEN** the user confirms another potentially charged attempt
- **THEN** a new requestId is sent using the saved default model
