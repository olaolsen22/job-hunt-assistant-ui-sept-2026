# Proposal

## Why

The dashboard is a placeholder, so there is nowhere to see what needs attention (closing deadlines,
interviews, offers, listings left sitting) or how the hunt is going. The backend now has
`Company.favoritedAt` and `setCompanyFavorite`, which makes a favorited-companies widget possible.

## What Changes

- Replace the placeholder in `/` with a widget dashboard, keeping `DashboardApiHealth`:
  - **Urgent**: Closing soon, Upcoming interviews, Offers to answer, Stale listings.
  - **Progress**: Pipeline counts (one number per status), Applied this week, To analyze.
  - **Shortcuts**: Favorited listings, Favorited companies (each with its open listings).
- Stale = `SAVED`, not archived, no dated deadline, posted 14 to 45 days ago (older ones drop off), oldest first, shown as "N days old".
- Upcoming interviews only covers listings in `INTERVIEWING` status.
- Each widget is its own small query (about 5 rows, few fields), loads in parallel, and has its own
  loading, empty and error state. A failing widget does not blank the page.
- Each widget links to `/listings` or `/companies`. For that, `/listings` starts accepting a preset,
  statuses and the favorites facet from the URL (today it only reads `?search=`).
- Add a favorite toggle on `/companies` rows so there is a way to favorite a company.

## Capabilities

### New Capabilities

- `dashboard-overview`: the widgets on `/`, what each one shows, and how it loads and links out.

### Modified Capabilities

- `listing-browsing`: `/listings` can open with a preset, statuses or favorites already applied from the URL.
- `company-management`: companies can be favorited from the `/companies` list.

## Impact

- `app/pages/index.vue`, new `app/components/dashboard/*` widgets, a small shared widget shell.
- `app/composables/useListingsList.ts` (URL seeding), `app/pages/companies/index.vue`, a company favorite button
  modelled on `listings/FavoriteButton.vue`.
- GraphQL: `Companies` gains `favoritedAt`, a new `SetCompanyFavorite` mutation, and runtime-built widget `listings`
  queries. The schema changed (`Company.favoritedAt`), so `pnpm gql:gen` runs and `app/graphql-env.d.ts` is committed.
- Out of scope: a company favorites view/filter on `/companies`, notifications, charts or trends,
  drag-and-drop widget layout, per-user widget settings, a stale link that pre-filters by age (the
  link opens SAVED listings; the age cut-off has no URL facet), the parse queue.
