# Spec Delta

## ADDED Requirements

### Requirement: Editor section cards

An empty editor section SHALL show one compact row with an icon and its message instead of a tall centered block.
Its Edit or Add action SHALL stay in the section header. The Experience, Skills, Education, Certifications, Projects
and Languages sections SHALL show their item count after the title when they have items. Contact and headline and
Summary SHALL show no count.

#### Scenario: Empty section

- **WHEN** the CV has no education
- **THEN** the Education section shows a single row with its empty message, and its Add action in the header

#### Scenario: Count after the title

- **WHEN** the CV has three experience entries
- **THEN** the section title reads "Experience · 3"

#### Scenario: Count follows edits

- **WHEN** the owner removes one of three experience entries
- **THEN** the title reads "Experience · 2"

### Requirement: Phone collapsible sections

Below tablet width (768 px) each editor section SHALL be collapsible from its header, with a chevron and an
expanded/collapsed state exposed to assistive technology, and usable from the keyboard. Contact and headline, Summary
and Experience SHALL start open and the other sections SHALL start collapsed. A collapsed section SHALL show its
title and count only. A section that holds a pending AI suggestion, a part flagged as still in another language, or
an AI error SHALL be open and SHALL NOT be collapsible while that holds. From tablet width up, sections SHALL NOT be
collapsible and all content SHALL be visible. The owner's open or closed choice SHALL otherwise be kept while they
stay on the page, including during and after an AI run.

#### Scenario: Default state on a phone

- **WHEN** the owner opens the editor at 375 px
- **THEN** Contact and headline, Summary and Experience are open, and Skills shows "Skills · N" collapsed

#### Scenario: Toggle a section

- **WHEN** the owner taps the Skills header on a phone
- **THEN** the section opens and its header reports it as expanded

#### Scenario: Suggestion arrives in a collapsed section

- **WHEN** an AI run returns a suggestion for Skills while Skills is collapsed
- **THEN** Skills opens, shows the suggestion, and has no collapse toggle until the suggestion is accepted or
  dismissed

#### Scenario: Next suggestion on a phone

- **WHEN** the owner taps Next with suggestions pending in several sections
- **THEN** the page scrolls to a visible suggestion, because every section holding one is open

#### Scenario: Tablet and desktop

- **WHEN** the owner opens the editor at 768 px or wider
- **THEN** no section has a collapse toggle and all sections are open

### Requirement: Desktop side rail

From desktop width (`lg`, 1024 px) the page SHALL use the full content width with two columns: the main column with
the pending suggestions banner, the CV sections and the save bar, and a side rail with the Tailor with AI and CV
style card and the PDF card. The rail SHALL stay in view while the main column scrolls, and SHALL scroll on its own
when it is taller than the window. Below desktop width the page SHALL keep one column in this order: Tailor with AI
and CV style card, suggestions banner, CV sections, PDF card, save bar.

#### Scenario: Desktop

- **WHEN** the owner opens the page at 1440 px
- **THEN** the CV sections are in the main column, and the Tailor with AI card and the PDF card are in a rail beside
  them that stays visible while scrolling

#### Scenario: Phone and tablet order

- **WHEN** the owner opens the page at 375 px or 768 px
- **THEN** there is one column, with the Tailor with AI card above the sections and the PDF card below them, and the
  save bar last

#### Scenario: Whole-CV analysis

- **WHEN** a whole-CV analysis runs at desktop width
- **THEN** the controls in both columns are disabled until it ends
