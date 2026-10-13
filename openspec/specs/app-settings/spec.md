# app-settings Specification

## Purpose

A general Settings page for account-level preferences. It holds the AI model section for everyone, plus the Owner-only
provider key and daily limit sections described by `ai-provider-keys`.

## Requirements

### Requirement: Settings page

The app SHALL have a `/settings` page titled "Settings", linked as "Settings" from the sidebar and the user menu. The
page SHALL be made of titled sections so other settings can be added. Every user SHALL see the "AI model" section
first; the Owner-only sections that follow are specified by `ai-provider-keys`.

#### Scenario: Navigate

- **WHEN** the user chooses Settings in the sidebar or the user menu
- **THEN** the Settings page opens with the "AI model" section

### Requirement: AI model section

The section SHALL show a select of the account's models plus a "Use app default" choice, preset to the saved default,
and a hint that it applies to every built-in AI action. Choosing a value SHALL save it immediately (`null` for the
app default) and confirm with a toast. A typed error SHALL show its message and restore the previous value. While
models load the section SHALL show a loading state; if loading fails it SHALL show the error. With a single model
the select SHALL still show, disabled. This section SHALL NOT depend on the user's role.

#### Scenario: Pick a model

- **WHEN** the user picks `Fast`
- **THEN** the default is saved, a confirmation shows, and the select shows `Fast`

#### Scenario: Use the app default

- **WHEN** the user picks "Use app default"
- **THEN** the API is asked to clear the default and the select shows the default it returns

#### Scenario: Save fails

- **WHEN** saving returns a typed error
- **THEN** its message is shown and the select returns to the previous model

#### Scenario: Models fail to load

- **WHEN** the models request fails
- **THEN** the section shows an error and no select

### Requirement: Built-in AI uses the saved default

Built-in AI actions (Analyze ad, quick add including collected-job batches, add companies, profile CV import, tailored
CV analysis) SHALL NOT offer a model choice and SHALL send no `model`. The profile page SHALL NOT show a model
section. The paid-AI notice SHALL name the default model's label (or "the app default" when none is saved) and link
to Settings.

#### Scenario: Run without a picker

- **WHEN** the user opens the Analyze ad modal
- **THEN** no model select shows and a parse request carries no model

#### Scenario: Notice

- **WHEN** the default is `Fast`
- **THEN** the notice says the run uses `Fast` and offers a link to Settings

### Requirement: Unknown default model

When a built-in AI action returns `UnknownLlmModelError`, the app SHALL show its message where that action shows its
other errors and re-fetch the models. Whole-CV analysis SHALL stop instead of sending the remaining sections. Nothing
SHALL retry automatically.

#### Scenario: Default removed on the server

- **WHEN** a Paste ad parse returns `UnknownLlmModelError` with "That model isn't available."
- **THEN** the modal shows that message, keeps the ad, and the models are re-fetched

#### Scenario: Whole-CV analysis stops

- **WHEN** the first section request returns `UnknownLlmModelError`
- **THEN** that section shows the message, no further section requests are sent, and the models are re-fetched
