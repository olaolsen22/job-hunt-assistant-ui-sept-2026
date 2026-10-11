import { describe, expect, it, vi } from 'vitest'
import type { CollectedJob } from '~/utils/collectedJobs'
import {
  COLLECTED_JOB_TEXT_LIMIT,
  OversizedCollectedJobError,
  collectedJobBatchPosting,
  decodeCollectedJobReply,
  planCollectedJobBatches
} from '~/utils/collectedJobBatches'
import { useCollectedJobProcessing } from '~/composables/useCollectedJobProcessing'

const jobs = (count: number): CollectedJob[] =>
  Array.from({ length: count }, (_, i) => ({ title: `Job ${i}`, url: `https://example.com/${i}` }))

describe('planCollectedJobBatches', () => {
  it.each([0, 1, 20, 21, 43])('plans %i jobs without reordering or dropping fields', (count) => {
    const input = jobs(count).map((job) => ({ ...job, locations: [{ city: 'Oslo' }] }))
    const batches = planCollectedJobBatches(input)
    expect(batches.flat()).toEqual(input)
    expect(batches.every((batch) => batch.length <= 20)).toBe(true)
    expect(batches.map((batch) => batch.length)).toEqual(
      count === 43 ? [20, 20, 3] : count === 21 ? [20, 1] : count ? [count] : []
    )
  })

  it('splits by compact serialized size while preserving escaped and nested values', () => {
    const input = jobs(3).map((job) => ({
      ...job,
      description: 'a"\\'.repeat(2_200),
      details: { city: 'Oslo' }
    }))
    const batches = planCollectedJobBatches(input)
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.every((batch) => JSON.stringify(batch).length <= COLLECTED_JOB_TEXT_LIMIT)).toBe(
      true
    )
    expect(JSON.parse(collectedJobBatchPosting(batches[0]!))).toEqual(batches[0])
    expect(batches.flatMap((batch) => JSON.parse(collectedJobBatchPosting(batch)))).toEqual(input)
  })

  it('rejects a single oversized complete object before processing', () => {
    const input = [
      { title: 'Huge', url: 'https://example.com', body: 'x'.repeat(COLLECTED_JOB_TEXT_LIMIT) }
    ]
    expect(() => planCollectedJobBatches(input)).toThrow(OversizedCollectedJobError)
  })
})

describe('decodeCollectedJobReply', () => {
  it('accepts a full array wrapped in prose', () => {
    expect(decodeCollectedJobReply('Here you go: [{"title":"A"}] done', 1)).toEqual([
      { title: 'A' }
    ])
  })

  it.each(['bad', 'null', '{"listings":[{},{}]}', '[null,null]', '[1,2]', '[[{}],{}]', '[{}]'])(
    'rejects malformed or incomplete replies: %s',
    (reply) => {
      expect(() => decodeCollectedJobReply(reply, 2)).toThrow()
    }
  )
})

const reply = (count: number) => ({
  result: JSON.stringify(Array.from({ length: count }, (_, i) => ({ title: `${i}` })))
})

