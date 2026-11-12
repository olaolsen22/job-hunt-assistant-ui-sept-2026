# Proposal

## Why

The profile page redesign capped its width at `max-w-6xl` (1152px). On screens 2560px and wider, barely half the viewport is used — the content floats in a narrow column with ~1400px of dead space. This wastes the extra real estate that could give the dense Skills sidebar and multi-line Experience bullets more room to breathe.

## What Changes

- **Wider max-width at 2xl+**: raise the profile page's maximum width at the `2xl` breakpoint (≥1536px) so the 3-column grid fills more of the viewport on ultrawide monitors. The existing `max-w-3xl` (phone) and `lg:max-w-6xl` (desktop) stay; only the uppermost cap grows.
- **Sidebar width at wide viewports**: let the sidebar column (Skills, Languages, Hobbies, Certifications, Preferences) benefit from the extra space so long skill names, descriptions, and level badges don't truncate.
- **Cover letter zone**: the full-width zone below the grid stretches with the new cap.

Out of scope: changing the 3-column grid proportions, adding new columns, altering section order, modifying the layout shell's `--ui-container`, or touching pages other than `/profile`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `user-profile`: the "Profile page" requirement changes to allow the page to grow wider at the `2xl` breakpoint so ultrawide screens use more of their viewport.

## Impact

- **Code**: `app/pages/profile.vue` — only the outer width-capping `div` class changes. No component, composable, or test changes expected.
- **No new dependencies.**
