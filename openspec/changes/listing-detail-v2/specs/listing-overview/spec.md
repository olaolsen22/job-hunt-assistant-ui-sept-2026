# Spec Delta

## Purpose

A read-only overview of one job listing at `/listings/v2/[id]`, arranged so the owner can judge
fit, see what is due and follow the application at a glance, on any screen width.

## ADDED Requirements

### Requirement: Read-only overview route

The app SHALL show a listing overview at `/listings/v2/[id]` that offers no editing, status
changes, AI runs, favorite toggles, uploads or downloads. The existing listing page at
`/listings/[id]` and every link to it SHALL stay unchanged.

#### Scenario: Open the overview

- **WHEN** the owner opens `/listings/v2/42` for a listing they own
- **THEN** the page shows that listing's overview with no edit, save, analyze or status buttons

#### Scenario: v1 untouched

- **WHEN** the owner opens `/listings/42`
- **THEN** the existing listing page is shown as before

### Requirement: Loading, not found and error states

While the listing loads, the page SHALL show placeholder shapes for the header, facts and
sections. When the listing does not exist or the request fails, it SHALL show the API's message
with a link back to the listings list, and a Try again action for request failures.

#### Scenario: Unknown listing

- **WHEN** the owner opens `/listings/v2/999999` and the API returns no listing
- **THEN** the page shows a not-found message and a "Back to listings" link

#### Scenario: Request fails

- **WHEN** the listing request fails
- **THEN** the page shows the error message and a Try again action that reloads the listing

### Requirement: Header

The header SHALL show a back link to the listings list, the title as the page heading
(wrapping, never truncated), the company name and job role, and badges for status, listing kind
(only when not a vacancy), favorite, archived and avoided company. Each badge SHALL carry text,
not colour alone. When the listing has a link, the header SHALL offer "View original posting",
opening in a new tab.

#### Scenario: Header for an applied favorite

- **WHEN** a favorited listing has status APPLIED and a posting link
- **THEN** the header shows its title, "Company · Role", an Applied badge, a Favorite badge and a
  "View original posting" link

#### Scenario: No posting link

- **WHEN** the listing has no link
- **THEN** no "View original posting" link is shown

#### Scenario: Archived listing

- **WHEN** the listing is archived
- **THEN** the page shows an "Archived" badge and a muted notice that the listing is archived,
  and all content stays visible

### Requirement: Deadline

The header SHALL show the deadline with the days left: the date for a dated deadline, otherwise
"ASAP" or "No deadline stated" with the API's estimated due date marked approximate. It SHALL use
the same urgency colours and wording as the listings list, with text carrying the meaning, and
SHALL mark a passed deadline as expired. Without a deadline or due date, nothing SHALL be shown.

#### Scenario: Deadline soon

- **WHEN** the deadline is two days away
- **THEN** the deadline shows the date and the days left in the list's two-days urgency colour

#### Scenario: ASAP listing

- **WHEN** the deadline type is ASAP and the API's due date is 20 Nov
- **THEN** the deadline reads ASAP with an approximate due date of 20 Nov

#### Scenario: Expired deadline

- **WHEN** the due date has passed
- **THEN** the deadline is marked expired

### Requirement: Facts strip

Below the header the page SHALL show, as label-above-value items, only the facts that are set:
locations, work mode, employment type, schedule with position percent, seniority, posted date
and posting language. Locations the owner targets SHALL be marked "Target". Facts with no value
SHALL be left out; when none are set the strip SHALL be hidden.

#### Scenario: Part-time hybrid role

- **WHEN** the listing is part time at 80 %, hybrid, in Oslo (a target location) and Bergen
- **THEN** the strip shows "Oslo (Target)", "Bergen", "Hybrid" and "Part time, 80 %"

#### Scenario: Missing facts

- **WHEN** seniority and work mode are not set
- **THEN** no Seniority or Work mode item is shown and no "Not stated" placeholder appears

### Requirement: Training program

When the listing has a training program, the page SHALL show it directly after the facts: end
company, start and end dates, whether it is paid, and the job offer type. Without one, nothing
SHALL be shown.

#### Scenario: Guaranteed job after training

- **WHEN** the listing has a paid training program with a guaranteed job offer
- **THEN** the page shows a Training program section stating it is paid and a job is guaranteed

### Requirement: Requirements from a saved requirement map

