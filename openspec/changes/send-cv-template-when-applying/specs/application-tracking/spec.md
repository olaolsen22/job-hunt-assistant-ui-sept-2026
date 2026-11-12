## ADDED Requirements

### Requirement: CV template when applying

The Record application dialog SHALL let the user send a saved CV template version as the CV
instead of an uploaded or tailored document. Only active (non-archived) templates that have at
least one saved version SHALL be offered. The user SHALL pick a template, then a language and a
version of it. The template's language SHALL default to the listing's posting language when the
template has a version in it, otherwise to the language of its newest version. The version SHALL
default to the newest in that language. The user SHALL be able to preview the chosen version's PDF
before submitting, and the preview SHALL NOT store a document. The document SHALL be created only
when the application is recorded and then sent as the application's CV. A retry after a failed
apply SHALL reuse the document already made for the same version. Choosing a template SHALL clear
any picked uploaded file or new upload, and the reverse. This path SHALL NOT create, read or change
the listing's tailored CV draft.

#### Scenario: Default language follows the posting language

- **WHEN** the listing's posting language is Norwegian and the user picks a template with English
  and Norwegian versions
- **THEN** Norwegian and its newest version are preselected

#### Scenario: Fallback when the posting language has no version

- **WHEN** the listing has no posting language, or the template has no version in it
- **THEN** the language of the template's newest version and that version are preselected

#### Scenario: Single-language template

- **WHEN** the picked template has versions in one language only
- **THEN** no language choice is shown and that language's newest version is preselected

#### Scenario: Archived templates are not offered

- **WHEN** the user has an archived template
- **THEN** it does not appear in the CV picker

#### Scenario: Recording with a template

- **WHEN** the user records the application with a template version chosen
- **THEN** a CV document is generated from that version for the listing, the application is
  recorded with that document as its CV, and the listing's documents refresh

#### Scenario: Generation fails

- **WHEN** the API returns an error while generating the document
- **THEN** the dialog stays open showing the API's message and no application is recorded

### Requirement: CV template origin on listing documents

A listing document made from a CV template SHALL show which template, language and version it came
from, as "CV template: <name> · <EN|NO> v<number>". This SHALL still show after the template is
archived. Tailored documents SHALL show "Tailored for this listing" and uploads "Uploaded".

#### Scenario: Template document label

- **WHEN** a listing has a document generated from version 3 of the English "Frontend" template
- **THEN** it is labelled "CV template: Frontend · EN v3"

#### Scenario: Archived template

- **WHEN** that template is archived later
- **THEN** the document keeps the same label
