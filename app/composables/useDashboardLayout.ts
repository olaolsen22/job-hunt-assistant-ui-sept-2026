import type { ResultOf } from 'gql.tada'

const DASHBOARD_LAYOUT = graphql(`
  query DashboardLayout {
    dashboardLayout {
      widget
      isShown
    }
  }
`)

export type DashboardLayout = ResultOf<typeof DASHBOARD_LAYOUT>['dashboardLayout']
export type DashboardWidgetKind = DashboardLayout[number]['widget']

// Always all ten widgets in the user's order (a never-saved layout comes back as the default one).
// Client-only like the widgets themselves: it needs the session cookie.
export const useDashboardLayout = () => {
  const { data, status, error, refresh } = useAsyncData(
    'dashboard-layout',
    () => gql(DASHBOARD_LAYOUT).then((r) => r.dashboardLayout),
    { server: false }
  )
  return {
    layout: data,
    loading: computed(() => status.value === 'idle' || status.value === 'pending'),
    error,
    refresh
  }
}
