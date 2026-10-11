# Spec Delta

## ADDED Requirements

### Requirement: Structured collected jobs in quick-add

Quick-add SHALL offer a collected-jobs input mode accepting a JSON array of `{ url, text }` rows. Each row MUST have a non-empty http(s) URL and non-empty text. Invalid or empty input SHALL show an error and SHALL NOT start URL checking or AI processing. The existing free-text and pasted AI reply flows SHALL remain available.

#### Scenario: Valid collected jobs

- **WHEN** the user pastes a valid array of URL and text rows and chooses Check jobs
- **THEN** quick-add checks their URLs before enabling AI actions

#### Scenario: Invalid collection

- **WHEN** the array is invalid JSON, empty, or contains a row with a missing or invalid URL or blank text
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
- **AND** parsing or copying the prompt includes only those 80 jobs with their original URLs and text

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
