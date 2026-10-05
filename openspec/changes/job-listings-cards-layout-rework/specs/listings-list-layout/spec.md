# Spec Delta

## Purpose

Defines how the `/listings` card grid lays out each card and how many cards it loads per page, so a tablet shows a full screen of cards and the pagination without scrolling.

## ADDED Requirements

### Requirement: Two-column card body from tablet width

From the `md` breakpoint (768px) up, a listing card SHALL show the company and location in a first column and the posted and deadline dates in a second column. The title row and status badges SHALL span the full card width above the columns.

#### Scenario: Tablet card

- **WHEN** the viewport is 768px wide or more
- **THEN** company and location appear in the left column and the dates in the right column, under a full-width title and badges

#### Scenario: Phone card

- **WHEN** the viewport is narrower than 768px
- **THEN** the card keeps its single stacked column, unchanged

### Requirement: View posting sits in the title row on tablet

From the `md` breakpoint up, the "View posting" button SHALL appear in the card's title row, at the opposite end from the title, next to the favorite button. Below `md` it SHALL stay at the bottom of the card.

#### Scenario: Tablet title row

- **WHEN** the viewport is 768px wide or more
- **THEN** the title is at the start of the title row and "View posting" is at the end of it

#### Scenario: Phone button position

- **WHEN** the viewport is narrower than 768px
- **THEN** "View posting" is at the bottom of the card

### Requirement: Page size fits the available height

From the `md` breakpoint up, the number of cards per page SHALL be computed on page load from the viewport height available below the page header and the number of grid columns, so that the cards and the pagination are visible without scrolling. The size SHALL stay between a minimum and maximum and SHALL NOT change until the next page load.

#### Scenario: Galaxy Tab S9 landscape at 100% zoom

- **WHEN** the listings page loads on a landscape Galaxy Tab S9 (2 columns)
- **THEN** 4 cards are requested and shown (2 rows) with the pagination visible

#### Scenario: Galaxy Tab S9 portrait at 100% zoom

- **WHEN** the listings page loads on a portrait Galaxy Tab S9 (1 column)
- **THEN** 4 cards are requested and shown (4 rows) with the pagination visible

#### Scenario: Single request on load

- **WHEN** the listings page loads
- **THEN** the listings are fetched once, with the computed page size, not first with a default and again after measuring

#### Scenario: Zoom out

- **WHEN** the page loads at a lower browser zoom (more CSS pixels of height)
- **THEN** more cards per page are requested

### Requirement: Phones keep a fixed page size

Below the `md` breakpoint the page size SHALL stay at 5 cards.

#### Scenario: Phone page size

- **WHEN** the listings page loads on a viewport narrower than 768px
- **THEN** 5 cards are requested
