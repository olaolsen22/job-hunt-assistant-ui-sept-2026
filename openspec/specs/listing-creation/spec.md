# listing-creation Specification

## Purpose

Covers adding listings through the full form, quick-add, and parsed drafts from an ad, including
the warnings about duplicates and earlier attempts at the same posting.

## Requirements

### Requirement: Parsed drafts use current deadline types

When a parsed draft (from the AI parser or a pasted external AI reply) has the deadline type
`ROLLING`, the UI SHALL fill the form with ASAP. Unknown deadline types SHALL fall back to Not stated.

#### Scenario: Old parse result says ROLLING

- **WHEN** a draft with `deadlineType: "ROLLING"` fills the form or a quick-add row
- **THEN** the Deadline field is set to ASAP

### Requirement: Previous attempts

After a listing is saved, if the API reports earlier closed listings with the same URL
(`previousAttempts`), the UI SHALL tell the user and link to the most recent one. The new listing
SHALL still count as saved.

#### Scenario: Re-adding a reposted ad on the full form

- **WHEN** the user saves a listing on `/listings/add` whose URL matches an earlier Rejected listing
- **THEN** the "Listing added" confirmation also says the user applied to this posting before, with a link to the earlier listing

#### Scenario: Re-adding in quick-add

- **WHEN** a quick-add row is saved and the API returns previous attempts for it
- **THEN** that row shows a note listing each previous attempt (title and status) with links, separate from the possible-duplicates note

### Requirement: Duplicate URL among open listings

When the URL already belongs to an open listing, saving SHALL fail for that listing with the API's
message and a link to the existing listing.

#### Scenario: Same URL still open

- **WHEN** a quick-add row's URL matches an open listing
- **THEN** that row shows the error and "View the existing listing" links to it

### Requirement: Saved edits show on the listing page

After a listing edit is saved, the listing page SHALL show the saved values without a manual page refresh.

#### Scenario: Save after analyzing from an ad

- **WHEN** the owner opens a listing, edits it (including via "Paste from ad"), and saves successfully
- **THEN** the listing page opens showing the saved title, fields, and requirements, not the values from before the edit

#### Scenario: Save fails

- **WHEN** the API returns errors for the save
- **THEN** the owner stays on the edit page and the errors are shown, as before

### Requirement: Saved forms leave no history entry

After a successful save, the add and edit listing forms SHALL be replaced in browser history by the
page they navigate to, so Back does not return to a form that was already submitted.

#### Scenario: Back after saving an edit

- **WHEN** the user opens a listing from a filtered list, edits it, saves, and presses browser Back on the details page
- **THEN** the filtered list is shown, not the edit form

#### Scenario: Back after adding a listing

- **WHEN** the user adds a listing and is redirected to `/listings`, then presses browser Back
- **THEN** the page before the add form is shown, not the add form

### Requirement: Listing form contacts

The listing form (add and edit) SHALL have a Contacts section with one row per linked contact
(name, title, email, phone, link) and the ability to add and remove rows. On edit it SHALL start with
the listing's linked contacts. On save the UI SHALL send the rows with a non-empty name (trimmed,
blank fields as null); removing every row SHALL unlink all contacts. A returned
`InvalidListingError` SHALL be shown as with other save errors.

#### Scenario: Removing a contact on edit

- **WHEN** the user removes a linked contact's row and saves
- **THEN** the save sends the remaining contacts and the listing page no longer shows the removed one

### Requirement: Parsed drafts carry contacts

When a full parsed draft (AI parser, pasted JSON, or URL parse) contains contacts, the UI SHALL keep
those with a non-empty name (duplicate names dropped case-insensitively). On a new listing they fill
the Contacts section; on an existing listing they SHALL be added to the current rows, skipping names
already there (case-insensitive).

#### Scenario: New listing from a parsed ad with a recruiter

- **WHEN** a parsed draft with `contacts: [{ name: "Kari", email: "kari@x.no" }]` fills the add form
- **THEN** the Contacts section shows Kari and saving sends that contact

#### Scenario: Re-analyzing an existing listing

- **WHEN** an existing listing linked to "Kari" is re-parsed with contacts "KARI" and "Ola"
- **THEN** the Contacts section shows Kari and Ola

### Requirement: Parse a new listing from its link

On the add listing page, the Analyze ad modal SHALL offer a "From link" option with its own link
input, prefilled from the form's Ad link, that parses the ad at that link. Parsing SHALL use a full
parse and SHALL NOT save anything. The parsed values SHALL fill the form the same way a pasted ad
does, and the typed URL SHALL be kept and sent when the listing is saved. Saved listings SHALL keep
parsing from their stored link as before.

