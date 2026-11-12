# Spec Delta

## MODIFIED Requirements

### Requirement: Profile page

`/profile` SHALL load the whole profile with one request and show it as a read-first CV. A header row SHALL show identity (name, headline) on the left and a primary action button plus an overflow menu on the right. A second row SHALL show contact details (email, phone, location) and links as compact inline items. The overflow menu SHALL hold Import CV, Refine bullets and Clear CV content. On mobile, only the primary action button (Edit details) SHALL have a visible label; other actions SHALL be in the overflow menu.

Below the header, a compact language indicator SHALL show the content language and a translate badge. Translate actions (Translate to [language], Translate with AI) SHALL move into the overflow menu or appear as an inline prompt when untranslated items exist.

The page SHALL use a two-column grid at lg and above (`lg:grid-cols-3`): the main column (`lg:col-span-2`) SHALL show Summary, Experience, Projects, Education, and References; the side column SHALL show Skills, Languages, Hobbies, Certifications, then Preferences last. Cards SHALL use `items-start` so short sidebar cards do not stretch to match tall main-column cards. At the 2xl breakpoint (≥1536px) the page SHALL widen beyond its lg cap so the grid uses more of the viewport on ultrawide screens, and the grid SHALL switch to 4 columns (`2xl:grid-cols-4`) with the main column spanning 3 (`2xl:col-span-3`) to better fill the wider container.

Below the two-column grid, a visually separated "Cover letter material" zone SHALL show Address, My story and Writing samples full-width.

At tablet width (md), sidebar cards SHALL render in a 2-column grid (`md:grid-cols-2`) after the main content. On mobile, Skills SHALL appear right after Experience for scannability, before the remaining sections stack single-column.

Cards SHALL NOT show inline edit inputs outside translation mode. The sidebar nav and user menu SHALL link to the page. While loading it SHALL show a skeleton, and a failed load SHALL show the generic error.

#### Scenario: Opening the profile

- **WHEN** the user clicks Profile in the sidebar
- **THEN** `/profile` shows every section filled from the profile

#### Scenario: Load fails

- **WHEN** the profile request fails
- **THEN** the page shows the generic error message instead of the sections

#### Scenario: Desktop layout

- **WHEN** the page is shown at lg width or wider
- **THEN** the main column shows Summary, Experience, Projects, Education and References, and the side column shows Skills, Languages, Hobbies, Certifications and Preferences, with cards aligned to top (not stretched)

#### Scenario: Mobile section order

- **WHEN** the page is shown on a phone-width screen
- **THEN** Skills appears immediately after Experience, before Projects and Education

#### Scenario: Tablet sidebar layout

- **WHEN** the page is shown at tablet width (md breakpoint)
- **THEN** sidebar cards render in a 2-column grid after the main content sections

#### Scenario: Cover letter zone

- **WHEN** Address, My story or Writing samples have content
- **THEN** they appear in a visually separated group below the two-column grid, labelled as cover letter material

#### Scenario: Header overflow menu

- **WHEN** the user opens the overflow menu in the header
- **THEN** it contains Import CV, Refine bullets, Clear CV content, and translate actions

#### Scenario: Read view

- **WHEN** the profile has experiences with bullets and translation mode is off
- **THEN** the Experience card shows each entry's bullets as plain text, with no drag handles, inputs or per-bullet buttons

#### Scenario: Preferences last

- **WHEN** the page is shown on a wide screen
- **THEN** Preferences is the last card in the side column, after Certifications

#### Scenario: Ultrawide layout

- **WHEN** the page is shown at 2xl width (≥1536px) or wider
- **THEN** the page content is wider than the lg cap so the grid columns and cover letter zone use more of the available viewport

#### Scenario: Ultrawide grid proportions

- **WHEN** the page is shown at 2xl width (≥1536px) or wider
- **THEN** the grid uses 4 columns with the main column spanning 3 and the sidebar spanning 1, giving the main column 75% of the grid width
