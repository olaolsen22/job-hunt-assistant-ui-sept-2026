# Spec Delta

## ADDED Requirements

### Requirement: Tailor a CV link when applying

When the listing has no tailored CV draft, the apply form SHALL show a "Tailor a CV first" link to the draft editor.
The link SHALL NOT block applying. When a draft exists, the link SHALL NOT be shown.

#### Scenario: No draft

- **WHEN** the apply form opens for a listing with no draft
- **THEN** a "Tailor a CV first" link to `/listings/[id]/cv` is shown and Apply still works

#### Scenario: Draft exists

- **WHEN** the apply form opens for a listing with a saved draft
- **THEN** no tailoring link is shown
