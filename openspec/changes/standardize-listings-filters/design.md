## Context

`ListingsFilterPanel` renders the search row, six `QUICK_TOGGLES` pills with counts, chips and the `AppFilterSheet`. `pages/listings/index.vue` renders the preset tabs/selects and sort. `ui-ux-expert` was consulted (the owner chose its mental model; see below). The facet model, `QUICK` count queries and URL parameters in `useListingsList` already do what is needed.

## Decisions

- **Mental model:** view → narrow → order → active chips. Presets stay one mutually exclusive `filter` (tabs / More / phone select); "Incl. expired" and "Archived" stay there because they change the dataset in the query, not a facet (the advisor suggested moving "Incl. expired"; rejected for that reason).
- **Presentation-only change.** `QUICK_TOGGLES` and `quickCounts` stay; only where they render changes. No facet, query or URL edits, so deep links and `buildListingsQuery` tests are untouched.
- **Two inline toggles** (Favorites, Preferred locations); everything else in the sheet. `outsideSheet` shrinks to `favorites`, `preferredLocations`, `companyId`, so the badge and sheet Clear cover the moved facets; Clear all is unchanged.
- **Role control:** a three-option pill group (`UTabs`, as the preset tabs use) over `itRoles`/`nonItRoles`; setting one clears the other as the existing `EXCLUSIVE` rule does. English posting stays a separate switch from Posting language (merging would need a facet/URL change).
- **Sheet groups:** plain headings (Status, Location, Role, Language, Skills, Dates) in the `AppFilterSheet` default slot; markup stays in the listings panel since only one screen uses groups. `AppFilterSheet`/`AppFilterChips` unchanged, so Companies is unaffected.
- **Chips** for the moved toggles are added to the panel's chip list.
- **Responsive:** phone keeps the two selects (add visible "View"/"Sort" labels if they fit) and puts search full width above one three-button row; from `md` button labels show (today only from `lg`); tablet tabs get a bounded `overflow-x-auto` wrapper so they never push Sort over them. Search keeps a max width on desktop.

## Risks

- Tests and e2e selecting `listings-facet-<key>` pills outside the sheet must target the sheet (teleported) instead; the helper `inSheet` exists in `FilterPanel.test.ts`.
- Touch height and the soft keyboard over the sheet's Skill/Location inputs need a visual check at 375px; if the footer is hidden, fix within the existing slideover rather than adding a component.
- Hiding the pills makes them one tap deeper; acceptable per owner request, and the two inline toggles are the swap point if usage differs.
