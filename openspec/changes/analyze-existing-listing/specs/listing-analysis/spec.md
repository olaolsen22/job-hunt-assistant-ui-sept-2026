# Spec Delta

## Purpose

Lets the user fill in an existing listing's details from its ad text, merged with what is already saved,
and review the result before saving.

## ADDED Requirements

### Requirement: Parse an ad on the edit page

The edit listing page SHALL offer the same ad parser as the add page (built-in parser or copy-paste prompt).
Applying a parse result SHALL update the form only; the listing SHALL NOT be saved until the user saves the form.

#### Scenario: Applying a parse result

- **WHEN** the user opens the parser on the edit page, parses an ad, and applies the result
- **THEN** the form shows the merged values, a success toast says the form was filled from the ad, and nothing is saved yet

#### Scenario: Saving after a parse

- **WHEN** the user then saves the form
- **THEN** the merged listing is sent with the normal save and the user lands on the listing page

#### Scenario: Cancelling

- **WHEN** the user closes the parser without applying a result
- **THEN** the form is unchanged

### Requirement: Parsed values win over saved values

When a parse result is applied to an existing listing, each field the parse filled SHALL replace the saved value,
and each field the parse left empty or invalid SHALL keep the saved value. The listing URL SHALL always keep
the saved value.

#### Scenario: Parse has a value

- **WHEN** the listing has seniority Mid and the parse returns Senior
- **THEN** the form shows Senior

#### Scenario: Parse is missing a value

- **WHEN** the listing has a description and posted date and the parse returns neither
- **THEN** the form keeps the saved description and posted date

#### Scenario: Unspecified deadline in the parse

- **WHEN** the listing has a dated deadline and the parse returns no deadline or an unspecified one
- **THEN** the form keeps the saved deadline type and date

#### Scenario: URL

- **WHEN** a parse result is applied
- **THEN** the form keeps the listing's saved URL

### Requirement: Parsed lists replace saved lists

Skills, languages, and locations SHALL be replaced by the parsed rows when the parse returned at least one valid
row for that list, and SHALL keep the saved rows otherwise.

#### Scenario: Parse returns skills

- **WHEN** the listing has skills A and B and the parse returns skill C
- **THEN** the form's skills are only C

#### Scenario: Parse returns no locations

- **WHEN** the listing has a location and the parse returns no valid locations
- **THEN** the form keeps the saved location

### Requirement: Applied parse marks the listing analyzed

Applying a parse result on the edit page SHALL mark the listing as analyzed, so saving it records it as analyzed.

#### Scenario: Unanalyzed listing

- **WHEN** an unanalyzed listing gets a parse result applied and is saved
- **THEN** the listing shows as analyzed

### Requirement: New names are flagged

After a parse result is applied on the edit page, names the API does not know yet (company, role, skills, places)
SHALL be flagged in the form, as on the add page.

#### Scenario: Unknown company in the parse

- **WHEN** the parse returns a company name that does not exist yet
- **THEN** the company field flags it as new

### Requirement: Analyze from the listing page

The listing detail page SHALL have an "Analyze" action that opens the edit page with the parser already open.

#### Scenario: Starting from the detail page

- **WHEN** the user clicks "Analyze" on a listing
- **THEN** the edit page for that listing opens with the form loaded and the parser open
