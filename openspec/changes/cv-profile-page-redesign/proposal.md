# Proposal

## Why

The profile page is the longest and most section-dense page in the app, but its layout hasn't been revisited since the sections were first added. Empty states take excessive vertical space, the header packs identity, actions and translation controls into a dense band, and on mobile everything stacks into an extremely long scroll with no progressive disclosure. This redesign establishes a standard page pattern — header, section cards, responsive grid — that the CV templates and tailored CV pages will follow next.

## What Changes

- **Compact empty states**: replace the tall centered-icon cards (~470 px) with a single-line row (~80 px) per empty section. Show a single onboarding card for a fully empty profile.
- **Header reorganization**: split into identity row (name + headline + primary action + overflow menu) and a compact contact/links row. Move secondary actions (Import CV, Refine bullets, Clear) into the overflow menu. On mobile, collapse secondary actions into the menu.
- **Translation controls**: replace the bordered strip with a language badge/indicator in the header area and move translate actions into the overflow menu or an inline prompt when translations are missing.
- **Section grouping**: visually separate "Cover letter material" (Address, My story, Writing samples) from CV sections. Place it full-width below the two-column grid.
- **Mobile collapsible sections**: on mobile only, make section cards collapsible with a header toggle. Default Summary and Experience open; the rest collapsed showing a count ("Skills · 12").
- **Section ordering on mobile**: move Skills right after Experience for scannability, since it sits high on desktop already via the sidebar.
- **Sidebar sections at tablet**: render sidebar cards (Skills, Languages, Hobbies, Certifications) in a 2-column grid at tablet width, instead of full-width stacked.

## Capabilities

### New Capabilities

_None — this is a layout and UX rework of an existing page._

### Modified Capabilities

- `user-profile`: the "Profile page" and "Empty sections" requirements change to reflect compact empty states, collapsible mobile sections, reorganized header, separated cover letter zone, and updated section ordering on narrower screens.

## Impact

- **Code**: `app/pages/profile.vue`, `app/components/profile/Section.vue`, and possibly a new shared `CollapsibleSection` wrapper. Header area refactored into a sub-component or restructured template. Section ordering changes in the page template.
- **Components**: `ProfileSection` gains a `collapsible` prop and item count display. Empty state variant becomes compact by default.
- **Tests**: existing profile page tests updated for changed structure and testids.
- **No API changes**: all data and mutations remain the same.
- **No new dependencies**: uses existing Nuxt UI components and Tailwind classes.