When a requirement map is saved for the listing, the Requirements section SHALL list its needs
grouped Required then Preferred. Each need SHALL show its text, its kind, a match badge with icon
and word (Evidenced, Partial, Gap) and its note when present. Within a group, gaps SHALL come
first, then partial, then evidenced. The section SHALL summarise each group's counts.

#### Scenario: Map with gaps

- **WHEN** the saved map has five required needs (one gap, one partial, three evidenced)
- **THEN** the Required group lists the gap first, then the partial, then the evidenced needs,
  and the summary reads "1 gap, 1 partial, 3 evidenced"

#### Scenario: Map older than the listing

- **WHEN** the listing was updated after the map was saved
- **THEN** the section shows a muted note that the map may be out of date

### Requirement: Requirements without a saved map

When no requirement map is saved, the Requirements section SHALL list the listing's skills
(name, level as "Level n of 5", minimum years when set, must-have or nice-to-have, must-haves
first) and languages (language, CEFR level when set, required or not), with a muted note that no
requirement map is saved. With no skills and no languages, it SHALL show a muted line saying no
requirements were found, or not yet extracted when the ad was never analyzed.

#### Scenario: Skills only

- **WHEN** no map is saved and the listing has a required skill Vue at level 4 with 3 years
- **THEN** the section lists "Vue · Level 4 of 5 · 3+ years · Must-have" and the no-map note

#### Scenario: Never analyzed

- **WHEN** no map is saved, the listing has no skills or languages and was never analyzed
- **THEN** the section shows "No requirements extracted yet"

### Requirement: Description

The page SHALL show the ad description as plain text with its line breaks, at a readable line
length, collapsed to a short preview with a "Show full description" toggle when long. Without a
description it SHALL say none is saved, pointing to the original posting when a link exists.

#### Scenario: Long description

- **WHEN** the description is longer than the preview
- **THEN** a preview is shown with "Show full description", which expands it in place

#### Scenario: No description

- **WHEN** the listing has no description but has a link
- **THEN** the section says no description is saved and links to the original posting

### Requirement: Application progress

The page SHALL show the status history (newest first, with date and note), interviews (upcoming
first, then past, with date, title and notes) and application questions (question, character
limit, answer and notes). Empty interview and question lists SHALL be hidden; an empty status
history SHALL say "No status changes yet".

#### Scenario: Upcoming interview

- **WHEN** the listing has one past and one upcoming interview
- **THEN** the upcoming interview is listed first with its date and time

#### Scenario: Question without an answer

- **WHEN** an application question has no answer
- **THEN** the question is shown with a muted "Not answered yet"

### Requirement: Company, contacts and documents

The page SHALL show a Company section (name, industry, kind, size, founded year, description,
website, careers and LinkedIn links, org number, and the company's listing and application
counts), a Contacts section (name, title, email, phone, link, last contact, follow-up date marked
"Overdue" when past) and a Documents section (kind, origin, file name, size, created and sent
dates). Contacts and Documents SHALL be hidden when empty; unset company fields SHALL be omitted.

#### Scenario: Sent CV

- **WHEN** the listing has a tailored CV that was sent on 3 Dec
- **THEN** the Documents section lists the CV as tailored and "Sent 3 Dec"

#### Scenario: No contacts

- **WHEN** the listing has no contacts
- **THEN** no Contacts section is shown

### Requirement: Record dates

At the bottom the page SHALL show, in small muted text, when the listing was created, last
updated, last analyzed and when its status last changed, omitting dates that are not set.

#### Scenario: Never analyzed

- **WHEN** the listing was never analyzed
- **THEN** the record dates show Created, Updated and Status changed but no Analyzed date

### Requirement: Layout by width

The page SHALL use one column on phones and tablets, two columns (main content and a side column
for company, contacts and documents) on desktop, and three columns (requirements,
description and progress, side column) on wide screens, within the app's page width cap. Reading
and keyboard order SHALL be the same at every width. On phones, sections after Requirements SHALL
be collapsible, showing their item counts, with the description open.

#### Scenario: Phone

- **WHEN** the page is viewed 375 px wide
- **THEN** sections stack in one column, Requirements is open and Progress, Documents, Contacts
  and Company are collapsed with counts in their labels

#### Scenario: Wide screen

- **WHEN** the page is viewed at 1920 px with the sidebar open
- **THEN** requirements, description with progress, and the side column appear side by side, and
  the page is no wider than the app's other pages
