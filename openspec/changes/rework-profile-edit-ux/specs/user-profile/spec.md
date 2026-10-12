# Spec Delta

## ADDED Requirements

### Requirement: Profile form behaviour

Every profile add/edit form SHALL save when the user presses Enter in a single-line field. When the
user tries to save with a required field missing or incomplete, the form SHALL show an inline error
on that field and move focus to it, without sending a request. If the form has unsaved changes,
closing it (Cancel, close button, Escape or clicking outside) SHALL ask the user to confirm discarding
them. On phones, a form SHALL use the full screen height, and Save SHALL stay reachable.

#### Scenario: Enter saves

- **WHEN** the user edits an experience's title and presses Enter in that field
- **THEN** the experience is saved and the form closes

#### Scenario: Missing required field

- **WHEN** the user clicks Save on a new experience with no employer
- **THEN** no request is sent, the Employer field shows an error, and the field has focus

#### Scenario: Closing with unsaved changes

- **WHEN** the user changes the headline and presses Escape
- **THEN** a "Discard changes?" confirmation appears, and the form stays open with the input kept
  unless the user confirms

#### Scenario: Closing an unchanged form

- **WHEN** the user opens a form, changes nothing and presses Escape
- **THEN** the form closes without asking

#### Scenario: Typed but not added name

- **WHEN** the user types a hobby, does not press Add, and saves
- **THEN** the typed hobby is saved along with the others

### Requirement: Consistent remove actions

Every removal on the profile page SHALL ask for confirmation first. This covers entries, bullets,
skills, languages, references and target locations. Every item that can be removed SHALL use the same
remove icon.

#### Scenario: Removing a language

- **WHEN** the user chooses Remove on a language
- **THEN** a confirmation names the language, and the language is removed only after the user
  confirms

#### Scenario: Deleting a bullet

- **WHEN** the user deletes a bullet in an entry form
- **THEN** it is removed only after the user confirms

### Requirement: CV review on phones

On phones, the CV import modal SHALL use the full screen height. Its Save and Cancel actions SHALL
stay visible while the user scrolls the review, even when an error message or the status line is
showing.

#### Scenario: Long review on a phone

- **WHEN** the user scrolls a long CV review on a phone-sized screen
- **THEN** Save import and Cancel stay visible at the bottom of the modal

## MODIFIED Requirements

### Requirement: Profile page

`/profile` SHALL load the whole profile with one request and show it as a read-first CV. A header
SHALL show identity, contact and links, with Edit details and Import CV as its actions. Below the
header, a compact row SHALL hold the content language and the translate toggle. The main column SHALL
show Summary, Experience, Projects, Education and References. The side column SHALL show Skills,
Languages, Hobbies, Certifications, then Preferences last. Cards SHALL NOT show inline edit inputs
outside translation mode. The sidebar nav and the user menu SHALL link to the page. While loading it
SHALL show a skeleton, and a failed load SHALL show the generic error.

#### Scenario: Opening the profile

- **WHEN** the user clicks Profile in the sidebar
- **THEN** `/profile` shows every section filled from the profile

#### Scenario: Load fails

- **WHEN** the profile request fails
- **THEN** the page shows the generic error message instead of the sections

#### Scenario: Read view

- **WHEN** the profile has experiences with bullets and translation mode is off
- **THEN** the Experience card shows each entry's bullets as plain text, with no drag handles, inputs
  or per-bullet buttons

#### Scenario: Preferences last

- **WHEN** the page is shown on a wide screen
- **THEN** Preferences is the last card in the side column, after Certifications

### Requirement: Basics

The header SHALL show full name, headline, email, phone, location and links (opening in a new tab),
and the Summary card SHALL render the summary as Markdown. Three forms SHALL edit these fields:

- Details: name, headline, email, phone, location, date of birth, nationality, work authorization
  and up to 10 links, under group headings.
- Summary: the summary.
- Hobbies: the hobbies.

Each form SHALL send the whole profile. Fields the form doesn't show SHALL be sent with their current
values. The page SHALL show the returned profile without another request.

#### Scenario: Editing the headline

- **WHEN** the user changes the headline in the Details form and saves
- **THEN** the header shows the new headline and every other basic field keeps its value

#### Scenario: Editing the summary

- **WHEN** the user clicks Edit summary, changes the text and saves
- **THEN** only the Summary form was shown, the card shows the new summary, and the details and
  hobbies are unchanged

#### Scenario: Adding hobbies

- **WHEN** the user clicks Add hobbies on an empty Hobbies card, adds "Climbing" and saves
- **THEN** the Hobbies card shows Climbing and the summary and details are unchanged

#### Scenario: Link limit

- **WHEN** the Details form already has 10 links
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

### Requirement: English CV import entry point

The profile page SHALL offer Import CV for empty and populated English-primary profiles. The modal SHALL use the listing parsing modal's paste and external AI pattern, with no built-in upload or URL input. Norwegian-primary profiles SHALL disable Import CV, explain why in its tooltip, and SHALL NOT switch language automatically.

#### Scenario: Existing English profile

- **WHEN** the owner opens Import CV on an English-primary profile with Norwegian translations
- **THEN** the import modal opens and translations do not block import

#### Scenario: Norwegian-primary profile

- **WHEN** the profile's content language is Norwegian
- **THEN** Import CV is disabled, and its tooltip explains that import needs an English-primary
  profile and points to the content-language control

### Requirement: Preferences

