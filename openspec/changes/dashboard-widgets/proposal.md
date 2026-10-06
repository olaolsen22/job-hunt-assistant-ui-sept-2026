# Proposal

## Why

The dashboard is a placeholder, so there is nowhere to see what needs attention (closing deadlines,
interviews, offers, listings left sitting) or how the hunt is going. The backend now has
`Company.favoritedAt` and `setCompanyFavorite`, which makes a favorited-companies widget possible.

## What Changes

- Replace the placeholder in `/` with a widget dashboard, keeping `DashboardApiHealth`. Ten widgets: Closing soon,
  Upcoming interviews, Offers to answer, Stale listings, Pipeline counts (one number per status), Applied this week,
  To analyze, Favorited listings, Favorited companies (each with its open listings), LLM usage (today's requests against the
  daily limit, from `llmUsageToday`).
- The user chooses which widgets show and in what order. The backend stores that per user (`dashboardLayout`,
  `saveDashboardLayout`: all ten widgets, full replace, never saved = default order, all shown). `/` renders the
  shown widgets in the saved order as one grid (Pipeline spans the full row), with no group headings, and hidden
  widgets are not mounted, so they send no queries.
- An "Edit dashboard" mode: move each widget up or down, show or hide it, "Reset to default" (default order, all
  shown, still unsaved), then Save (one `saveDashboardLayout`) or Cancel. Hidden widgets stay listed in edit mode.
  The API's `InvalidDashboardLayoutError` message is shown if a save is rejected.
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

- `app/pages/index.vue` (renders from the saved layout), new `app/components/dashboard/*` widgets, a shared widget shell, a
  layout editor, and a widget registry (`app/constants/dashboard.ts`) mapping each `DashboardWidgetKind` to its component.
- `app/composables/useListingsList.ts` (URL seeding), `app/pages/companies/index.vue`, a company favorite button
  modelled on `listings/FavoriteButton.vue`.
- GraphQL: `Companies` gains `favoritedAt`; new `SetCompanyFavorite`, `DashboardLayout` and `SaveDashboardLayout`
  documents; one literal `listings` query per widget. The schema changed, so `pnpm gql:gen` runs and
  `app/graphql-env.d.ts` is committed.
- Out of scope: LLM cost and daily history (`usageDaily`), drag-and-drop reordering, per-widget settings (row counts, thresholds), resizing, a one-click reset
  that saves immediately, a company favorites view/filter on `/companies`, notifications, charts or trends, a stale
  link that pre-filters by age (it opens SAVED listings; the age cut-off has no URL facet), the parse queue.
