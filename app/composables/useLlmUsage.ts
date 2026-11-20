import type { ResultOf } from 'gql.tada'

const USAGE = graphql(`
  query DashboardLlmUsage {
    llmUsageToday {
      model
      provider
      keySource
      requests
      inputTokens
      outputTokens
      requestsLimit
      remainingRequests
      resetsAt
    }
  }
`)

const HISTORY = graphql(`
  query LlmUsageHistory($days: Int!) {
    usageDaily(days: $days) {
      day
      model
      provider
      keySource
      credentialId
      requests
      inputTokens
      outputTokens
      estimatedCost
    }
  }
`)

// Shared key: the Analyze ad modal's refresh also updates the dashboard widget. The modal passes
// immediate=false and fetches when it opens, so pages that merely contain it make no request.
export const useLlmUsage = (immediate = true) =>
  useAsyncData('dashboard-llm-usage', () => gql(USAGE), { server: false, immediate })

export type LlmUsage = ResultOf<typeof USAGE>['llmUsageToday']

// Owner only (Settings): the last `days` Pacific-time days, one row per day, model and key.
export const useLlmUsageHistory = (days: Ref<number>) =>
  useAsyncData('llm-usage-history', () => gql(HISTORY, { days: days.value }), {
    server: false,
    watch: [days]
  })

export type LlmUsageDay = ResultOf<typeof HISTORY>['usageDaily'][number]

// Today's cap for a model, the same rule everywhere (Settings, the dashboard, the AI cost notice):
// the app's key has a shared per-model pool in usage today; an own key has the owner's limit for
// its provider, which is only fetched once an own key is in play.
export const useRequestCap = (
  usage: MaybeRefOrGetter<LlmUsage | null | undefined>,
  model: MaybeRefOrGetter<{ provider: string; keySource: 'SHARED' | 'USER' } | null | undefined>
) => {
  const ownKey = computed(() => toValue(model)?.keySource === 'USER')
  const { limits, status, error, execute } = useLlmCallLimits(false)
  watch(
    ownKey,
    (own) => {
      if (own && status.value === 'idle') execute()
    },
    { immediate: true }
  )
  const cap = computed(() =>
    requestCap(
      ownKey.value,
      toValue(usage),
      limits.value.find((l) => l.provider === toValue(model)?.provider)
    )
  )
  const state = computed(() => cap.value && capState(cap.value))
  // Waiting on the own key's limit: without it the cap is unknown, not "no limit".
  const loading = computed(
    () => ownKey.value && !error.value && (status.value === 'idle' || status.value === 'pending')
  )
  return { ownKey, cap, state, loading }
}
