// Shapes of ProviderKeyFields and LlmCallLimitFields (useProviderKeys.ts). The API supports
// gemini, openai and mistral; a provider without a key still has a "not connected" row.
export const providerKey = (provider: string, last4: string | null = null, extra: object = {}) => ({
  provider,
  configured: !!last4,
  credentialId: last4 ? `${provider}-${last4}` : null,
  last4,
  createdAt: last4 ? '2026-10-13T08:00:00Z' : null,
  retiredAt: null as string | null,
  ...extra
})

// A key that was replaced or removed: still listed with includeRetired, so usage can name it.
export const retiredKey = (provider: string, last4: string) =>
  providerKey(provider, last4, { configured: false, retiredAt: '2026-11-01T09:00:00Z' })

export const callLimit = (provider: string, dailyRequestLimit: number | null, used = 2) => ({
  provider,
  dailyRequestLimit,
  requestsConsumed: used,
  remainingRequests: dailyRequestLimit == null ? null : Math.max(0, dailyRequestLimit - used),
  resetsAt: '2026-11-19T00:00:00Z'
})

// llmUsageToday as DashboardLlmUsage asks for it.
export const usageToday = (extra: object = {}) => ({
  model: 'fast',
  provider: 'gemini',
  keySource: 'SHARED',
  requests: 40,
  inputTokens: 12000,
  outputTokens: 3000,
  requestsLimit: 500,
  remainingRequests: 460,
  resetsAt: '2026-11-19T08:00:00Z',
  ...extra
})
