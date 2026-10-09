## ADDED Requirements

### Requirement: Company favorites

Each row on `/companies` SHALL have a favorite toggle that sets or clears the company's favorite
mark. The toggle SHALL update at once, undo itself and show an error if the API rejects the change,
and SHALL NOT open the company's listings when clicked.

#### Scenario: Favoriting a company

- **WHEN** the user clicks the star on a company row
- **THEN** the star shows as filled and the company is saved as a favorite

#### Scenario: Unfavoriting

- **WHEN** the user clicks the filled star on a favorited company
- **THEN** the star is cleared and the favorite mark is removed

#### Scenario: Save fails

- **WHEN** the API returns an error for the change
- **THEN** the star returns to its previous state and an error toast shows the message

#### Scenario: Row link is not triggered

- **WHEN** the user clicks the star
- **THEN** `/listings` does not open
