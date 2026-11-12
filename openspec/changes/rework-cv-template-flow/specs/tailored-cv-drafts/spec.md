# Spec Delta

## MODIFIED Requirements

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
