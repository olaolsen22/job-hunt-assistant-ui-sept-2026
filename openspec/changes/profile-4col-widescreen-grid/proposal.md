# Proposal

## Why

The profile page uses a `lg:grid-cols-3` grid where the main column spans 2/3 and the sidebar spans 1/3. After widening `--ui-container` to 1400px at 2xl, the extra width spreads across columns proportionally — but the main column (Experience, Summary, Projects) ends up with wide empty space while the sidebar content (Skills with 73 items, level badges, years) could use more room. Switching to a 4-column grid at 2xl makes the split 3/4 main + 1/4 sidebar, which fills the wider container with better-proportioned columns.

## What Changes

- **4-column grid at 2xl**: at the `2xl` breakpoint (≥1536px), the profile grid switches from `grid-cols-3` / `col-span-2` to `grid-cols-4` / `col-span-3`. The sidebar takes the remaining 1 column. The `lg` breakpoint keeps the current 3-column layout.
- **Loading skeleton matches**: the skeleton grid uses the same responsive 4-column pattern at 2xl.

Out of scope: changing column proportions at `lg`, altering section order, modifying sidebar sections, or touching other pages.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `user-profile`: the "Profile page" requirement changes the grid from 3 to 4 columns at the 2xl breakpoint, giving the main column 3/4 width.

## Impact

- **Code**: `app/pages/profile.vue` — grid classes on the content wrapper and skeleton. No component, composable, or test changes expected.
- **No new dependencies.**
