# Tasks

## 1. ProfileSection compact empty state

- [x] 1.1 Add a `compactEmpty` prop (default `true`) to `ProfileSection`. When true and the section is empty, render a single flex row (~80 px): muted icon (size-5), message text, and the Add button on the right — instead of the current centered block with py-6 and size-10 icon. Verify by viewing an empty section at desktop and mobile widths: the row is ~80 px tall and horizontally laid out.
- [x] 1.2 Add a `count` prop (number | undefined) to `ProfileSection`. When set and greater than 0, show "· {count}" after the title text. Verify the count renders next to the title in a muted style.
- [x] 1.3 Update existing profile page tests that assert on the empty state structure (e.g., `profile-*-empty` testids). Verify `pnpm vitest run test/unit/ProfilePage.test.ts` passes (or the relevant test file).

## 2. Header reorganization

- [x] 2.1 Restructure the `<header>` in `profile.vue` into two rows: Row 1 — name (h1) + headline on the left, Edit details button + overflow `UDropdownMenu` on the right. Row 2 — contact details and links as compact inline items. Move Import CV, Refine bullets, and Clear CV content into the overflow menu items. Verify at desktop: name and Edit details on one line, contact on the next, no stacking of 4+ buttons.
- [x] 2.2 On mobile (below sm), keep only Edit details with a label visible; the overflow menu icon holds the rest. Verify at 375 px: header fits without wrapping action buttons.
- [x] 2.3 Replace the bordered translation controls strip. Show a compact language badge/indicator (content language name + translate icon) in the header area (Row 1 near the overflow menu, or Row 2). Move "Translate to [language]" and "Translate with AI" into the overflow menu. When untranslated items exist, show a small inline prompt ("N items untranslated · Translate with AI") below the header instead of permanent buttons. Verify at desktop and mobile: no separate bordered strip; translation mode still activates correctly.
- [x] 2.4 Update tests for header structure changes (button testids that moved into the menu). Verify `pnpm vitest run` for profile-related tests passes, then `pnpm typecheck`.

## 3. Section ordering and cover letter zone

- [x] 3.1 Move Address, My story and Writing samples out of the two-column grid into a new full-width `<section>` below it, with a heading "Cover letter material" and a one-line muted description. Verify at desktop: the zone renders below the grid with a visual separator (border-t or spacing).
- [x] 3.2 On mobile, reorder sections so Skills appears right after Experience. Use a computed section list or conditional template blocks gated on a `useMediaQuery('(min-width: 768px)')` check. Verify at 375 px: Skills card follows Experience; at 1440 px: Skills remains in the sidebar.
- [x] 3.3 At tablet width (md), render sidebar sections (Skills, Languages, Hobbies, Certifications, Preferences) in a `md:grid-cols-2` sub-grid after the main column sections. Verify at 768 px: sidebar cards display in two columns.

## 4. Mobile collapsible sections

- [x] 4.1 Add `collapsible` (boolean) and `defaultOpen` (boolean, default true) props to `ProfileSection`. When `collapsible` is true, render a chevron toggle in the header with `aria-expanded`. Clicking the header toggles content visibility. The count prop shows in the header when collapsed. Verify: a collapsible section toggles open/closed, the chevron rotates, and `aria-expanded` updates.
- [x] 4.2 In `profile.vue`, pass `collapsible` to all sections when below md breakpoint (using `useMediaQuery`). Set `defaultOpen` to true for Summary and Experience only. All other sections default collapsed on mobile. Verify at 375 px: Summary and Experience are open, Skills shows "Skills · N" collapsed with a chevron.
- [x] 4.3 On desktop and tablet (md+), do not pass `collapsible` — no toggles render and all content is visible. Verify at 768 px and 1440 px: no chevrons, all sections open.

## 5. Empty profile onboarding and minor section hiding

- [x] 5.1 Add a page-level onboarding card that renders when the entire profile is empty (no name, no entries, no skills). Show a `UCard` with "Start building your profile" heading, Import CV as the primary button, and "or add sections manually" as a secondary text link. Verify: the card appears for a fully empty profile and disappears once any section has content.
- [x] 5.2 When the profile is mostly empty (only a few sections filled), hide empty minor sections (Hobbies, Preferences, References, Writing samples) and show an "Add more sections" button or dropdown at the bottom of the sidebar (or the bottom of the page on mobile) that reveals them. Core sections (Summary, Experience, Education, Skills, Languages) always show. Verify: an empty profile shows only core sections plus the "Add more sections" control.
- [x] 5.3 Update profile page tests for the onboarding card and hidden minor sections. Verify tests pass with `pnpm vitest run` for the profile test file.

## 6. Grid alignment and final polish

- [x] 6.1 Add `items-start` to the `lg:grid-cols-3` grid container so sidebar cards do not stretch to match the main column height. Verify at 1440 px: a short Skills card sits at its natural height, not stretched to match Experience.
- [x] 6.2 Take screenshots at desktop (1440), tablet (768) and mobile (375) widths with the guest account (or mock data). Verify visually: header is clean, empty states are compact, cover letter zone is separated, mobile sections collapse, sidebar cards align to top.
- [x] 6.3 Run `pnpm lint` and `pnpm typecheck`. Fix any issues introduced by the changes.
