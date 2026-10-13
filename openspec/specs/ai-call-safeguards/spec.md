# ai-call-safeguards Specification

## Purpose

Protects the owner from duplicate or silently repeated paid AI calls: request ids per action, clear handling of the
API's safety errors, and an explicit confirmation before a retry that may be charged again.

## Requirements

### Requirement: One request id per user action

Every built-in AI request (Analyze ad from a link or pasted ad, quick add including collected-job batches, add
companies, profile CV import, each tailored CV section) SHALL carry a new `requestId` for each user action. The same
`requestId` SHALL be reused only when the user repeats the action after a transport failure (no API answer) with
unchanged input. The app SHALL NOT retry any AI request automatically, and the action's run control SHALL be
disabled while its request is running.

#### Scenario: Two clicks are two actions

- **WHEN** a parse succeeds and the user runs it again
- **THEN** the second request carries a different `requestId`

#### Scenario: Retry after a network failure

- **WHEN** a parse request fails without an API answer and the user retries with the same ad
- **THEN** the retry carries the same `requestId`

#### Scenario: Input changed

- **WHEN** a parse request fails without an API answer and the user edits the ad before retrying
- **THEN** the retry carries a new `requestId`

### Requirement: Safety errors

An `AiSafetyError` SHALL show its message where the action shows its other errors, and the user's input SHALL be
kept. For `daily-limit-reached` the error SHALL include a link to Settings. Whole-CV analysis SHALL stop at the first
`AiSafetyError`; collected-job batches SHALL pause there and send no further batch until the user chooses to retry,
skip or stop.

#### Scenario: Daily limit reached

- **WHEN** a Paste ad parse returns `AiSafetyError` with code `daily-limit-reached`
- **THEN** the modal shows the message with a link to Settings and keeps the ad

#### Scenario: Batch pauses

- **WHEN** a collected-job batch returns `AiSafetyError` with code `daily-limit-reached`
- **THEN** processing pauses with that message and a link to Settings, and no further batch is sent

### Requirement: Confirm a possibly charged retry

After an `AiSafetyError` with code `operation-interrupted` or `result-unavailable`, the action SHALL show a warning
that the previous attempt may already have been charged, and the next attempt SHALL require the user to choose
"Try again (may be charged)". That attempt SHALL use a new `requestId`. Other codes SHALL need no confirmation.

#### Scenario: Interrupted run

- **WHEN** a CV import parse returns `operation-interrupted`
- **THEN** a warning shows, the normal run button sends nothing, and only "Try again (may be charged)" sends a new
  request with a new `requestId`
