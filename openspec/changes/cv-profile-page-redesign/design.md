# Design

## Context

The profile page (`app/pages/profile.vue`) is a single ~620-line SFC that owns all section rendering, modal state, and translation logic. Sections use `ProfileSection` (`app/components/profile/Section.vue`), which wraps `AppCard` with a title, an empty state and an actions slot. The page uses `lg:grid-cols-3` with `lg:col-span-2` for the main column. See proposal.md for motivation.

Key constraints:

- The API is fixed — no new fields or endpoints.
- `ProfileSection` is used by every section on the page but is not used outside `/profile`.
- The page fetches profile data once via `useProfile()` (`server: false`), then patches with mutation results.
- Translation mode is provided/injected across sections and needs to remain accessible from the page root.
- This redesign sets a pattern for CV templates and tailored CV pages.

## Goals / Non-Goals

**Goals:**

- Reduce empty-profile vertical scroll by ~60 % through compact empty states
- Reorganize the header to prioritize identity and reduce button clutter
- Make mobile usable with collapsible sections
- Visually separate CV content from cover letter material
- Create reusable layout patterns for the CV templates and tailored CV pages

**Non-Goals:**

- Changing the data model, API calls, or mutation logic
- Adding new sections or removing existing functionality
- Refactoring modal components or form logic
- Mobile-specific jump navigation (defer unless collapsing proves insufficient)
- Sticky sidebar (defer — sidebar length varies with skill count)

## Decisions

### 1. Extend `ProfileSection` rather than replace it

**Choice**: Add `collapsible`, `collapsed`, `count` and `compact-empty` props to the existing `ProfileSection` component.

**Why over a new component**: `ProfileSection` is used ~15 times in the page template. Replacing it would touch every section. Adding props keeps the API surface small and backward-compatible — sections that don't pass `collapsible` behave exactly as before.

**Alternative considered**: A new `CollapsibleCard` wrapper around `AppCard`. Rejected because it would duplicate the empty-state, title and actions patterns already in `ProfileSection`.

### 2. Conditional mobile collapse via CSS + a composable

**Choice**: Use a `useBreakpoint('md')` composable (or `useMediaQuery` from VueUse, already available) to drive `collapsible` at runtime. On md+ screens, `collapsible` is false and no toggles render. On mobile, each section gets a reactive `collapsed` ref.

**Why over CSS-only**: Pure CSS `<details>` cannot sync with the item count display or programmatic open-on-navigate. A reactive ref per section allows the page to open a section when the user navigates to it (e.g., from an "Add more sections" link).

**Alternative considered**: Always render collapse toggles and hide them with `lg:hidden`. Rejected because it adds DOM and aria attributes that desktop users shouldn't see.

### 3. Header restructure in the page template, not a new component

**Choice**: Refactor the `<header>` section of `profile.vue` inline — two rows (identity + actions, contact + links) with the overflow menu absorbing Import CV, Refine bullets, Clear and translate actions.

**Why not a separate component**: The header references many page-level refs (basicsOpen, cvImportOpen, refineOpen, translateAiOpen, translating, etc.). Extracting it would require passing 10+ props/emits or using provide/inject, adding complexity without reuse — no other page has the same header.

**Alternative considered**: Extract `ProfileHeader.vue`. Deferred until the CV template page needs a similar header, at which point a shared pattern can be abstracted from two real uses.

### 4. Cover letter zone as a named template section

**Choice**: Add a `<section>` below the grid with a heading "Cover letter material" and a muted description. Address, My story and Writing samples move here. The section renders full-width.

**Why over a separate tab or route**: The content is small (3 sections, often partially empty) and contextually related to the profile. A tab hides it behind a click; a route fragments the page. A labeled zone keeps everything scannable on one page while signaling these aren't CV sections.

### 5. Mobile section ordering via conditional `v-if` / rendering order

**Choice**: On mobile, render sections in a different order: Summary → Experience → Skills → Education → Projects → Languages → Hobbies → Certifications → Preferences → References. Use a computed section list or conditional template blocks gated on the breakpoint composable.

**Why not CSS `order-*`**: CSS order changes visual order but not DOM/accessibility order. Tab order would mismatch what's shown. Conditional rendering keeps DOM order matching visual order.

**Alternative considered**: Keep the same order everywhere. Rejected per UX agent advice — Skills is the most-referenced section after Experience for recruiters and tailoring.

### 6. Compact empty state as a `ProfileSection` variant

**Choice**: When `compact-empty` is true (or when the section is empty and a page-level flag says the profile is not fully empty), the empty state renders as a single flex row: icon + message + add button, ~80 px tall.

The full centered empty pattern is reserved for the page-level onboarding card shown only when the entire profile is empty.

**Why**: Reduces an empty profile with 10+ sections from ~5000 px to ~1200 px of scroll.

### 7. Tablet sidebar as a 2-column grid

**Choice**: At md breakpoint (when the main lg:grid-cols-3 collapses to single column), render the sidebar sections in a `md:grid-cols-2` sub-grid. This uses the width better than full-width stacked cards for short content like Skills and Languages.

## Risks / Trade-offs

- **Mobile section reorder adds template complexity** → Mitigated by using a computed section list rather than duplicating the template. If the computed approach gets unwieldy, fall back to two template blocks with `v-if="isMobile"` / `v-else`.
- **Collapsible sections on mobile add interaction cost** → Mitigated by defaulting Summary and Experience open. Users scanning a filled profile benefit from the reduced scroll.
- **Translation controls moving to overflow reduces discoverability** → Mitigated by showing an inline "N items untranslated" prompt when translations are missing, which is more actionable than a permanent button.
- **Empty-profile onboarding card is new UI** → Low risk; it's a single `UCard` with two buttons that replaces 10 tall empty cards.

## Open Questions

- Should the "Add more sections" control for hidden minor sections be a button that reveals them, or a dropdown menu listing each? Decide during implementation based on how many sections hide (likely 3-4).
