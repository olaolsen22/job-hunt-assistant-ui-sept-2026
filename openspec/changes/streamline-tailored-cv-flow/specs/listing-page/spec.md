# Spec Delta

## MODIFIED Requirements

### Requirement: Tailored CV card

The listing page SHALL show a "Tailored CV" card. With no draft, it SHALL show a muted empty state and a "Tailor CV"
button that opens the editor. With a draft, it SHALL show a "Draft saved" badge, Edit and "Copy as text". It SHALL
also show the latest CV PDF's file name with Preview, and on a Saved listing, Apply with this CV. The card SHALL show
loading and error states.

#### Scenario: No draft yet

- **WHEN** the listing has no tailored CV draft
- **THEN** the card shows the empty state and "Tailor CV" links to `/listings/[id]/cv`

#### Scenario: Draft exists

- **WHEN** the listing has a saved draft and no CV PDF
- **THEN** the card shows "Draft saved", Edit and "Copy as text", and no PDF row

#### Scenario: Draft with a PDF

- **WHEN** the listing is Saved and has a draft and an unsent CV PDF
- **THEN** the card shows the newest PDF's file name with Preview, and Apply with this CV opens the apply form with
  that PDF selected
