# Spec Delta

## ADDED Requirements

### Requirement: Tailored CV card

The listing page SHALL show a "Tailored CV" card. When the listing has no draft, the card SHALL show a muted empty
state and a "Create draft" button that opens the draft editor. When a draft exists, the card SHALL show a "Draft
saved" badge, an Edit button that opens the editor, and a "Copy as text" button. While the draft loads, the card
SHALL show a loading state. If loading fails, the card SHALL show the error.

#### Scenario: No draft yet

- **WHEN** the listing has no tailored CV draft
- **THEN** the card shows the empty state and "Create draft" links to `/listings/[id]/cv`

#### Scenario: Draft exists

- **WHEN** the listing has a saved draft
- **THEN** the card shows "Draft saved", Edit and "Copy as text"
