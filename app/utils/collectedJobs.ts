import type { ResultOf } from 'gql.tada'
import { gql, graphql } from './graphql'
import { isHttpUrl } from './isHttpUrl'

const CHECK_LISTING_URLS = graphql(`
  query CheckListingUrls($urls: [String!]!) {
    checkListingUrls(urls: $urls) {
      index
      normalizedUrl
      existingListingIds
      shouldProcess
    }
  }
`)

type UrlCheck = ResultOf<typeof CHECK_LISTING_URLS>['checkListingUrls'][number]

export interface CollectedJob extends Record<string, unknown> {
  url: string
}

// What the check found for one job in the file.
export interface CheckedJob {
  job: CollectedJob
  savedListingIds: number[]
  isRepeat: boolean
}

export interface PreparedJobs {
  rows: CollectedJob[]
  jobs: CheckedJob[]
  remaining: number
  skipped: number
}

export const parseCollectedJobs = (source: string): CollectedJob[] => {
  let items: unknown
  try {
    items = JSON.parse(source)
  } catch {
    throw new Error('Enter a valid JSON array of collected jobs.')
  }
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Enter at least one collected job in a JSON array.')
  }
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Job ${index + 1}: enter a listing object with an http(s) URL.`)
    }
    const url = typeof item?.url === 'string' ? item.url.trim() : ''
    if (!isHttpUrl(url) || /\s/.test(url))
      throw new Error(`Job ${index + 1}: enter an http(s) URL.`)
    return item
  })
}

export const prepareCollectedJobs = async (source: string): Promise<PreparedJobs> => {
  const jobs = parseCollectedJobs(source)
  const seen = new Set<string>()
  const rows: CollectedJob[] = []
  const checked: CheckedJob[] = []
  for (let offset = 0; offset < jobs.length; offset += 100) {
    const batch = jobs.slice(offset, offset + 100)
    const { checkListingUrls: results } = await gql(CHECK_LISTING_URLS, {
      urls: batch.map((job) => job.url.trim())
    })
    const byIndex = new Map<number, UrlCheck>()
    for (const result of results) {
      if (
        !Number.isInteger(result.index) ||
        result.index < 0 ||
        result.index >= batch.length ||
        byIndex.has(result.index)
      ) {
        throw new Error('The URL check returned invalid job indexes. Try checking again.')
      }
      byIndex.set(result.index, result)
    }
    if (byIndex.size !== batch.length) {
      throw new Error('The URL check did not return every job. Try checking again.')
    }
    batch.forEach((job, index) => {
      const result = byIndex.get(index)!
      const isNew = result.shouldProcess && !seen.has(result.normalizedUrl)
      if (isNew) rows.push(job)
      checked.push({
        job,
        savedListingIds: result.existingListingIds,
        isRepeat: !isNew && !result.existingListingIds.length
      })
    })
    // The API handles repeats within a batch; include skipped URLs for later chunks too.
    results.forEach((result) => seen.add(result.normalizedUrl))
  }
  return { rows, jobs: checked, remaining: rows.length, skipped: jobs.length - rows.length }
}

export const collectedJobsPosting = (jobs: CollectedJob[]) =>
  jobs.length ? JSON.stringify(jobs, null, 2) : ''
