import type { Component } from 'vue'
import type { DashboardWidgetKind } from '~/composables/useDashboardLayout'
import AppliedThisWeek from '~/components/dashboard/AppliedThisWeek.vue'
import ClosingSoon from '~/components/dashboard/ClosingSoon.vue'
import FavoriteCompanies from '~/components/dashboard/FavoriteCompanies.vue'
import FavoriteListings from '~/components/dashboard/FavoriteListings.vue'
import Interviews from '~/components/dashboard/Interviews.vue'
import LlmUsage from '~/components/dashboard/LlmUsage.vue'
import Offers from '~/components/dashboard/Offers.vue'
import Pipeline from '~/components/dashboard/Pipeline.vue'
import Stale from '~/components/dashboard/Stale.vue'
import ToAnalyze from '~/components/dashboard/ToAnalyze.vue'

// One entry per kind the API knows. Typed as a Record so a kind the backend adds fails typecheck here
// instead of silently not rendering. Components are imported, not looked up by name: Nuxt's auto-imports
// only resolve literal names in templates, and a name from the API is a runtime string.
// The grid has one column on phones, two from `sm` and three from `xl`. `span` widgets get more room:
// `full` takes the whole row, `2` two columns (the whole row below `xl`).
export const DASHBOARD_WIDGETS: Record<
  DashboardWidgetKind,
  { label: string; icon: string; component: Component; span?: 'full' | 2 }
> = {
  CLOSING_SOON: { label: 'Closing soon', icon: 'i-lucide-alarm-clock', component: ClosingSoon },
  UPCOMING_INTERVIEWS: {
    label: 'Upcoming interviews',
    icon: 'i-lucide-calendar-clock',
    component: Interviews
  },
  OFFERS_TO_ANSWER: { label: 'Offers to answer', icon: 'i-lucide-handshake', component: Offers },
  STALE_LISTINGS: { label: 'Stale listings', icon: 'i-lucide-hourglass', component: Stale },
  PIPELINE: { label: 'Pipeline', icon: 'i-lucide-kanban', component: Pipeline, span: 'full' },
  APPLIED_THIS_WEEK: {
    label: 'Applied this week',
    icon: 'i-lucide-send',
    component: AppliedThisWeek
  },
  TO_ANALYZE: { label: 'To analyze', icon: 'i-lucide-clock', component: ToAnalyze },
  FAVORITED_LISTINGS: {
    label: 'Favorited listings',
    icon: 'i-lucide-star',
    component: FavoriteListings
  },
  FAVORITED_COMPANIES: {
    label: 'Favorited companies',
    icon: 'i-lucide-building-2',
    component: FavoriteCompanies,
    span: 2
  },
  LLM_USAGE: { label: 'LLM usage', icon: 'i-lucide-sparkles', component: LlmUsage }
}