#### Scenario: Opens on From link

- **WHEN** the owner opens Analyze ad on the add page
- **THEN** the From link tab is selected

#### Scenario: Needs a link

- **WHEN** the form's Ad link field is empty
- **THEN** "Parse from link" is disabled

#### Scenario: Successful parse fills the form

- **WHEN** the owner parses from the link and the API returns a finished parse
- **THEN** the modal closes, the form is filled from the result and its Ad link holds the parsed link

#### Scenario: Page cannot be read

- **WHEN** the API returns an error for the URL (invalid link, blocked site, or an ad built by JavaScript)
- **THEN** the error shows in the From link tab with a "Paste the ad instead" option, the modal stays open, and the form is unchanged

#### Scenario: Paste fallback keeps the link

- **WHEN** the owner pastes the ad instead and parses it
- **THEN** the form is filled and its Ad link holds the link typed in the modal

### Requirement: Quick-add saves only on the Save button

Quick-add rows SHALL be saved only when the user clicks the "Save N listings" button. Pressing Enter in
a row field SHALL NOT save anything. Saving SHALL still validate the pending rows first.

#### Scenario: Enter in a row field

- **WHEN** the user presses Enter in a pending row's Job title field
- **THEN** no listing is saved and the rows stay editable

#### Scenario: Save button

- **WHEN** the user clicks "Save 2 listings" with two valid rows
- **THEN** both rows are saved

### Requirement: Leaving quick-add

The page SHALL offer one leave action labeled by destination, never Done or Cancel. While rows or batch work are pending it SHALL read "Back to listings" and SHALL ask for confirmation before discarding unsaved drafts, prepared collected input, or batch progress, even when nothing has been saved. When nothing is pending and something was saved, Save SHALL be hidden and the leave action SHALL be the primary "View listings" button. In-app navigation SHALL use the same protection; tab close or reload SHALL use the browser's native unload confirmation when unsaved work exists.

#### Scenario: Nothing saved yet

- **WHEN** rows are pending and none were saved, and the user clicks Back to listings
- **THEN** a confirmation explains that unsaved listings will be lost; cancelling keeps the rows, and confirming goes to `/listings`

#### Scenario: Unsaved rows after a partial save

- **WHEN** one row was saved and one row failed, and the user clicks Back to listings
- **THEN** a confirmation says saved listings are kept and unsaved listings will be lost, and confirming goes to `/listings`

#### Scenario: Everything saved

- **WHEN** every draft has been saved and no prepared collection or unfinished batch work remains
- **THEN** the Save button is hidden and a primary View listings button goes to `/listings` without confirmation

#### Scenario: Leave during processing

- **WHEN** the user attempts in-app navigation during a running or paused batch run
- **THEN** a confirmation explains that batch progress and unsaved work will be discarded
- **AND** cancelling preserves the run while confirming stops future requests and prevents late responses from appending results to the abandoned run

#### Scenario: Replace checked input or start another collection

- **WHEN** the user changes or replaces input after checking, or restarts while unsaved drafts or processing results exist
- **THEN** confirmation is required before discarding prepared work, and cancelling retains the current work

#### Scenario: Close or reload

- **WHEN** the user attempts to close or reload the page with unsaved drafts or prepared batch work
- **THEN** the browser's native unload confirmation is requested

### Requirement: Quick-add save status

After the first save, the action bar SHALL show how many rows are saved and how many still need
fixing, and the top summary SHALL no longer tell the user to save when nothing is pending.

#### Scenario: Partial save

- **WHEN** a save leaves 3 rows saved and 1 row with an error
- **THEN** the action bar shows "3 saved · 1 needs fixing"

#### Scenario: All saved

- **WHEN** all pasted rows are saved
- **THEN** the top summary says they are all saved instead of "Check them below, then save"

### Requirement: Compare a quick-add row with a possible duplicate

When a saved quick-add row has possible duplicates, its possible-duplicate note SHALL show one Compare
button as its primary action, placed before Keep both and Remove new one. Compare opens a modal showing
the new listing and a match field by field (title, company, role, URL, locations, posted date, deadline,
existing status), starting with the first match. Fields whose values differ SHALL be visually marked.
The modal SHALL offer Open existing, Keep both, and Remove new one.

#### Scenario: Compare one match