The Preferences card SHALL show job roles, work modes, employment types, minimum salary with
currency, notice period in months and target locations, as read-only content. One Preferences form
SHALL edit them all. Job roles can be picked from existing ones or typed as new names. Saving SHALL
send every field except target locations, and the page SHALL show the returned profile without
another request.

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

The Preferences form SHALL list the user's target locations. The user SHALL be able to add one
(country plus optional city) and remove one there, each saved right away, independently of the
form's Save. The form SHALL say that these changes save immediately. Adding or removing one SHALL
also change its Preferred mark on company pages.

#### Scenario: Adding a target location

- **WHEN** the user adds Oslo, Norway as a target location in the Preferences form
- **THEN** it appears in the form's list and on the Preferences card

#### Scenario: Removing a target location

- **WHEN** the user removes a target location and confirms
- **THEN** it disappears from the form's list and the card

#### Scenario: Card is read-only

- **WHEN** the Preferences card is shown
- **THEN** it has no inputs for adding target locations

### Requirement: Profile entries

Experience, Education, Certifications and Projects SHALL each list their entries in the order the API
returns. The user SHALL be able to add, edit and delete one entry at a time. Each entry SHALL have
one actions menu with Edit and Delete. Delete asks for confirmation first. Editing SHALL open the
form filled with the entry, and saving SHALL send the whole entry. Saving an entry SHALL NOT change
its bullets.

#### Scenario: Adding an experience

- **WHEN** the user adds an experience with employer, title, start month and skills
- **THEN** it appears in the Experience list with its date range and skills

#### Scenario: Deleting a certification

- **WHEN** the user picks Delete in a certification's actions menu and confirms
- **THEN** it disappears from the Certifications list

#### Scenario: Entry deleted elsewhere

- **WHEN** the user saves or deletes an entry that no longer exists
- **THEN** the API's message is shown and the profile is reloaded

### Requirement: Entry bullets

Every experience, education, certification and project SHALL show its bullets as plain text on its
card, in the order the API returns. The user SHALL be able to add, edit, delete and drag to reorder
bullets in the entry's edit form. Each bullet change SHALL be saved right away, independently of
the form's Save, and the form SHALL say so. An entry SHALL have at most 20 bullets.

#### Scenario: Adding a bullet

- **WHEN** the user opens an experience's edit form and adds the text "Led a team of 4"
- **THEN** it appears as the last bullet in the form and on the experience's card

#### Scenario: Bullets on every kind

- **WHEN** the user adds a bullet in a certification's edit form
- **THEN** it appears on that certification

#### Scenario: Editing a bullet

- **WHEN** the user edits a bullet's text and saves it
- **THEN** the bullet shows the new text in the same position

#### Scenario: Reordering

- **WHEN** the user drags the third bullet to the top
- **THEN** it is first, and the list stays in that order after the profile reloads

#### Scenario: Deleting a bullet

- **WHEN** the user deletes a bullet and confirms
- **THEN** it disappears and the others keep their order

#### Scenario: Bullet limit

- **WHEN** an entry already has 20 bullets
- **THEN** "Add bullet" is disabled

#### Scenario: Rejected text

- **WHEN** the user saves a blank or over-long bullet and the API rejects it
- **THEN** the API's message is shown and the typed text stays in the field

#### Scenario: New entry

- **WHEN** the user is adding a new entry
- **THEN** the form says bullets can be added after saving, and the user can add them from the
  entry's edit form

#### Scenario: Bullet saved, form cancelled

- **WHEN** the user adds a bullet in an edit form and then cancels the form
- **THEN** the bullet stays saved

### Requirement: Month values

Every entry date SHALL be picked as a month and year. It SHALL be sent as the first day of that month,
and shown as short month plus year in the profile's content language (English or Norwegian); the
date of birth SHALL follow the same language. A range with no end SHALL read "Present" for
experience and education, and show just the start for undated-end projects.

#### Scenario: Half-cleared month

- **WHEN** the user clears only the year of an entry's start month and tries to save
- **THEN** the form is not saved and the start field shows that a full month is needed

#### Scenario: Picking a start month

- **WHEN** the user picks March 2021 as a start month and saves
- **THEN** the API receives `2021-03-01` and the entry shows March 2021 as a short month and year

#### Scenario: English profile dates

- **WHEN** the profile's content language is English
- **THEN** an experience from January 2020 with no end reads "Jan 2020 – Present", and the date of
  birth reads like "17 May 1990"

#### Scenario: Norwegian profile dates

- **WHEN** the profile's content language is Norwegian
- **THEN** month names and the date of birth are in Norwegian

### Requirement: Languages

The Languages card SHALL list languages in API order with their CEFR level (A1–C2), as read-only
content with an actions menu per language. A Language form SHALL add a language not yet listed, or
change a listed language's level (not the language itself). Removing SHALL ask for confirmation.
Each change is saved when the form or confirmation is accepted. Adding SHALL be hidden once every
supported language is listed. With no languages, the card SHALL show the standard empty state.

#### Scenario: Adding a language

- **WHEN** the user adds Norwegian at B2
- **THEN** the Languages card shows "Norwegian · B2"

#### Scenario: Changing a level

- **WHEN** the user picks Edit on English, changes the level to C1 and saves
- **THEN** the card shows English at C1

#### Scenario: All languages listed

- **WHEN** both English and Norwegian are listed
- **THEN** there is no way to add another language
