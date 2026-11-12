# Spec Delta

## Purpose

Lets the owner keep reusable CV templates (the API's base CVs). Each template is a CV for one kind of role, in one or
more languages, and each language has numbered, immutable versions. A template is sent as it is from a listing's
Apply dialog.

## ADDED Requirements

### Requirement: Template list

`/cv-templates` SHALL list templates in one full-width column at every screen width. Each row SHALL show:

- the name
- one chip per language with its latest version number
- when it was last updated
- the description, up to two lines

Active and Archived SHALL be tabs, kept in the URL. "New CV template" SHALL go to `/cv-templates/new` without a dialog.
Each row SHALL offer Archive or Restore, and Delete.

#### Scenario: New template

- **WHEN** the owner clicks New CV template
- **THEN** the create page opens, and nothing is created

### Requirement: Unsaved creation

The create page SHALL ask for the name (required), description and language once, in a Details card. Content SHALL
start empty, with two choices: Draft with my AI and Start from my profile. Nothing SHALL be created until the owner
clicks Create template, which saves the content as v1 of that language and opens the template's editor. A duplicate
name SHALL show on the name field with a link to the existing template. Leaving with unsaved content SHALL ask first.

#### Scenario: Start from profile

- **WHEN** the owner picks Start from my profile
- **THEN** the editor fills with the profile in the chosen language, unsaved

#### Scenario: Create

- **WHEN** the owner has a name and content and clicks Create template
- **THEN** the template is created with v1, and its editor opens

#### Scenario: Duplicate name

- **WHEN** the API reports a duplicate name
- **THEN** the error shows on the name field with a link to the existing template, and nothing is created

### Requirement: Template editor

`/cv-templates/[id]` SHALL show:

- the template's name and description
- Versions and Preview PDF
- a menu with Edit details (name and description), Archive or Restore, and Delete

Each language SHALL be a tab. Saving changed content SHALL create that language's next version, with an optional
note, and unchanged content SHALL keep the latest version. CV style, entry format and PDF layout SHALL be set only in
the editor's Layout card. Edits SHALL change the template only, never the profile. Replace with my profile SHALL load
the profile as an unsaved change, and SHALL ask first when there are unsaved edits. Delete of a template whose version
was already sent SHALL offer Archive instead.

#### Scenario: Save a version

- **WHEN** the owner edits the English content and saves
- **THEN** a new English version is created, and the tab shows its number

### Requirement: Languages

"+ Add language" SHALL offer each missing language as Translate (from an existing language) or Draft with my AI. The
new language SHALL open as an unsaved tab, and saving it SHALL create that language's v1. A translated language SHALL
flag the parts that are still in the source language, with Next untranslated. Switching tabs with unsaved edits SHALL
ask first.

#### Scenario: Draft a new language with AI

- **WHEN** the owner picks Add Norwegian, then Draft with my AI
- **THEN** a Norwegian tab opens unsaved, and the AI dialog drafts Norwegian

### Requirement: Status banner

The editor SHALL show at most one status banner, picking the first that applies: invalid content (with Replace with
my profile), then pending AI suggestions, then an untranslated draft language.

#### Scenario: Suggestions over translation

- **WHEN** a translated draft language also has pending AI suggestions
- **THEN** only the suggestions banner shows

### Requirement: Preview and versions

Preview PDF SHALL never be disabled. With unsaved edits it SHALL read "Preview last saved", because only saved
versions render. Versions SHALL list each version of the current language with its number, date and note, and a
Preview for each.

#### Scenario: Preview while editing

- **WHEN** the owner has unsaved edits and clicks Preview last saved
- **THEN** the latest saved version's PDF opens

### Requirement: AI draft review

The AI dialog SHALL take a target role, notes and "Rewrite in plain words", and SHALL show the CV style read-only from
the Layout card. A previewed reply SHALL be offered as suggestions against the current content. On a new template,
the current content is the profile. The rules for offering a reply:

- Experience, education and project entries SHALL be compared per entry, each with its own current and suggested
  content and Accept and Dismiss on that entry's card.
- An entry the reply leaves out SHALL get a removal suggestion. Dismiss keeps the entry.
- The whole list SHALL be one suggestion only when the reply adds entries or changes their order, and the banner SHALL
  say why.
- When there is no content to compare against, the reply SHALL load directly, with a check-your-bullets banner.

The banner SHALL show the pending count, with Next, Accept all and Dismiss all, and Dismiss all asks first. Saving
SHALL never be blocked by pending suggestions; the save bar SHALL show how many are not applied.

#### Scenario: Accept one company

- **WHEN** a reply changes two experiences and the owner accepts the first
- **THEN** only the first experience changes, and the second still shows its suggestion

#### Scenario: Left-out entry

- **WHEN** the reply leaves out one experience and the owner dismisses its removal suggestion
- **THEN** the experience stays in the template

#### Scenario: Save with pending suggestions

- **WHEN** two suggestions are pending and the owner saves
- **THEN** the version saves without them, and the save bar no longer shows unsaved changes