- **WHEN** a saved row has one possible duplicate and the user clicks the note's Compare button
- **THEN** a modal shows the new listing's values as "New" and the match's values as "Existing" for each field, with differing fields marked

#### Scenario: Compare is the note's main action

- **WHEN** a saved row shows the possible-duplicate note
- **THEN** the note has a single primary Compare button first, followed by Keep both and Remove new one, and the listed matches have no Compare button of their own

#### Scenario: Switch between several matches

- **WHEN** a saved row has two possible duplicates and the user opens Compare
- **THEN** the modal opens on the first match and shows a "Compare with" selector, and choosing the second match replaces the Existing values without closing the modal

#### Scenario: Single match has no selector

- **WHEN** the row has exactly one possible duplicate
- **THEN** the modal shows no "Compare with" selector

#### Scenario: Keep both from the modal

- **WHEN** the user clicks Keep both in the modal
- **THEN** the modal closes and the row's possible-duplicate note is dismissed, as with the note's own Keep both

#### Scenario: Remove the new one from the modal

- **WHEN** the user clicks Remove new one in the modal
- **THEN** the modal closes and the existing remove confirmation opens for that row's new listing

#### Scenario: Narrow screen

- **WHEN** the modal is open on a phone-width screen
- **THEN** each field shows its label with the New and Existing values stacked beneath it, each tagged, rather than in two columns

### Requirement: Quick-add groups saved rows by whether they need a look

Once at least one quick-add row is saved, the page SHALL show saved rows with an open flag (possible
duplicate or applied before) under "Needs a look (N)", saved rows without one in a collapsible
"N listings added" group, and unsaved rows under "Not saved (N)" just above Save. A section with no rows
SHALL be hidden. Before any save the page SHALL show rows as it does today, without headings.

#### Scenario: Mixed batch

- **WHEN** a batch saves with one possible duplicate, two clean rows, and one failed row
- **THEN** "Needs a look (1)" shows the flagged row in full, "2 listings added" shows as a closed group, and "Not saved (1)" shows the failed row above Save

#### Scenario: Clean batch

- **WHEN** every row in a batch saves with no flags
- **THEN** only the "N listings added" group shows, closed

#### Scenario: Open the added group

- **WHEN** the user opens the "N listings added" group
- **THEN** each added listing shows as one line with its title linking to the listing and its company and role

#### Scenario: Resolving a flag moves the row

- **WHEN** the user clicks Keep both on the only flagged row
- **THEN** the row moves into the added group, its count goes up by one, and the "Needs a look" section disappears

#### Scenario: Removing a flagged row

- **WHEN** the user confirms Remove new one on a flagged row
- **THEN** the listing is deleted and the row leaves the page, as today

### Requirement: Acknowledge a previous application

A saved quick-add row's "Applied to this URL before" note SHALL offer a Got it button that clears the
note. A row whose only remaining flag is cleared SHALL count as added.

#### Scenario: Got it on an applied-before row

- **WHEN** a saved row is flagged only as applied before and the user clicks Got it
- **THEN** the note disappears and the row moves into the "N listings added" group

#### Scenario: Both flags

- **WHEN** a saved row has a possible duplicate and an applied-before note and the user clicks Got it
- **THEN** the applied-before note disappears and the row stays under "Needs a look" until the duplicate note is resolved

### Requirement: Flagged-row links keep the quick-add page

Links to matching or previously applied listings inside a flagged row's notes SHALL open in a new tab.

#### Scenario: Follow a match link

- **WHEN** the user clicks a possible-duplicate match title
- **THEN** the listing opens in a new tab and the quick-add page keeps its rows

### Requirement: Structured collected jobs in quick-add

Quick-add SHALL offer a collected-jobs input mode accepting a JSON array of full listing objects. Each row MUST have a non-empty http(s) URL. Every field of retained objects SHALL be preserved; a text field SHALL NOT be required. Invalid or empty input SHALL show an error and SHALL NOT start URL checking or AI processing. The existing free-text and pasted AI reply flows SHALL remain available.

#### Scenario: Valid collected jobs

- **WHEN** the user pastes a valid array of listing objects without a text field and chooses Check jobs
- **THEN** quick-add checks their URLs before enabling AI actions

#### Scenario: Invalid collection

- **WHEN** the array is invalid JSON, empty, or contains a row that is not an object or has a missing or invalid URL
- **THEN** the input error identifies the problem and no URL-check or AI request is sent

### Requirement: Authenticated URL eligibility before AI

