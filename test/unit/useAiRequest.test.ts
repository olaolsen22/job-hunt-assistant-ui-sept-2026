import { describe, expect, it, vi } from 'vitest'
import { useAiRequest } from '~/composables/useAiRequest'

const ok = { errors: null }
const safety = (code: string) => ({ errors: [{ __typename: 'AiSafetyError', code }] })

describe('useAiRequest', () => {
  it('makes a valid v4 id even where crypto.randomUUID is missing (plain http)', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const { attempt } = useAiRequest()
    let id = ''
    await attempt('ad', async (requestId) => ((id = requestId), ok))
    vi.unstubAllGlobals()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('sends a new id for each action that got an answer', async () => {
    const { attempt } = useAiRequest()
    const ids: string[] = []
    await attempt('ad', async (id) => (ids.push(id), ok))
    await attempt('ad', async (id) => (ids.push(id), ok))
    expect(ids[0]).not.toBe(ids[1])
  })

  it('keeps the id for a retry after no answer, only with the same input', async () => {
    const { attempt } = useAiRequest()
    const ids: string[] = []
    const fail = async (id: string) => {
      ids.push(id)
      throw new Error('network')
    }
    await expect(attempt({ text: 'ad' }, fail)).rejects.toThrow()
    await attempt({ text: 'ad' }, async (id) => (ids.push(id), ok))
    expect(ids[1]).toBe(ids[0])

    await expect(attempt({ text: 'ad' }, fail)).rejects.toThrow()
    await attempt({ text: 'edited ad' }, async (id) => (ids.push(id), ok))
    expect(ids[3]).not.toBe(ids[2])
  })

  it('asks for confirmation only after an interrupted or lost result', async () => {
    const { attempt, safetyCode, needsConfirm, confirmRetry } = useAiRequest()
    await attempt('ad', async () => safety('daily-limit-reached'))
    expect(safetyCode.value).toBe('daily-limit-reached')
    expect(needsConfirm.value).toBe(false)

    await attempt('ad', async () => safety('result-unavailable'))
    expect(needsConfirm.value).toBe(true)
    confirmRetry()
    expect(needsConfirm.value).toBe(false)
    expect(safetyCode.value).toBeUndefined()
  })
})
