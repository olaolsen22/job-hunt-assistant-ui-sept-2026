# Spec Delta

## MODIFIED Requirements

### Requirement: Built-in analysis

For the whole CV, built-in analysis SHALL run one section request at a time in the API's order: each experience,
then each education entry, then skills, then summary, while a blurred full-screen overlay shows a loading animation and step text, such as "Analyzing experience 2
of 4". When a section succeeds, its selected bullets, selected skills or summary SHALL be offered to the candidate.
When a section is `FAILED` or `SKIPPED`, or its request errors, its message SHALL be shown inline in that section
together with the result's `errorCode` when present, the section SHALL keep its content and earlier suggestions, and
the remaining sections SHALL still run. When a section returns an `AiSafetyError`, the analysis SHALL stop and send no
further section requests. Nothing SHALL be saved.

#### Scenario: One section fails

- **WHEN** the analysis of one experience returns FAILED or the request errors
- **THEN** that experience shows the error and keeps its bullets, and the other sections are analyzed

#### Scenario: Skipped section shows its code

- **WHEN** the skills section returns SKIPPED with error "No skills to match" and errorCode `no-input`
- **THEN** the skills section shows the message and `no-input`, and the summary is still analyzed

#### Scenario: Safety error stops analysis

- **WHEN** the second section returns `AiSafetyError` with code `daily-limit-reached`
- **THEN** that section shows the message, the first section's suggestions stay, and no further section request is sent

#### Scenario: Analysis does not save

- **WHEN** analysis completes
- **THEN** the overlay closes, the candidate shows unsaved changes, and no save request has been sent
