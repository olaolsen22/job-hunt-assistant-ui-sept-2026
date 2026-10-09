# profile-translations Specification

## Purpose

Lets the owner keep their profile in a second language: choose the language the profile is written in, and translate the headline, summary and bullets into the other one.

## Requirements

### Requirement: Content language

The profile page SHALL show the profile's content language and let the owner change it only while no translation (profile-level or bullet-level) exists.

#### Scenario: No translations

- **WHEN** the profile has no translations
- **THEN** the content language can be changed and the new value is saved

#### Scenario: Translations exist

- **WHEN** any profile or bullet translation exists
- **THEN** the language picker is disabled with the hint "Delete all translations before changing the content language."

#### Scenario: API rejects the change

- **WHEN** saving returns an `InvalidProfileError`
- **THEN** its message is shown and the language is unchanged

### Requirement: Target language

Translations SHALL always be in the language that is not the content language; the content language is never offered as a target.

#### Scenario: Norwegian profile

- **WHEN** the content language is Norwegian
- **THEN** all translation controls target English

### Requirement: Bullet translations

In Translations mode, every bullet of experiences, educations, certifications and projects SHALL show its translation in the target language and allow adding, editing and deleting it, with text limited to 500 characters.

#### Scenario: Add a translation

- **WHEN** the owner enters text for a bullet without a translation and saves
- **THEN** the translation is saved and shown under the bullet

#### Scenario: Edit and delete

- **WHEN** the owner edits or deletes an existing bullet translation
- **THEN** the change is saved and the page shows the result

#### Scenario: Unknown id

- **WHEN** the API returns `ProfileEntryNotFoundError`
- **THEN** the error is shown and the profile is reloaded

### Requirement: Headline and summary translation

In Translations mode the owner SHALL be able to save a translation of the headline (max 200 characters) and summary (max 10,000 characters) together, and delete it.

#### Scenario: Save both fields

- **WHEN** the owner saves the translation after editing only one field
- **THEN** both the headline and the summary are sent, the untouched one with its current value

#### Scenario: Missing source

- **WHEN** the API returns `InvalidProfileError` because a field has no source on the profile
- **THEN** the error message is shown and the entered text is kept

#### Scenario: Delete

- **WHEN** the owner confirms deleting the profile translation
- **THEN** the headline and summary translation are removed

### Requirement: Stale and machine indicators

A translation SHALL show a "stale" badge when `isStale`, `isHeadlineStale` or `isSummaryStale` is true, together with the previous original text next to the current one; a "machine" badge SHALL show only when `isMachine` is true. Saving the translation again clears the stale state.

#### Scenario: Stale bullet

- **WHEN** a bullet translation is stale
- **THEN** the badge is shown and the previous original (`sourceText`) can be compared with the current text

#### Scenario: Not machine

- **WHEN** `isMachine` is false
- **THEN** no machine badge is shown

### Requirement: Untranslatable fields

Titles, degrees, entry names, references and hobbies SHALL NOT offer translation controls.

#### Scenario: Entry header

- **WHEN** Translations mode is on
- **THEN** only bullets and the headline/summary have translation controls
