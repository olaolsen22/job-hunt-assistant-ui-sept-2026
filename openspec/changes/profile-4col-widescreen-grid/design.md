# Design

## Context

The profile page grid is `lg:grid-cols-3` with the main column as `lg:col-span-2`. At 2xl, the `--ui-container` override widens the page to 1400px. In the current 3-column split, the main column gets ~933px (67%) and the sidebar ~467px (33%). The main column's content (section cards with bullets, summary text) doesn't fill the extra width, while the sidebar could use the room. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Give the main column 75% of the grid at 2xl so Experience cards and Summary use space more proportionally.

**Non-Goals:**

- Changing the lg grid (3-column stays for standard desktop).
- Altering section content, order, or sidebar sections.

## Decisions

### 1. Add responsive 2xl grid classes

**Choice**: Add `2xl:grid-cols-4` to the grid wrapper and `2xl:col-span-3` to the main column div. No changes to the sidebar div — it naturally takes the remaining 1 column.

At 1400px container width:

- Main column: 3/4 = 1050px (was 933px)
- Sidebar: 1/4 = 350px (was 467px)

**Why 4-column over custom fractions**: Tailwind's `grid-cols-4` and `col-span-3` are built-in utilities with no arbitrary values. The 75/25 split is standard and well-tested.

**Alternative considered**: `grid-cols-[3fr_1fr]` arbitrary value. Rejected — the same result is achieved with built-in classes.

### 2. Loading skeleton matches the grid

**Choice**: The skeleton's grid div gets the same `2xl:grid-cols-4` class, and its main skeleton gets `2xl:col-span-3`, keeping the skeleton layout consistent with the loaded page.

## Risks / Trade-offs

- **Sidebar at 350px**: narrower than the current 467px at 2xl. Skills rows show name, level badge, and years. At 350px this should still fit, but long translated skill descriptions may truncate more. Acceptable — the sidebar is already 350px at the standard lg breakpoint (1152px / 3 = 384px).
- **Consistent with `carry-profile-layout-to-cv-pages`**: that in-progress change uses the same `lg:grid-cols-3` pattern. It would need a matching `2xl:grid-cols-4` update later, but it's out of scope here.
