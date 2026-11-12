# Design

## Context

The profile page wraps all content in `<div class="w-full min-w-0 max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl">`. The layout shell adds `max-w-(--ui-container)` from Nuxt UI. At the `lg` breakpoint the page uses a `grid-cols-3` layout. On a 2560px monitor, the 1152px cap leaves ~1400px unused. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Use more viewport width on 2xl+ screens (≥1536px) so Experience bullets, skill names and sidebar content have more room.

**Non-Goals:**

- Changing grid proportions or column count.
- Modifying the layout shell's `--ui-container` (that affects every page).
- Touching other pages (contacts, companies use the same pattern but are out of scope).

## Decisions

### 1. Add a `2xl:max-w-[1400px]` class to the profile wrapper

**Choice**: Add a single Tailwind `2xl:max-w-[1400px]` to the outer `div` in `profile.vue`, keeping the existing `max-w-3xl` and `lg:max-w-6xl`.

**Why 1400px**: It fills ~85% of the content area on a 1920px-wide panel (after the sidebar) and ~65% on 2560px — enough to feel spacious without stretching card text uncomfortably wide. The `grid-cols-3` gives ~933px to the main column and ~467px to the sidebar, both reasonable for their content density.

**Why not `max-w-7xl` (1280px)**: Only 128px wider than 6xl — barely noticeable on ultrawide. A custom value gives a meaningful jump.

**Why not `max-w-screen-2xl` or uncapped**: At 1536px+ the lines in Experience bullets and Summary become too long to scan comfortably. A fixed cap keeps line lengths readable.

**Alternative considered**: Using `container` queries or a percentage width (e.g. `2xl:max-w-[85%]`). Rejected — percentage widths shift with the layout shell's padding and sidebar collapse state, making the result less predictable than a fixed pixel cap.

### 2. Skeleton loading matches the new width

**Choice**: The loading skeleton `div` already mirrors the outer wrapper's classes. Adding the same `2xl:max-w-[1400px]` there keeps the skeleton width consistent with the loaded page.

## Risks / Trade-offs

- **Content density at 1400px**: the main column at ~933px is wider than most content pages target. Mitigated by the fact that profile sections use cards, not free-flowing prose — card boundaries contain the content. Experience bullets are typically one-line items that benefit from fewer wraps.
- **Other pages remain narrow**: contacts, companies, and the layout container still cap earlier. This is intentional scoping, but the inconsistency is visible if the user navigates between pages on the same ultrawide monitor. A follow-up change could apply the same pattern to other detail pages.