Before sending collected jobs to built-in AI or copying their external AI prompt, the UI SHALL complete `checkListingUrls(urls)` using the existing login session in batches of at most 100 URLs. Each result SHALL map to its original row by the batch-local `index`. Only rows with `shouldProcess: true` SHALL be eligible, and retained rows SHALL preserve input order and content.

#### Scenario: Saved and repeated URLs

- **WHEN** check results mark saved URLs, including archived or closed listings, or repeated URLs as `shouldProcess: false`
- **THEN** those rows are excluded from both AI paths, regardless of listing status

#### Scenario: Result order differs from input

- **WHEN** results arrive in a different order from submitted URLs
- **THEN** their indexes select the correct original rows and retained jobs stay in input order

#### Scenario: More than one batch

- **WHEN** the collection contains 201 jobs
- **THEN** checks submit batches of 100, 100, and 1 URLs using the current login session
- **AND** result index 0 in each later batch refers to that batch's first original row

### Requirement: Normalized duplicates across batches

Within one collection check, the UI SHALL track returned `normalizedUrl` values across batches and exclude later occurrences already seen in earlier batches, even when a later result has `shouldProcess: true`. Normalization SHALL come from the API. A fresh check SHALL start with fresh tracking.

#### Scenario: Equivalent URLs straddle a batch boundary

- **WHEN** two URLs in different batches return the same normalized URL and both are otherwise eligible
- **THEN** only the earliest original row remains for AI and the later row counts as skipped

#### Scenario: Repeat of an earlier skipped URL

- **WHEN** a later eligible result has the normalized URL of a row skipped in an earlier batch
- **THEN** the later row is also skipped

#### Scenario: Fresh retry

- **WHEN** the user starts a new check of the same collection
- **THEN** normalized URLs seen in the previous check do not cause extra skips

### Requirement: Collection check summary and AI gating

After all checks succeed, quick-add SHALL show remaining and skipped job counts, where skipped equals input count minus remaining count. Both AI paths SHALL use only retained jobs. Checking SHALL disable AI actions. Zero remaining jobs SHALL show the counts and an empty-state message without sending jobs to AI or copying a prompt. Editing the input SHALL invalidate the prepared jobs and counts until checked again.

#### Scenario: Successful preparation

- **WHEN** 105 input jobs yield 80 eligible unique jobs
- **THEN** the UI shows 80 jobs remaining and 25 skipped
- **AND** parsing or copying the prompt includes only those 80 jobs with all their original fields, including nested locations, dates, and null values

#### Scenario: Every job is skipped

- **WHEN** no jobs remain after checking
- **THEN** the UI shows zero remaining, all jobs skipped, and a message that no new jobs remain
- **AND** AI actions stay disabled

#### Scenario: Input changes after checking

- **WHEN** the user edits a successfully checked collection
- **THEN** the old preparation and summary are invalidated and neither AI action is enabled until the new input is checked

### Requirement: URL check failure stops processing

If any URL check fails, including an expired login session, quick-add SHALL stop checking later batches, show an error, and SHALL NOT use partially checked jobs for built-in parsing or external AI prompt copying. It SHALL retain the collection input for correction or retry. A retry SHALL check the full collection again.

#### Scenario: Later batch fails

- **WHEN** the second batch fails after the first succeeds
- **THEN** no later batch is checked, neither AI action can use partial results, and the input remains available with an error

#### Scenario: Expired session

- **WHEN** the query fails because the existing login session has expired
- **THEN** processing stops with an error and no collected jobs are sent to AI

#### Scenario: Retry after failure

- **WHEN** the user retries a failed collection check
- **THEN** all batches are checked again before any jobs can be prepared for AI

### Requirement: Built-in AI processes collected jobs in batches

After all collection URL checks succeed, built-in AI processing SHALL submit retained complete listing objects sequentially in original order, with at most 20 jobs per request. Each request SHALL preserve all input fields and contain only eligible jobs. Smaller batches SHALL be used to respect the documented text limit without truncating jobs. External AI and unstructured free-text parsing SHALL retain their existing single-payload behavior.

#### Scenario: Forty-three retained jobs

- **WHEN** 43 jobs remain after duplicate checking and the user starts built-in processing
- **THEN** requests contain 20, 20, and 3 full job objects in order, provided each request fits the text limit
- **AND** each request begins only after the preceding batch succeeds or the user chooses to skip its failure

#### Scenario: Payload would exceed the text limit

- **WHEN** 20 complete jobs cannot fit within the documented 12,000-character input cap
- **THEN** the jobs are divided into smaller complete batches without removing any fields or truncating content