describe('useCollectedJobProcessing', () => {
  it('processes batches sequentially and preserves original result order', async () => {
    let resolveFirst!: (value: { result: string }) => void
    const calls: string[] = []
    const parse = vi.fn((posting: string) => {
      calls.push(posting)
      if (calls.length === 1)
        return new Promise<{ result: string }>((resolve) => (resolveFirst = resolve))
      return Promise.resolve(reply(JSON.parse(posting).length))
    })
    const runner = useCollectedJobProcessing(parse)
    runner.start(jobs(21))
    expect(calls).toHaveLength(1)
    resolveFirst(reply(20))
    await vi.waitFor(() => expect(runner.status.value).toBe('finished'))
    expect(calls).toHaveLength(2)
    expect(runner.completed.value).toBe(21)
    expect(runner.accepted.value.map((row) => row.title)).toEqual(
      [...Array(20).keys(), 0].map(String)
    )
  })

  it('pauses malformed replies without accepting partial rows or counting progress', async () => {
    const runner = useCollectedJobProcessing(async () => ({ result: '[{"title":"only one"}]' }))
    runner.start(jobs(2))
    await vi.waitFor(() => expect(runner.status.value).toBe('paused'))
    expect(runner.completed.value).toBe(0)
    expect(runner.accepted.value).toEqual([])
    expect(runner.error.value).toContain('Expected 2')
  })

  it('supports retry, skip, and stop with accurate counts', async () => {
    let fail = true
    const runner = useCollectedJobProcessing(async (posting) => {
      if (fail) return { error: 'offline' }
      return reply(JSON.parse(posting).length)
    })
    runner.start(jobs(21))
    await vi.waitFor(() => expect(runner.status.value).toBe('paused'))
    fail = false
    runner.retry()
    await vi.waitFor(() => expect(runner.status.value).toBe('finished'))
    expect(runner.completed.value).toBe(21)

    const skipped = useCollectedJobProcessing(async () => ({ error: 'offline' }))
    skipped.start(jobs(21))
    await vi.waitFor(() => expect(skipped.status.value).toBe('paused'))
    skipped.skip()
    await vi.waitFor(() => expect(skipped.status.value).toBe('paused'))
    expect(skipped.skipped.value).toBe(20)
    skipped.stop()
    expect(skipped.unprocessed.value).toBe(1)
  })

  it('pauses again after a repeated failure and does not replay accepted batches', async () => {
    let attempt = 0
    const runner = useCollectedJobProcessing(async (posting) => {
      attempt += 1
      const count = JSON.parse(posting).length
      if (attempt === 2 || attempt === 3) return { error: 'temporary failure' }
      return reply(count)
    })
    runner.start(jobs(21))
    await vi.waitFor(() => expect(runner.status.value).toBe('paused'))
    expect(runner.completed.value).toBe(20)
    runner.retry()
    await vi.waitFor(() => expect(attempt).toBe(3))
    expect(runner.status.value).toBe('paused')
    expect(runner.completed.value).toBe(20)
    runner.retry()
    await vi.waitFor(() => expect(runner.status.value).toBe('finished'))
    expect(attempt).toBe(4)
    expect(runner.completed.value).toBe(21)
  })

  it('does not start a request when a later item is oversized', () => {
    const parse = vi.fn()
    const runner = useCollectedJobProcessing(parse)
    expect(() =>
      runner.start([
        ...jobs(21),
        { url: 'https://example.com/huge', description: 'x'.repeat(12_000) }
      ])
    ).toThrow('Job 22')
    expect(parse).not.toHaveBeenCalled()
  })

  it('keeps stopped partial results and ignores an in-flight response without starting more batches', async () => {
    let resolveSecond!: (value: { result: string }) => void
    const parse = vi.fn((posting: string) =>
      parse.mock.calls.length === 1
        ? Promise.resolve({ result: posting })
        : new Promise<{ result: string }>((resolve) => {
            resolveSecond = resolve
          })
    )
    const runner = useCollectedJobProcessing(parse)
    runner.start(jobs(43))
    await vi.waitFor(() => expect(parse).toHaveBeenCalledTimes(2))
    runner.stop()
    expect(runner.completed.value).toBe(20)
    expect(runner.unprocessed.value).toBe(23)
    expect(runner.accepted.value).toHaveLength(20)
    expect(runner.markPublished()).toBe(true)
    expect(runner.markPublished()).toBe(false)
    resolveSecond(reply(20))
    await Promise.resolve()
    expect(parse).toHaveBeenCalledTimes(2)
    expect(runner.accepted.value).toHaveLength(20)
    expect(runner.status.value).toBe('stopped')
  })

  it('ignores a late response after invalidation', async () => {
    let resolve!: (value: { result: string }) => void
    const runner = useCollectedJobProcessing(() => new Promise((done) => (resolve = done)))
    runner.start(jobs(1))
    runner.invalidate()
    resolve(reply(1))
    await Promise.resolve()
    expect(runner.accepted.value).toEqual([])
    expect(runner.status.value).toBe('idle')
  })
})
