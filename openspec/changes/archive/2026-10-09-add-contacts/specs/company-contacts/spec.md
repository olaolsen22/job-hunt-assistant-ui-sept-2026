## ADDED Requirements

### Requirement: Company contacts card

The company page SHALL show a Contacts card listing the company's contacts by name. Each contact
SHALL show its title, email (mailto link), phone (tel link), URL (external link), and notes
(rendered Markdown) when present. With no contacts the card SHALL show the centered empty message.

#### Scenario: Company with a contact

- **WHEN** the user opens a company that has a contact with a name, email, and notes
- **THEN** the Contacts card shows the name, a mailto link for the email, and the rendered notes

#### Scenario: Company without contacts

- **WHEN** the user opens a company with no contacts
- **THEN** the Contacts card shows a centered empty message with a muted icon and an Add action

### Requirement: Managing contacts

The user SHALL be able to add, edit, and delete a company's contacts from the company page. Name is
required; other fields are optional and blank fields are sent as null. Editing SHALL replace all
fields. Deleting SHALL ask for confirmation and say that linked listings are kept. Errors returned
by the API SHALL be shown in the form or as a toast, and the contact list SHALL refresh after a
successful change.

#### Scenario: Add a contact

- **WHEN** the user adds a contact named "Kari Nordmann" with an email
- **THEN** the contact appears in the Contacts card

#### Scenario: Duplicate name

- **WHEN** the user adds a contact whose name matches an existing one in the company (any case)
- **THEN** the API's duplicate error message is shown and the modal stays open

#### Scenario: Delete a contact

- **WHEN** the user confirms deleting a contact
- **THEN** the contact disappears from the card

### Requirement: Listing contacts

The listing page SHALL show the contacts linked to the listing with the same fields as the company
page, read-only, and SHALL hide the card when there are none.

#### Scenario: Listing with a linked contact

- **WHEN** the user opens a listing linked to a contact
- **THEN** a Contacts card shows that contact's details
