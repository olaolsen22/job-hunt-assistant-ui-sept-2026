# Spec Delta

## Purpose

Lets the user see and maintain their own profile: who they are, what work they want, and their
experience, education, certifications, projects, skills and languages. It is the base for matching
listings and writing applications later.

## ADDED Requirements

### Requirement: Profile page

`/profile` SHALL load the whole profile with one request and show it as section cards: header,
Summary, Preferences, Experience, Projects, Education, Skills, Languages and Certifications. The
sidebar nav and the user menu SHALL link to it. While loading it SHALL show a skeleton, and a failed
load SHALL show the generic error.

#### Scenario: Opening the profile

- **WHEN** the user clicks Profile in the sidebar
- **THEN** `/profile` shows every section filled from the profile

#### Scenario: Load fails

- **WHEN** the profile request fails
- **THEN** the page shows the generic error message instead of the sections

### Requirement: Empty sections

A section with no content SHALL show a centered muted icon, a short message and an "Add …" action
that opens that section's add form. A new user's profile, where every field is empty, SHALL render
without errors.

#### Scenario: No experience yet

- **WHEN** the profile has no experiences
- **THEN** the Experience card shows the empty message and an "Add experience" button

### Requirement: Basics

The header SHALL show full name, headline, email, phone, location and links (opening in a new tab),
and the Summary card SHALL render the summary as Markdown. One Basics form SHALL edit all of these,
including up to 10 links (label + URL) and a location of country plus optional city. Saving SHALL send
every field, and the page SHALL show the returned profile without another request.

#### Scenario: Editing the headline

- **WHEN** the user changes the headline in the Basics form and saves
- **THEN** the header shows the new headline and every other basic field keeps its value

#### Scenario: Link limit

- **WHEN** the form already has 10 links
- **THEN** "Add link" is disabled

#### Scenario: Blank rows are ignored

- **WHEN** the user adds a link row, leaves it empty and saves
- **THEN** the profile is saved without that link

#### Scenario: Changing the country

- **WHEN** the user changes the location's country
- **THEN** the city is cleared

#### Scenario: Clearing the location

- **WHEN** the user clears the country and saves
- **THEN** the profile is saved without a location

### Requirement: Preferences

The Preferences card SHALL show job roles, work modes, employment types, minimum salary with
currency, and notice period in months. One Preferences form SHALL edit them all. Job roles can be
picked from existing ones or typed as new names. Saving SHALL send every field, and the page SHALL
show the returned profile without another request.

#### Scenario: Adding a new job role

- **WHEN** the user types a job role that doesn't exist yet, adds it and saves
- **THEN** the role appears in the Preferences card

#### Scenario: Salary without currency

- **WHEN** the user enters a minimum salary with no currency and saves
- **THEN** the API's message is shown and the form stays open with the input kept

#### Scenario: Notice period range

- **WHEN** the user edits the notice period
- **THEN** only whole values from 0 to 12 can be entered

### Requirement: Target locations

The Preferences card SHALL list the user's target locations. The user SHALL be able to add one
(country plus optional city) and remove one, each saved right away. Adding or removing one SHALL also
change its Preferred mark on company pages.

#### Scenario: Adding a target location

- **WHEN** the user adds Oslo, Norway as a target location
- **THEN** it appears in the target locations list

#### Scenario: Removing a target location

- **WHEN** the user removes a target location
- **THEN** it disappears from the list

### Requirement: Profile entries

Experience, Education, Certifications and Projects SHALL each list their entries in the order the API
returns. The user SHALL be able to add, edit and delete one entry at a time. Delete asks for
confirmation first. Editing SHALL open the form filled with the entry, and saving SHALL send the whole
entry. Saving an entry SHALL NOT change its bullets.

#### Scenario: Adding an experience

- **WHEN** the user adds an experience with employer, title, start month and skills
- **THEN** it appears in the Experience list with its date range and skills

#### Scenario: Deleting a certification

- **WHEN** the user deletes a certification and confirms
- **THEN** it disappears from the Certifications list

#### Scenario: Entry deleted elsewhere

- **WHEN** the user saves or deletes an entry that no longer exists
- **THEN** the API's message is shown and the profile is reloaded

### Requirement: Entry fields

