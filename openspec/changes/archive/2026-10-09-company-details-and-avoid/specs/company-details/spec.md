# Spec Delta

## Purpose

Lets the user look at one company in depth: its positions and their outcome, simple stats, notes, and
whether the company is avoided. It also lets the user edit the company's name, industry and locations.

## ADDED Requirements

### Requirement: Company page

`/companies/<id>` SHALL show the company's name, favorite toggle, industry, locations and an
"Avoided" badge when avoided. It SHALL offer Edit and a menu with the avoid action. Back SHALL
return to the companies list as the user left it. A missing company SHALL show "Company not found",
and a failed load the generic error.

#### Scenario: Opening a company

- **WHEN** the user opens `/companies/12`
- **THEN** the page shows that company's name, industry, locations, and its stats, positions and notes

#### Scenario: Unknown id

- **WHEN** no company with that id exists for the user
- **THEN** the page shows "Company not found"

#### Scenario: Back keeps the list view

- **WHEN** the user came from `/companies` with a search and Hide avoided on, and clicks Back
- **THEN** `/companies` opens with the same search and toggle

### Requirement: Company positions

The company page SHALL list every listing at the company in one list, including archived ones. It
SHALL show in-progress listings (Applied, Interviewing, Offer) first, then Saved, then finished
ones (Accepted, Rejected, Withdrawn), then archived. Each row SHALL show title, role and status,
mark archived ones, and open the listing.

#### Scenario: Mixed listings

- **WHEN** the company has one Interviewing, one Saved, one Rejected and one archived listing
- **THEN** they are listed in that order, the archived one marked as archived

#### Scenario: Opening a position

- **WHEN** the user clicks a position
- **THEN** that listing's page opens

#### Scenario: No positions

- **WHEN** the company has no listings
- **THEN** a centered empty message with a muted icon says there are no listings yet and offers Add listing

### Requirement: Company stats

The company page SHALL show the number of listings, the number of applications, and how many listings
are in progress, reached interviewing or later, got an offer, and were rejected. Archived listings count.

#### Scenario: Counting

- **WHEN** the company has listings with statuses Saved, Applied, Interviewing and Rejected
- **THEN** the stats show 4 listings, 2 in progress, 1 interviewed, 0 offers and 1 rejected, and applications as the API counts them

#### Scenario: Interviewed counts the current status

- **WHEN** a listing was interviewed and is now Rejected
- **THEN** it counts as rejected, not interviewed

### Requirement: Company notes

The company page SHALL show the company's notes rendered as Markdown, or "No notes yet" with an
"Add notes" action. Editing SHALL happen in a dialog. Saving SHALL store the notes and show them.
Saving blank notes SHALL clear them. An API error SHALL be shown in the dialog and the dialog SHALL
stay open.

#### Scenario: Adding notes

- **WHEN** the user clicks "Add notes", types "Bad reviews on **pay**" and saves
- **THEN** the dialog closes and the notes card shows the text with "pay" in bold

#### Scenario: Clearing notes

- **WHEN** the user empties the notes and saves
- **THEN** the notes card shows "No notes yet"

#### Scenario: Too long

- **WHEN** the API rejects the notes
- **THEN** its message shows in the dialog and the text stays as typed

### Requirement: Avoiding a company

The company page menu SHALL offer "Avoid company" and, when avoided, "Stop avoiding". Avoiding SHALL
ask for confirmation first; stopping SHALL not. An avoided company's page SHALL show a notice with a
"Stop avoiding" action. A failed change SHALL show an error toast and leave the state as it was.

#### Scenario: Avoiding

- **WHEN** the user picks "Avoid company" and confirms
- **THEN** the page shows the Avoided badge and notice

#### Scenario: Cancelling

- **WHEN** the user picks "Avoid company" and cancels the confirmation
- **THEN** nothing changes

#### Scenario: Stop avoiding

- **WHEN** the user clicks "Stop avoiding" on an avoided company
- **THEN** the badge and notice go away, and the notes are kept

### Requirement: Avoided company on its listings

A listing whose company is avoided SHALL show an "Avoided company" badge on its card in `/listings`
and in the listing page header. The listing SHALL stay visible as usual.

#### Scenario: Card badge

- **WHEN** a listing in `/listings` belongs to an avoided company
- **THEN** its card shows "Avoided company" and it is still listed

#### Scenario: Listing page badge

- **WHEN** the user opens a listing whose company is avoided
- **THEN** the header shows "Avoided company"

### Requirement: Editing a company

`/companies/<id>/edit` SHALL let the user change the name, industry (picked from existing ones or
typed) and locations, prefilled with the current values. Saving SHALL replace them and return to the
company page. Cancel and Back SHALL leave without saving. API errors SHALL show without leaving.

#### Scenario: Saving

- **WHEN** the user changes the industry and adds a location, then saves
- **THEN** the company page opens showing the new industry and locations

#### Scenario: Clearing the industry

- **WHEN** the user clears the industry and saves
- **THEN** the company has no industry

#### Scenario: Name taken or invalid

- **WHEN** the API returns an error for the save
- **THEN** its message shows and the form keeps the user's input

#### Scenario: One Back after saving

- **WHEN** the user opens the company page, edits, saves, and clicks Back once
- **THEN** the companies list opens, not the edit form