#### Scenario: One job cannot fit

- **WHEN** one complete job cannot fit within the input cap even by itself
- **THEN** processing does not start, the input is retained, and an inline error identifies the oversized job

#### Scenario: External AI remains available

- **WHEN** the user chooses Use your own AI after successful duplicate checks
- **THEN** the copy action includes all retained complete objects in one prompt and does not start automatic batching

### Requirement: Batch processing progress reflects successful work

Collected built-in processing SHALL show a labelled progress bar and processed jobs out of the fixed retained-job total, plus the current batch out of the planned batch total. Progress SHALL increase only after accepting a successful batch response. Skipped failed jobs and unprocessed jobs SHALL be shown separately and SHALL NOT count as processed. The summary SHALL remain visible after completion or stopping.

#### Scenario: Second batch is running

- **WHEN** the first 20 of 43 jobs have succeeded and the second batch is running
- **THEN** progress shows 20 of 43 jobs processed and batch 2 of 3

#### Scenario: All batches succeed

- **WHEN** every batch succeeds
- **THEN** progress reaches the retained-job total and the UI says processing is complete and drafts need review and saving

#### Scenario: Failure was skipped

- **WHEN** the user skips a failed 20-job batch and the other 23 of 43 jobs succeed
- **THEN** the terminal summary shows 23 processed and 20 skipped after failure, with a progress value of 23 out of 43
- **AND** the UI distinguishes finishing the run from successfully processing every job

### Requirement: Failed batches require a user decision

On a request failure or unusable batch reply, processing SHALL pause without sending another batch or changing AI method. The UI SHALL show the failed batch, its error, and completed counts, and ask the user to Retry batch, Skip batch and continue, or Stop and review. Accepted batches SHALL be retained and SHALL NOT be rerun or appended twice when retrying or continuing the same run. Failed input SHALL remain available.

#### Scenario: User has not decided

- **WHEN** batch 2 fails after batch 1 succeeds
- **THEN** no batch 3 request is sent, completed results and input remain intact, and the three recovery choices are shown

#### Scenario: Retry succeeds

- **WHEN** the user chooses Retry batch and it succeeds
- **THEN** only the failed batch is retried, its jobs count as processed once, and processing advances to the next batch

#### Scenario: User chooses to continue

- **WHEN** the user chooses Skip batch and continue
- **THEN** that batch's jobs are recorded as skipped after failure and processing advances to the next batch

#### Scenario: User stops

- **WHEN** the user chooses Stop and review
- **THEN** no more requests are sent, successful drafts are available for review, and the summary shows the remaining jobs as unprocessed

#### Scenario: Invalid or incomplete reply

- **WHEN** a reply is invalid JSON, is not an array of listing objects, or does not contain the expected number of drafts
- **THEN** that batch is treated as failed without accepting partial rows or advancing processed progress

### Requirement: Collected processing produces reviewable drafts

Successful batch results SHALL be staged until the run completes or the user chooses to stop, then appended once to existing quick-add rows in batch order. Existing edited or saved rows SHALL be preserved. Input and check counts SHALL remain available throughout processing. Processing SHALL NOT save listings; saving SHALL require the existing explicit Save action and validation.

#### Scenario: Intermediate batch finishes

- **WHEN** a batch succeeds while more batches remain
- **THEN** its drafts are retained without clearing the collection, hiding progress, or saving a listing

#### Scenario: Completed results join existing work

- **WHEN** the run completes with existing rows already on the page
- **THEN** accepted drafts are appended once without replacing existing rows or edits, and are available for review before saving

### Requirement: Quick-add clearly separates preparation and processing

Quick-add SHALL present Check duplicates, Process jobs, Review, and Save as distinct stages. Built-in AI and Use your own AI SHALL be explicit choices with contextual controls. During a running or paused batch run, input changes, parser switches, duplicate checks, row changes, and saving SHALL be disabled until the run finishes or the user stops it. Status updates SHALL be available to assistive technology.

#### Scenario: Ready to process

- **WHEN** checking finishes with eligible jobs and Built-in AI is selected
- **THEN** the UI shows collected, skipped, and ready counts, a Process N jobs action, and a note that processing creates drafts without saving
- **AND** external reply-entry controls are hidden

#### Scenario: Run is active

- **WHEN** a batch is running or waiting for a recovery decision
- **THEN** conflicting controls are disabled, progress remains visible, and completed-batch status is announced politely