The Experience form SHALL edit employer, title, start month, end month or "current", and skills. The
Education form SHALL edit school, degree, field, start month and end month. The Certifications form
SHALL edit name, issuer, issued month, expiry month and URL. The Projects form SHALL edit name, URL,
optional start and end month, and skills.

#### Scenario: Current job

- **WHEN** the user ticks "Current" on an experience
- **THEN** the end month is cleared and disabled, and the saved entry shows "– Present"

#### Scenario: Skills on an entry

- **WHEN** the user tags an experience with an existing skill and a new one
- **THEN** both show on that experience after saving

### Requirement: Entry bullets

Every experience, education, certification and project SHALL show its bullets as plain text, in the
order the API returns. The user SHALL be able to add, edit, delete and drag to reorder bullets on the
entry's card. Each change is saved right away. An entry SHALL have at most 20 bullets.

#### Scenario: Adding a bullet

- **WHEN** the user adds the text "Led a team of 4" to an experience
- **THEN** it appears as the last bullet on that experience

#### Scenario: Bullets on every kind

- **WHEN** the user adds a bullet to a certification
- **THEN** it appears on that certification

#### Scenario: Editing a bullet

- **WHEN** the user edits a bullet's text and saves
- **THEN** the bullet shows the new text in the same position

#### Scenario: Reordering

- **WHEN** the user drags the third bullet to the top
- **THEN** it is first, and the list stays in that order after the profile reloads

#### Scenario: Deleting a bullet

- **WHEN** the user deletes a bullet
- **THEN** it disappears and the others keep their order

#### Scenario: Bullet limit

- **WHEN** an entry already has 20 bullets
- **THEN** "Add bullet" is disabled

#### Scenario: Rejected text

- **WHEN** the user saves a blank or over-long bullet and the API rejects it
- **THEN** the API's message is shown and the typed text stays in the field

#### Scenario: New entry

- **WHEN** the user has just added an entry
- **THEN** it has no bullets and the user can add them from its card

### Requirement: Month values

Every entry date SHALL be picked as a month and year. It SHALL be sent as the first day of that month,
and shown as short month plus year in the same locale as other dates in the app. A range with no end SHALL read
"Present" for experience and education, and show just the start for undated-end projects.

#### Scenario: Half-cleared month

- **WHEN** the user clears only the year of an entry's start month
- **THEN** the form can't be saved until a full month is picked again

#### Scenario: Picking a start month

- **WHEN** the user picks March 2021 as a start month and saves
- **THEN** the API receives `2021-03-01` and the entry shows March 2021 as a short month and year

### Requirement: Skills

The Skills card SHALL list skills in API order with name, level out of 5, and years of experience
derived from the experiences tagged with that skill. The user SHALL be able to add a skill (existing
or new name) with a level, change a level, and remove a skill. Each change is saved right away.
Removing a skill SHALL NOT remove it from entries.

#### Scenario: Years of experience

- **WHEN** a skill has 30 months of tagged experience
- **THEN** it shows "2.5 yrs"

#### Scenario: Less than a year

- **WHEN** a skill has under 12 months of tagged experience
- **THEN** it shows "<1 yr"

#### Scenario: No tagged experience

- **WHEN** no experience is tagged with a skill
- **THEN** no years are shown for it

#### Scenario: Changing a level

- **WHEN** the user changes a skill's level from 3 to 4
- **THEN** the list shows level 4 for that skill

### Requirement: Languages

The Languages card SHALL list languages in API order with their CEFR level (A1–C2). The user SHALL be
able to add a language not yet listed, change a listed language's level (not the language itself), and
remove a language. Each change is saved right away. Adding SHALL be hidden once every supported
language is listed.

#### Scenario: Adding a language

- **WHEN** the user adds Norwegian at B2
- **THEN** the Languages card shows "Norwegian · B2"

#### Scenario: All languages listed

- **WHEN** both English and Norwegian are listed
- **THEN** there is no way to add another language

### Requirement: Save errors

When a profile save fails, the page SHALL show the API's message, keep the open form and the user's
input, and not change the shown profile.

#### Scenario: Invalid basics

- **WHEN** the API rejects the Basics form with a validation message
- **THEN** that message is shown and the form stays open with the input kept
