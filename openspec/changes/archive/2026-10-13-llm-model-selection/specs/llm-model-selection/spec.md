# Spec Delta

## Purpose

Lets the owner or a guest see which LLM models their account may use, save a default model, and choose a different
model for one built-in AI action, with the server deciding what each account gets.

## ADDED Requirements

### Requirement: Available models

The app SHALL load the account's models and default model from the API and use the same UI for every role. Every
model picker and the default-model section SHALL show only when the account has more than one model; no UI SHALL
depend on the user's role.

#### Scenario: Several models

- **WHEN** the API returns three models with a default of `b`
- **THEN** the pickers list the three labels with `b` selected

#### Scenario: Only one model

- **WHEN** the API returns a single model
- **THEN** no model picker and no AI model section on the profile page are shown, and AI actions still run

#### Scenario: Models fail to load

- **WHEN** the models request fails
- **THEN** the pickers are hidden and AI actions still run with the user's default

### Requirement: Default model setting

The profile page SHALL show an "AI model" section with the current default model's label and an Edit action. The
edit modal SHALL let the user pick one of the listed models, or reset to the app default, and save it. On success
the section and every picker SHALL show the returned default, and today's usage SHALL be re-fetched. A typed error
SHALL show its message and keep the modal open.

#### Scenario: Save a new default

- **WHEN** the user picks `Fast` and saves
- **THEN** the default is saved, the section shows `Fast`, and the usage is re-fetched

#### Scenario: Reset to the app default

- **WHEN** the user chooses to reset to the app default
- **THEN** the API is asked to clear the default, and the section shows the default it returns

#### Scenario: Unknown model on save

- **WHEN** saving returns `UnknownLlmModelError`
- **THEN** its message is shown, the modal stays open, and the models are re-fetched

### Requirement: Model for one AI action

Each built-in AI action SHALL offer a "Model" picker next to its run button: the Analyze ad modal's From link and
Paste ad, quick add (single ads and collected-job batches), add companies, the profile CV import's built-in parse, and the tailored CV built-in analysis.
The picker SHALL start at the default each time it opens. A model other than the default SHALL be sent with the
request; the default SHALL be sent as no model.

#### Scenario: Default kept

- **WHEN** the user runs Paste ad without changing the picker
- **THEN** the parse request carries no model

#### Scenario: Another model picked

- **WHEN** the user picks `Strong` in the tailored CV AI modal and analyzes the whole CV
- **THEN** every section request carries the `Strong` model id

#### Scenario: Reopened

- **WHEN** the user picked `Strong`, closed the modal, and opens it again
- **THEN** the picker shows the default again

### Requirement: Unknown model error

When any built-in AI action returns `UnknownLlmModelError`, the app SHALL show its message where that action shows
its other errors, re-fetch the models, and reset the picker to the returned default. No other retry SHALL happen
automatically.

#### Scenario: Model removed on the server

- **WHEN** a Paste ad parse returns `UnknownLlmModelError` with "That model isn't available."
- **THEN** the modal shows that message, keeps the ad, re-fetches the models, and the picker shows the new default

#### Scenario: Whole-CV analysis stops

- **WHEN** the first section request of a whole-CV analysis returns `UnknownLlmModelError`
- **THEN** that section shows the message, no further section requests are sent, and the models are re-fetched

#### Scenario: Collected-job batch

- **WHEN** a quick add batch returns `UnknownLlmModelError`
- **THEN** the run pauses with the message, the picker resets to the default, and Retry runs the batch without a model

### Requirement: Usage notice names the model

The paid-AI notice in the AI modals SHALL show the label of the model the usage counts (the user's default) next to
the request count. When the picker holds a different model, it SHALL say the counts are for the default model, not
the picked one.

#### Scenario: Different model picked

- **WHEN** usage counts `Fast` and the user picks `Strong`
- **THEN** the notice shows `Fast` with the counts and says this run uses `Strong`, whose usage isn't shown
