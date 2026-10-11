# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
