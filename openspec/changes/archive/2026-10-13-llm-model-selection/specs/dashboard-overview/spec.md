# Spec Delta

## MODIFIED Requirements

### Requirement: LLM usage widget

The LLM usage widget SHALL show today's LLM request count, the input and output token totals and when the count resets
(local time). When the API reports a daily limit it SHALL also show the remaining requests and a progress bar; without
a limit it SHALL show only the count. The numbers are for the user's current default model, whose label SHALL be
shown next to the count (the model id when the label is unknown). It has no link out.

#### Scenario: With a limit

- **WHEN** 120 requests were made today and the limit is 500
- **THEN** the widget shows 120 of 500, 380 remaining, a progress bar, the token totals and the reset time

#### Scenario: No limit

- **WHEN** the API reports no daily limit
- **THEN** the widget shows the request count and tokens, without a bar or remaining count

#### Scenario: Model label

- **WHEN** the usage is for model `fast` labelled `Fast`
- **THEN** the widget shows `Fast` next to the request count

#### Scenario: Default changed

- **WHEN** the user saves a new default model
- **THEN** the widget re-fetches and shows the new model's usage and label
