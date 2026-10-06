## Purpose

The `/` dashboard gives a quick overview of what needs attention and how the job hunt is going,
as independent widgets that each link into the full lists.

## ADDED Requirements

### Requirement: Widget order and visibility

The dashboard SHALL show the widgets the user has marked as shown, in the user's saved order, as one
grid with no group headings. The ten widgets are Closing soon, Upcoming interviews, Offers to answer, Stale
listings, Pipeline counts, Applied this week, To analyze, Favorited listings, Favorited companies and LLM usage. A user who
has never saved a layout SHALL see all ten in the default order (as listed above). The API health indicator
SHALL stay on the page.

#### Scenario: Default dashboard

- **WHEN** a user who has never saved a layout opens `/`
- **THEN** all ten widgets are shown in the default order, and the API health indicator is shown

#### Scenario: Saved order and visibility

- **WHEN** the saved layout puts To analyze first and hides Stale listings
- **THEN** To analyze is the first widget and Stale listings is not shown

#### Scenario: Wide widget

- **WHEN** Pipeline counts is shown at any position
- **THEN** it spans the full row, and the other widgets sit two to a row on wide screens

### Requirement: Independent widget loading

Each widget SHALL load its own data, in parallel with the others, and SHALL show its own loading,
empty and error state. A failing widget SHALL NOT stop the others from showing, and SHALL offer a
retry.

#### Scenario: One widget fails

- **WHEN** the request for one widget fails
- **THEN** that widget shows an error with a retry action and every other widget still shows its data

#### Scenario: Nothing to show

- **WHEN** a widget has no matching rows
- **THEN** it shows a short empty message instead of a blank card

### Requirement: Listing widgets show a few rows

Listing widgets SHALL show at most five rows with title, company and the detail relevant to that
widget, and each row SHALL open the listing. A widget with more matches than rows SHALL show the total and
a link to the full list.

#### Scenario: More matches than rows

- **WHEN** 12 listings are closing soon
- **THEN** the Closing soon widget shows 5 rows, the total 12, and a link to all of them

### Requirement: Closing soon widget

The Closing soon widget SHALL show non-archived listings due within the next 7 days, including
today, excluding expired ones, in the server's due order. It SHALL link to `/listings` with the
closing soon preset on.

#### Scenario: Closing soon rows

- **WHEN** two listings are due in 2 and 6 days
- **THEN** both appear, the earlier one first, each with its due date

### Requirement: Upcoming interviews widget

The Upcoming interviews widget SHALL show interviews scheduled from now on for listings with status
Interviewing, soonest first, each with the interview time and the listing and company it belongs
to. Rows open the listing.

#### Scenario: Upcoming interviews

- **WHEN** a listing has an interview tomorrow and another next week
- **THEN** tomorrow's is listed first, with its date and time

#### Scenario: Past interviews

- **WHEN** an interview was scheduled yesterday
- **THEN** it is not listed

#### Scenario: Other statuses

- **WHEN** a listing with status Offer has an interview scheduled tomorrow
- **THEN** it is not listed

### Requirement: Offers to answer widget

The Offers to answer widget SHALL show non-archived listings whose status is Offer, most recently
changed first, with the date the offer came in. It SHALL link to `/listings` with the Offer status
selected.

#### Scenario: An offer is waiting

- **WHEN** a listing has status Offer
- **THEN** it appears with the date its status last changed

### Requirement: Stale listings widget

The Stale listings widget SHALL show non-archived listings with status Saved, no dated deadline
(ASAP or unspecified) and posted 14 to 45 days ago, oldest first. Each row SHALL show how many
days old it is. Listings posted more than 45 days ago SHALL NOT be shown. Listings whose due date has passed SHALL be included, since going stale is the
point. It SHALL link to `/listings` with the Saved status selected.

#### Scenario: Stale ordering

- **WHEN** Saved listings with no deadline were posted 40, 20 and 10 days ago
- **THEN** the 40-day and 20-day ones are listed, oldest first, as "40 days old" and "20 days old"

#### Scenario: Too old to show

- **WHEN** a Saved listing with no deadline was posted 60 days ago
- **THEN** it is not listed

#### Scenario: Dated deadlines are not stale

- **WHEN** a Saved listing posted 30 days ago has a dated deadline in the future
- **THEN** it is not listed

#### Scenario: Applied listings are not stale

- **WHEN** a listing posted 30 days ago has status Applied
- **THEN** it is not listed

### Requirement: Pipeline counts widget

The Pipeline counts widget SHALL show the number of non-archived listings per status (Saved, Applied,
Interviewing, Offer, Accepted, Rejected, Withdrawn). Each count SHALL link to `/listings` with that
status selected.

#### Scenario: Counting

- **WHEN** the user has 4 Saved and 2 Applied listings
- **THEN** Saved shows 4, Applied shows 2, and statuses with none show 0

