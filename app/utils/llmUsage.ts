import type { LlmCallLimit } from '~/composables/useProviderKeys'
import type { LlmUsage, LlmUsageDay } from '~/composables/useLlmUsage'

// Today's request cap for the default model, read from wherever the API keeps it: the app's
// shared key has one per-model pool for every user (usage today), an own key has the owner's
// per-provider limit (llmCallLimits), and usage today reports no limit for an own key.
type UsageToday = Pick<LlmUsage, 'requests' | 'requestsLimit' | 'remainingRequests' | 'resetsAt'>

export type RequestCap = {
  used: number
  max: number | null
  left: number | null
  resetsAt: string
  // The shared pool counts every user's requests, not only the owner's.
  pooled: boolean
}
export type CapState = 'unlimited' | 'ok' | 'near' | 'reached' | 'paused'

export const requestCap = (
  ownKey: boolean,
  usage: UsageToday | null | undefined,
  limit: LlmCallLimit | null | undefined
): RequestCap | undefined => {
  // The API lists every provider's limit for the owner, so a missing one is not loaded yet (or
  // failed): the cap is unknown, which must not read as "no limit".
  if (ownKey && !limit) return undefined
  if (ownKey && limit)
    return {
      used: limit.requestsConsumed,
      max: limit.dailyRequestLimit,
      left: limit.remainingRequests,
      resetsAt: limit.resetsAt,
      pooled: false
    }
  if (!usage) return undefined
  return {
    used: usage.requests,
    max: usage.requestsLimit,
    left: usage.remainingRequests,
    resetsAt: usage.resetsAt,
    pooled: true
  }
}

// Warn from 80 % so the owner can act before a run is refused.
export const capState = (cap: Pick<RequestCap, 'used' | 'max' | 'left'>): CapState => {
  if (cap.max == null) return 'unlimited'
  if (cap.max === 0) return 'paused'
  if ((cap.left ?? cap.max - cap.used) <= 0) return 'reached'
  return cap.used >= cap.max * 0.8 ? 'near' : 'ok'
}

export type UsageLine = Omit<LlmUsageDay, 'keySource' | 'day'> & { unpriced: boolean }
export type UsageGroup = {
  lines: UsageLine[]
  requests: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  // Some rows had no price, so the total cost is a lower bound.
  partlyPriced: boolean
}

const sumGroup = (rows: LlmUsageDay[]): UsageGroup => {
  const lines = new Map<string, UsageLine>()
  for (const row of rows) {
    const key = `${row.credentialId}|${row.provider}|${row.model}`
    const line = lines.get(key)
    if (!line) {
      const { keySource: _, day: __, ...rest } = row
      lines.set(key, { ...rest, unpriced: row.estimatedCost == null })
      continue
    }
    line.requests += row.requests
    line.inputTokens += row.inputTokens
    line.outputTokens += row.outputTokens
    if (row.estimatedCost == null) line.unpriced = true
    else line.estimatedCost = (line.estimatedCost ?? 0) + row.estimatedCost
  }
  const sorted = [...lines.values()].sort((a, b) => b.requests - a.requests)
  return {
    lines: sorted,
    requests: sorted.reduce((n, l) => n + l.requests, 0),
    inputTokens: sorted.reduce((n, l) => n + l.inputTokens, 0),
    outputTokens: sorted.reduce((n, l) => n + l.outputTokens, 0),
    estimatedCost: sorted.reduce((n, l) => n + (l.estimatedCost ?? 0), 0),
    partlyPriced: sorted.some((l) => l.unpriced)
  }
}

// Daily rows (day × provider × model × key) folded into one line per model and key. Own keys and
// the app's key stay apart: the shared rows count every user, so a sum of both means nothing.
export const summarizeUsage = (rows: readonly LlmUsageDay[]) => ({
  own: sumGroup(rows.filter((r) => r.keySource === 'USER')),
  shared: sumGroup(rows.filter((r) => r.keySource === 'SHARED'))
})
