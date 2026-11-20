import { describe, expect, it } from 'vitest'
import { capState, requestCap, summarizeUsage } from '~/utils/llmUsage'

const usageToday = (extra: object = {}) => ({
  requests: 40,
  requestsLimit: 500,
  remainingRequests: 460,
  resetsAt: '2026-11-19T08:00:00Z',
  ...extra
})
const providerLimit = (extra: object = {}) => ({
  dailyRequestLimit: 50,
  requestsConsumed: 45,
  remainingRequests: 5,
  resetsAt: '2026-11-19T00:00:00Z',
  ...extra
})

type Row = Parameters<typeof summarizeUsage>[0][number]
const row = (extra: Partial<Row> = {}): Row => ({
  model: 'gemini-2.5-flash',
  provider: 'gemini',
  keySource: 'SHARED',
  credentialId: 'shared-gemini',
  requests: 10,
  inputTokens: 1000,
  outputTokens: 200,
  estimatedCost: 0.5,
  ...extra
})

describe('requestCap', () => {
  it('uses the shared pool on the app’s key, counted for all users', () => {
    expect(requestCap(false, usageToday(), providerLimit())).toEqual({
      used: 40,
      max: 500,
      left: 460,
      resetsAt: '2026-11-19T08:00:00Z',
      pooled: true
    })
  })

  it('uses the owner’s provider limit on an own key', () => {
    expect(requestCap(true, usageToday(), providerLimit())).toEqual({
      used: 45,
      max: 50,
      left: 5,
      resetsAt: '2026-11-19T00:00:00Z',
      pooled: false
    })
  })

  // The API lists every provider's limit for the owner: a missing one is unknown, not "no limit".
  it('has no cap on an own key until its provider limit is known, whatever usage reports', () => {
    expect(requestCap(true, usageToday(), undefined)).toBeUndefined()
  })

  it('is undefined before usage has loaded on the app’s key', () => {
    expect(requestCap(false, undefined, providerLimit())).toBeUndefined()
    expect(requestCap(false, null, undefined)).toBeUndefined()
  })
})

describe('capState', () => {
  it.each([
    [{ used: 3, max: null, left: null }, 'unlimited'],
    [{ used: 0, max: 0, left: 0 }, 'paused'],
    [{ used: 79, max: 100, left: 21 }, 'ok'],
    [{ used: 80, max: 100, left: 20 }, 'near'],
    [{ used: 100, max: 100, left: 0 }, 'reached'],
    // The API's remaining count wins over used/max (e.g. it counts a request in flight).
    [{ used: 50, max: 100, left: 0 }, 'reached'],
    // Without a remaining count, used/max decides.
    [{ used: 120, max: 100, left: null }, 'reached']
  ] as const)('%o is %s', (cap, state) => {
    expect(capState(cap)).toBe(state)
  })
})

describe('summarizeUsage', () => {
  it('keeps own keys and the app’s key apart', () => {
    const { own, shared } = summarizeUsage([
      row({ requests: 7 }),
      row({
        keySource: 'USER',
        provider: 'openai',
        model: 'gpt-4.1-mini',
        credentialId: 'k1',
        requests: 3
      })
    ])

    expect(own.requests).toBe(3)
    expect(own.lines.map((l) => l.model)).toEqual(['gpt-4.1-mini'])
    expect(shared.requests).toBe(7)
    expect(shared.lines.map((l) => l.model)).toEqual(['gemini-2.5-flash'])
  })

  it('folds days into one line per model and key, busiest first', () => {
    const { own } = summarizeUsage([
      row({ keySource: 'USER', credentialId: 'k1', requests: 2, estimatedCost: 0.1 }),
      row({ keySource: 'USER', credentialId: 'k1', requests: 3, estimatedCost: 0.2 }),
      // Same model on a replaced key is a line of its own.
      row({ keySource: 'USER', credentialId: 'k0', requests: 9, estimatedCost: 1 })
    ])

    expect(own.lines.map((l) => [l.credentialId, l.requests])).toEqual([
      ['k0', 9],
      ['k1', 5]
    ])
    expect(own.lines[1]).toMatchObject({ inputTokens: 2000, outputTokens: 400, unpriced: false })
    expect(own.lines[1]!.estimatedCost).toBeCloseTo(0.3)
    expect(own).toMatchObject({ requests: 14, inputTokens: 3000, outputTokens: 600 })
    expect(own.estimatedCost).toBeCloseTo(1.3)
    expect(own.partlyPriced).toBe(false)
  })

  it('marks a line and its group partly priced when a day has no price', () => {
    const { shared } = summarizeUsage([
      row({ estimatedCost: null, requests: 4 }),
      row({ estimatedCost: 0.25, requests: 1 }),
      row({ model: 'gemini-2.5-pro', estimatedCost: 2, requests: 1 })
    ])

    const flash = shared.lines.find((l) => l.model === 'gemini-2.5-flash')!
    expect(flash).toMatchObject({ requests: 5, unpriced: true, estimatedCost: 0.25 })
    expect(shared.partlyPriced).toBe(true)
    expect(shared.estimatedCost).toBeCloseTo(2.25)
  })

  it('leaves a never-priced line without a cost', () => {
    const { shared } = summarizeUsage([row({ estimatedCost: null }), row({ estimatedCost: null })])

    expect(shared.lines[0]).toMatchObject({ estimatedCost: null, unpriced: true, requests: 20 })
    expect(shared.estimatedCost).toBe(0)
  })

  it('returns empty groups for no rows', () => {
    const { own, shared } = summarizeUsage([])
    expect(own).toEqual({
      lines: [],
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      partlyPriced: false
    })
    expect(shared.lines).toEqual([])
  })
})