### Requirement: Applied this week widget

The Applied this week widget SHALL show the number of listings whose status was set to Applied in
the last 7 days, including today, and the most recent of them. It counts listings currently in
Applied status.

#### Scenario: Recent applications

- **WHEN** three listings currently in Applied status changed within the last 7 days
- **THEN** the widget shows 3

### Requirement: To analyze widget

The To analyze widget SHALL show the number of non-archived, non-expired listings not yet marked
analyzed, with a few rows, and SHALL link to `/listings` with the to-analyze preset on.

#### Scenario: Unanalyzed listings

- **WHEN** 8 listings have no analyzed date
- **THEN** the widget shows 8 and up to five of them

### Requirement: Favorited listings widget

The Favorited listings widget SHALL show non-archived favorited listings, most recently favorited
first, and SHALL link to `/listings` with the favorites facet on.

#### Scenario: Favorites

- **WHEN** the user has favorited three listings
- **THEN** they are listed, most recently favorited first

### Requirement: Favorited companies widget

The Favorited companies widget SHALL show favorited companies, most recently favorited first, each
with its open listings: non-archived, status Saved, not past their due date. Companies without open
listings SHALL still appear, saying so. It SHALL link to `/companies`.

#### Scenario: Company with open listings

- **WHEN** a favorited company has two open listings
- **THEN** the company row shows both listings and opens either one

#### Scenario: No open listings

- **WHEN** a favorited company has no open listings
- **THEN** it is listed with "No open listings"

#### Scenario: No favorites

- **WHEN** no company is favorited
- **THEN** the widget points to `/companies` to favorite one

### Requirement: LLM usage widget

The LLM usage widget SHALL show today's LLM request count, the input and output token totals and when the count resets
(local time). When the API reports a daily limit it SHALL also show the remaining requests and a progress bar; without
a limit it SHALL show only the count. The numbers cover all users of the API. It has no link out.

#### Scenario: With a limit

- **WHEN** 120 requests were made today and the limit is 500
- **THEN** the widget shows 120 of 500, 380 remaining, a progress bar, the token totals and the reset time

#### Scenario: No limit

- **WHEN** the API reports no daily limit
- **THEN** the widget shows the request count and tokens, without a bar or remaining count

### Requirement: Hidden widgets do not load

A hidden widget SHALL NOT be rendered and SHALL NOT send its queries.

#### Scenario: Hiding a widget

- **WHEN** Offers to answer is hidden
- **THEN** opening `/` sends no request for offers

### Requirement: Layout loading

The dashboard SHALL load the saved layout before showing any widget. While it loads, a skeleton SHALL be shown.
If it fails, an error with a retry action SHALL be shown instead of widgets. If every widget is hidden, an empty
state SHALL say so and offer to edit the dashboard.

#### Scenario: Layout request fails

- **WHEN** the layout request fails
- **THEN** the dashboard shows an error with a retry and no widgets, and the API health indicator still shows

#### Scenario: Everything hidden

- **WHEN** all ten widgets are hidden
- **THEN** a centered empty message with an "Edit dashboard" action is shown instead of widgets

### Requirement: Editing the dashboard

An "Edit dashboard" action SHALL switch the page to an edit mode that lists all ten widgets, including hidden
ones, in the current order. Each row SHALL let the user move the widget up or down and show or hide it. Move
controls SHALL be disabled at the ends of the list. A "Reset to default" action SHALL set the list to the
default order with every widget shown. Nothing is saved until the user clicks Save, including after a reset; Cancel SHALL
discard the changes. Save SHALL send the whole list in display order, then return to the dashboard with the saved
layout.

#### Scenario: Reordering

- **WHEN** the user opens edit mode, moves "To analyze" to the top and clicks Save
- **THEN** the full layout is saved with To analyze first and the dashboard shows it first

#### Scenario: Hiding and showing

- **WHEN** the user hides "Stale listings" in edit mode and saves
- **THEN** the dashboard no longer shows it, and edit mode still lists it as hidden so it can be shown again

#### Scenario: Reset to default

- **WHEN** the user reorders and hides widgets, clicks "Reset to default", then clicks Save
- **THEN** the full layout is saved in the default order with all ten widgets shown

#### Scenario: Reset without saving

- **WHEN** the user clicks "Reset to default" and then Cancel
- **THEN** the dashboard keeps the previously saved layout

#### Scenario: Cancel

- **WHEN** the user changes the order and clicks Cancel
- **THEN** the dashboard keeps the previously saved order and visibility

#### Scenario: Save is rejected

- **WHEN** the API returns an error for the save
- **THEN** its message is shown, edit mode stays open, and the user's edits are kept

#### Scenario: Save fails

- **WHEN** the save request fails
- **THEN** a generic error is shown, edit mode stays open, and the user's edits are kept
