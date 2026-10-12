# Spec Delta

## MODIFIED Requirements

### Requirement: Choosing how to use AI

The editor SHALL never run AI on its own. A "Whole CV" AI button at the top of the editor, and an AI button on the
summary, skills, each experience and each education entry, SHALL open the AI dialog for that scope (the whole CV, or
that section). The built-in choice SHALL show today's AI token and request usage and how many AI requests it will make
before the owner starts it. The external choice SHALL offer the prompt as one copy-to-clipboard action, with the
prompt also viewable for manual copying.

#### Scenario: Opening the editor runs nothing

- **WHEN** the owner clicks Tailor CV on the listing
- **THEN** the editor opens prefilled from the profile and no AI request is sent

#### Scenario: Section AI button

- **WHEN** the owner clicks the AI button on the skills section
- **THEN** the dialog opens for skills only, and built-in runs a single skills request

#### Scenario: Whole CV button

- **WHEN** the owner clicks Whole CV
- **THEN** the dialog opens for the whole CV and states how many requests built-in AI will make

### Requirement: Built-in analysis

For the whole CV, built-in analysis SHALL run one section request at a time in the API's order: each experience,
then each education entry, then skills, then summary. While it runs, the page SHALL stay readable and scrollable, a
progress line at the top SHALL show step text such as "Analyzing experience 2 of 4", and the editor's fields and
actions SHALL be disabled. When a section succeeds, its selected bullets, selected skills or summary SHALL be offered
to the candidate. When a section fails, its error SHALL be shown inline in that section, and the remaining sections
SHALL still run. Nothing SHALL be saved.

#### Scenario: One section fails

- **WHEN** the analysis of one experience returns FAILED or the request errors
- **THEN** that experience shows the error and keeps its bullets, and the other sections are analyzed

#### Scenario: Analysis does not save

- **WHEN** analysis completes
- **THEN** the progress line disappears, the fields are enabled again, the candidate shows unsaved changes, and no
  save request has been sent

#### Scenario: Page stays readable during analysis

- **WHEN** whole-CV analysis is running
- **THEN** no full-screen overlay covers the page, the owner can scroll, and fields, Save draft and Generate PDF are
  disabled

## ADDED Requirements

### Requirement: Remembered AI choice

The AI dialog SHALL remember whether the owner last used built-in or external AI, across visits in the same browser.
On later opens, it SHALL start on that choice and show it as a one-line summary with the request count and a Change
action instead of the tabs. Today's usage SHALL still be shown before built-in runs. Change SHALL show both choices
again.

#### Scenario: Second section run

- **WHEN** the owner used built-in AI before and clicks the AI button on the summary
- **THEN** the dialog shows "Built-in AI · 1 request" with usage and Change, and one click on Analyze runs it

#### Scenario: Switch to external

- **WHEN** the owner clicks Change and picks external AI
- **THEN** the dialog shows the copy-prompt and paste steps, and later opens start on external AI

### Requirement: Pending suggestions banner

While AI suggestions are pending, the editor SHALL show one banner at the top with their count, Accept all, Dismiss
all and Next. Next SHALL scroll to the next section that has a pending suggestion. The per-section Accept and Dismiss
SHALL remain. The banner SHALL disappear once no suggestions are pending.

#### Scenario: Accept all

- **WHEN** three suggestions are pending and the owner clicks Accept all
- **THEN** all three sections take the suggested content, the banner disappears, and the candidate shows unsaved
  changes

#### Scenario: Next suggestion

- **WHEN** the owner clicks Next
- **THEN** the page scrolls to the next section with a pending suggestion, wrapping to the first after the last
