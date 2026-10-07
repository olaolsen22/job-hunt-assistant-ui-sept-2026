const USAGE = graphql(`
  query DashboardLlmUsage {
    llmUsageToday {
      requests
      inputTokens
      outputTokens
      requestsLimit
      remainingRequests
      resetsAt
    }
  }
`)

// Shared key: the Analyze ad modal's refresh also updates the dashboard widget. The modal passes
// immediate=false and fetches when it opens, so pages that merely contain it make no request.
export const useLlmUsage = (immediate = true) =>
  useAsyncData('dashboard-llm-usage', () => gql(USAGE), { server: false, immediate })
