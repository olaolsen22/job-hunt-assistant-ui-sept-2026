# tailored-cv-drafts Specification

## Purpose

Lets the owner build, review, edit and save a CV draft tailored from the master profile to one listing, using
built-in or external AI. The owner explicitly saves every change.

## Requirements

### Requirement: Draft editor page

The app SHALL provide a full page at `/listings/[id]/cv`. It SHALL load the listing's draft and the profile. On
phones the sections SHALL be stacked. The section order SHALL be contact details and headline, summary, experience,
skills, then education, certifications, projects and languages. When the listing is missing or not owned, the page
SHALL show the API error and a link back to the listings.

#### Scenario: Open with a saved draft

- **WHEN** the owner opens the page for a listing that has a draft
- **THEN** the editor shows the saved draft content and no analysis starts

### Requirement: Starting candidate

With no saved draft, the editable candidate SHALL start from the profile: contact fields, headline, links, summary,
every experience, education, certification and project with all bullets, every skill and every language. Each item
SHALL keep its profile source id. Every field SHALL be editable, including the contact fields.

#### Scenario: Contact fields are prefilled

- **WHEN** a new candidate is created
- **THEN** full name, email, phone and location come from the profile and can be edited

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

### Requirement: AI results as suggestions

AI results fill the candidate directly only while there is no saved draft and no edits. When a draft is saved or the
candidate has edits, results SHALL appear as suggestions that show the current and the suggested content, with Accept
and Dismiss. A whole-CV result SHALL be split as follows:

- Experience, education and project entries SHALL be compared per entry, so each entry (each company, for
  experience) gets its own suggestion on its own card.
- An entry the result leaves out SHALL get a removal suggestion.
- A list SHALL be offered as one suggestion only when the result adds entries or changes their order.

Accept SHALL replace that section or entry in the candidate only, and Dismiss SHALL leave it unchanged.

#### Scenario: Dismiss keeps edits

- **WHEN** the owner dismisses a suggestion for an experience they edited
- **THEN** the experience keeps the owner's edits

#### Scenario: Per-company suggestions

- **WHEN** an external whole-CV reply changes the bullets of two experiences and keeps their order
- **THEN** each of the two experience cards shows its own suggestion, and no "All experience" suggestion appears

#### Scenario: Reordered entries

- **WHEN** an external whole-CV reply changes the order of the experiences
- **THEN** the experience list is offered as one suggestion

### Requirement: External AI path

The external choice SHALL let the owner copy the API's prompt, then paste JSON and preview it. The API has one
whole-CV prompt, so a section's external choice copies the same prompt and takes only that section from the reply. A
successful preview SHALL be offered to the candidate under the same rule as built-in results. The candidate SHALL
keep the current contact fields, because the external prompt leaves them out. Preview errors SHALL be shown inline,
and nothing SHALL be saved.

#### Scenario: Invalid JSON

- **WHEN** the API rejects the pasted JSON
- **THEN** the error is shown, and the candidate is unchanged

### Requirement: Saving

Save draft SHALL send the complete candidate, including contact fields and every section. While there are unsaved
changes, the Save draft button SHALL stay visible and the page SHALL show that changes are unsaved. On success, the
editor SHALL show the saved state. API errors SHALL be shown, and the edits SHALL be kept. Leaving the page with
unsaved changes SHALL ask for confirmation. Closing or reloading the tab while analysis runs or changes are unsaved
SHALL trigger the browser's leave-page warning.

#### Scenario: Leave with unsaved changes

- **WHEN** the owner navigates away with unsaved changes
- **THEN** a confirmation asks before leaving, and canceling stays on the page with edits intact

#### Scenario: Close the tab after analysis

- **WHEN** analysis is running, or the candidate is not saved, and the owner closes or reloads the tab
- **THEN** the browser shows its leave-page warning

### Requirement: Copy as text

"Copy as text" SHALL copy the draft as readable plain text with the headings in section order. If copying fails, the
UI SHALL say so.

#### Scenario: Copy

- **WHEN** the owner chooses Copy as text
- **THEN** the clipboard holds the draft as plain text, and the UI confirms it was copied

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
