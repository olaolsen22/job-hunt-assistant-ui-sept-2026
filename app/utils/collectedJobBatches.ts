import type { CollectedJob } from './collectedJobs'

// Our own choice, not an API limit: a failed batch loses less, and progress and retries stay useful.
export const COLLECTED_JOB_BATCH_SIZE = 20
// The API's input cap for one QUICK parse (200,000 once its code-review-pass branch is merged).
export const COLLECTED_JOB_TEXT_LIMIT = 100_000

export class OversizedCollectedJobError extends Error {
  constructor(readonly index: number) {
    super(`Job ${index + 1} is too large to process in one request.`)
    this.name = 'OversizedCollectedJobError'
  }
}

/** Greedily plan consecutive, complete listing objects within both limits. */
export const planCollectedJobBatches = (jobs: CollectedJob[]): CollectedJob[][] => {
  const batches: CollectedJob[][] = []
  let current: CollectedJob[] = []

  for (const [index, job] of jobs.entries()) {
    const candidate = [...current, job]
    if (
      candidate.length > COLLECTED_JOB_BATCH_SIZE ||
      JSON.stringify(candidate).length > COLLECTED_JOB_TEXT_LIMIT
    ) {
      if (!current.length) throw new OversizedCollectedJobError(index)
      batches.push(current)
      current = [job]
      if (JSON.stringify(current).length > COLLECTED_JOB_TEXT_LIMIT) {
        throw new OversizedCollectedJobError(index)
      }
    } else {
      current = candidate
    }
  }

  if (current.length) batches.push(current)
  return batches
}

export const collectedJobBatchPosting = (jobs: CollectedJob[]) => JSON.stringify(jobs)

/** Extract and validate a complete JSON listing array, including count and object shape. */
export const decodeCollectedJobReply = (
  reply: string,
  expectedCount: number
): Record<string, unknown>[] => {
  let items: unknown
  try {
    items = JSON.parse(reply)
  } catch {
    // Keep quick-add's tolerance for prose and code fences around an array.
    const raw = reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1)
    try {
      items = JSON.parse(raw)
    } catch {
      throw new Error('The AI reply is not a valid JSON array.')
    }
  }
  if (!Array.isArray(items)) throw new Error('The AI reply must be a JSON array.')
  if (items.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} listings, but received ${items.length}.`)
  }
  if (items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Every item in the AI reply must be a listing object.')
  }
  return items as Record<string, unknown>[]
}
