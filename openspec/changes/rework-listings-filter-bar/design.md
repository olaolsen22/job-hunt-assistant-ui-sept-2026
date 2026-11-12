## Context

Before screenshots (`/tmp/.../scratchpad/before/`) show the applied first attempt: the phone Filters button is clipped (three flex-1 buttons overflow 343px), tablet/desktop rows have different right edges, and the six toggles are gone from sight. `ui-ux-expert` reviewed desktop and phone screenshots plus code; tablet screenshot was seen by me (sidebar hidden, fits).

## Decisions

- **Rows:** View (existing tabs/More/Sort in `pages/listings/index.vue`), Find (search `flex-1 min-w-0`, no max width, Filters `shrink-0`), Quick filters. Sort and Filters share the right edge. Sort inline with search rejected: phones have no room.
- **Pills from one array** in `FilterPanel.vue` (`key, label, icon, count, on, toggle`), replacing the separate Favorites/Preferred buttons. Style: `UButton size="md"` rounded-full, off = neutral subtle with icon, on = primary soft with check (Favorites keeps its filled star). Counts muted `tabular-nums`. Group has `role="group" aria-label="Quick filters"`.
- **Phone:** the group is one scrollable line (`overflow-x-auto -mx-4 px-4`, verify the layout gutter); wrapping seven pills would take four rows. From `md`: `flex-wrap`, no scroll, plus a `text-xs text-muted` "Quick filters" label.
- **Pill state is not a chip.** `outsideSheet` grows to favorites, preferredLocations, norwayOnly, itRoles, nonItRoles, englishPosting, englishMentioned, companyId. Role stays two exclusive pills; the `role` computed and Norway/Role/English sheet switches are removed.
- **Sheet** keeps the headed groups from the first attempt, minus the removed toggles.
- Kept "Preferred locations" → "Preferred" at all widths; if the pills don't fit one line at exactly 1280, shorten "English mentioned" to "EN mentioned".

## Risks

- Pill row at exactly 1280px and at 1024-1279 (orphan pill) - check in screenshots.
- Phone touch height is about 36px; accepted.
