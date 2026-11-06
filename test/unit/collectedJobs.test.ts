import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gql } from '~/utils/graphql'
import {
  collectedJobsPosting,
  parseCollectedJobs,
  prepareCollectedJobs
} from '~/utils/collectedJobs'

vi.mock('~/utils/graphql', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/graphql')>()),
  gql: vi.fn()
}))

const check = vi.mocked(gql)
const jobs = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    url: `https://jobs.example/${index}`,
    text: `Job ${index}`
  }))
const results = (urls: string[]) =>
  urls.map((normalizedUrl, index) => ({
    index,
    normalizedUrl,
    existingListingIds: [] as number[],
    shouldProcess: true
  }))
const acceptAll = () => {
  check.mockImplementation(async (_document, variables) => ({
    checkListingUrls: results(variables!.urls as string[])
  }))
}
beforeEach(() => {
  check.mockReset()
})

describe('collected jobs', () => {
  it('accepts full listing objects without text and preserves every field', async () => {
    const rows = [
      {
        title: 'Seasonal Waiter',
        companyName: 'A. C. Perchs Thehandel',
        jobRoleName: 'Waiter',
        url: 'https://arbeidsplassen.nav.no/stillinger/stilling/ee9e3293-53bf-42ae-93f7-8d137dd2ecac',
        postedOn: '2026-10-09',
        deadlineType: 'ASAP',
        deadlineOn: null,
        locations: [{ city: 'Oslo', countryCode: 'NO' }]
      }
    ]
    expect(parseCollectedJobs(JSON.stringify(rows))).toEqual(rows)
    acceptAll()
    const prepared = await prepareCollectedJobs(JSON.stringify(rows))
    expect(prepared.rows).toEqual(rows)
    expect(check.mock.calls[0]![1]).toEqual({ urls: [rows[0]!.url] })
    expect(JSON.parse(collectedJobsPosting(prepared.rows))).toEqual(rows)
  })

  it('trims URLs only for the check, preserving the original object and optional text', async () => {
    const rows = [{ url: ' https://jobs.example/1 ', text: ' Ad\ntext ', extra: { keep: true } }]
    acceptAll()
    const prepared = await prepareCollectedJobs(JSON.stringify(rows))
    expect(check.mock.calls[0]![1]).toEqual({ urls: ['https://jobs.example/1'] })
    expect(prepared.rows).toEqual(rows)
    expect(JSON.parse(collectedJobsPosting(prepared.rows))).toEqual(rows)
    expect(collectedJobsPosting([])).toBe('')
  })

  it.each([
    ['not JSON', 'valid JSON array'],
    ['{}', 'at least one'],
    ['[]', 'at least one'],
    ['[null]', 'Job 1'],
    ['[{"url":"ftp://jobs.example/1","text":"Ad"}]', 'http(s) URL'],
    ['[{"url":"https://","text":"Ad"}]', 'http(s) URL'],
    ['[{"url":"https://jobs.example/a b","text":"Ad"}]', 'http(s) URL'],
    ['[{"text":"Ad"}]', 'http(s) URL'],
    ['[{"url":2}]', 'http(s) URL'],
    ['[[]]', 'listing object']
  ])('rejects invalid collection %s before checking', async (source, message) => {
    await expect(prepareCollectedJobs(source)).rejects.toThrow(message)
    expect(check).not.toHaveBeenCalled()
  })

  it('maps shuffled results by index and follows the API eligibility decision', async () => {
    const rows = jobs(4)
    const response = results(rows.map((row) => row.url))
    response[1]!.shouldProcess = false
    response[3]!.shouldProcess = false
    response[1]!.existingListingIds = [41, 42]
    check.mockResolvedValue({ checkListingUrls: response.reverse() })
    const prepared = await prepareCollectedJobs(JSON.stringify(rows))
    expect(prepared).toMatchObject({ rows: [rows[0], rows[2]], remaining: 2, skipped: 2 })
    // Every job keeps what the check found, in file order: new, saved, new, repeat.
    expect(prepared.jobs).toEqual([
      { job: rows[0], savedListingIds: [], isRepeat: false },
      { job: rows[1], savedListingIds: [41, 42], isRepeat: false },
      { job: rows[2], savedListingIds: [], isRepeat: false },
      { job: rows[3], savedListingIds: [], isRepeat: true }
    ])
  })

  it('checks 201 rows in chunks with fresh local indexes and keeps original order', async () => {
    acceptAll()
    const rows = jobs(201)
    expect(await prepareCollectedJobs(JSON.stringify(rows))).toMatchObject({
      rows,
      remaining: 201,
      skipped: 0
    })
    expect(check.mock.calls.map((call) => call[1]!.urls)).toEqual([
      rows.slice(0, 100).map((row) => row.url),
      rows.slice(100, 200).map((row) => row.url),
      [rows[200]!.url]
    ])
  })

  it('skips normalized repeats across batches, including an earlier skipped URL', async () => {
    const rows = jobs(102)
    const first = results(rows.slice(0, 100).map((row) => row.url))
    first[1]!.shouldProcess = false
    check
      .mockResolvedValueOnce({ checkListingUrls: first })
      .mockResolvedValueOnce({ checkListingUrls: results([rows[0]!.url, rows[1]!.url]) })
    const prepared = await prepareCollectedJobs(JSON.stringify(rows))
    expect(prepared).toMatchObject({
      rows: [rows[0], ...rows.slice(2, 100)],
      remaining: 99,
      skipped: 3
    })
    expect(collectedJobsPosting(prepared.rows)).not.toContain('Job 100')
    expect(JSON.parse(collectedJobsPosting([rows[0]!]))).toEqual([rows[0]])
  })

  it('stops later chunks on failure, rejects partial results and starts a retry afresh', async () => {
    const rows = jobs(201)
    check
      .mockResolvedValueOnce({
        checkListingUrls: results(rows.slice(0, 100).map((row) => row.url))
      })
      .mockRejectedValueOnce(new Error('Session expired'))
    await expect(prepareCollectedJobs(JSON.stringify(rows))).rejects.toThrow('Session expired')
    expect(check).toHaveBeenCalledTimes(2)
    check.mockClear()
    acceptAll()
    expect((await prepareCollectedJobs(JSON.stringify(rows))).remaining).toBe(201)
    expect(check.mock.calls[0]![1]!.urls).toEqual(rows.slice(0, 100).map((row) => row.url))
    expect(check).toHaveBeenCalledTimes(3)
  })

  it.each([
    [results(['https://jobs.example/0'])],
    [[...results(['https://jobs.example/0']), ...results(['https://jobs.example/1'])]],
    [[{ index: 2, normalizedUrl: 'https://jobs.example/0', shouldProcess: true }]],
    [[{ index: -1, normalizedUrl: 'https://jobs.example/0', shouldProcess: true }]]
  ])('rejects incomplete or invalid indexes', async (response) => {
    check.mockResolvedValue({ checkListingUrls: response })
    await expect(prepareCollectedJobs(JSON.stringify(jobs(2)))).rejects.toThrow('URL check')
  })
})
