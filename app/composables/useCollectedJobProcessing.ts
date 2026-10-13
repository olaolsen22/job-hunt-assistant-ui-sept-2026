import { computed, ref } from 'vue'
import type { CollectedJob } from '~/utils/collectedJobs'
import {
  collectedJobBatchPosting,
  decodeCollectedJobReply,
  planCollectedJobBatches
} from '~/utils/collectedJobBatches'

export type CollectedParse = (
  posting: string
) => Promise<{ result: string } | { error: string; code?: string }>
export type CollectedRunStatus = 'idle' | 'running' | 'paused' | 'finished' | 'stopped'

export const useCollectedJobProcessing = (parse: CollectedParse) => {
  const status = ref<CollectedRunStatus>('idle')
  const batches = ref<CollectedJob[][]>([])
  const cursor = ref(0)
  const accepted = ref<Record<string, unknown>[]>([])
  const skipped = ref(0)
  const completed = ref(0)
  const error = ref('')
  // The API's AiSafetyError code for the failed batch, if that is why it failed.
  const errorCode = ref<string>()
  const published = ref(false)
  const generation = ref(0)
  const total = computed(() => batches.value.flat().length)
  const failedBatch = computed(() => batches.value[cursor.value] ?? [])
  const currentBatch = computed(() => Math.min(cursor.value + 1, batches.value.length))
  const unprocessed = computed(() => Math.max(0, total.value - completed.value - skipped.value))
  const busy = computed(() => status.value === 'running' || status.value === 'paused')

  const run = async (token: number) => {
    while (token === generation.value && cursor.value < batches.value.length) {
      const batch = batches.value[cursor.value]!
      status.value = 'running'
      error.value = ''
      errorCode.value = undefined
      try {
        const response = await parse(collectedJobBatchPosting(batch))
        if (token !== generation.value) return
        if ('error' in response) {
          errorCode.value = response.code
          throw new Error(response.error)
        }
        const decoded = decodeCollectedJobReply(response.result, batch.length)
        accepted.value.push(...decoded)
        completed.value += batch.length
        cursor.value += 1
      } catch (cause) {
        if (token !== generation.value) return
        error.value = cause instanceof Error ? cause.message : 'Could not process this batch.'
        status.value = 'paused'
        return
      }
    }
    if (token === generation.value) status.value = 'finished'
  }

  const start = (jobs: CollectedJob[]) => {
    generation.value += 1
    batches.value = planCollectedJobBatches(jobs)
    cursor.value = 0
    accepted.value = []
    skipped.value = 0
    completed.value = 0
    error.value = ''
    published.value = false
    const token = generation.value
    if (!batches.value.length) status.value = 'finished'
    else void run(token)
  }

  const retry = () => {
    if (status.value === 'paused') void run(generation.value)
  }

  const skip = () => {
    if (status.value !== 'paused') return
    skipped.value += failedBatch.value.length
    cursor.value += 1
    void run(generation.value)
  }

  const stop = () => {
    if (status.value !== 'running' && status.value !== 'paused') return
    generation.value += 1
    status.value = 'stopped'
  }

  const invalidate = () => {
    generation.value += 1
    batches.value = []
    cursor.value = 0
    accepted.value = []
    skipped.value = 0
    completed.value = 0
    error.value = ''
    published.value = false
    status.value = 'idle'
  }

  const markPublished = () => {
    if (published.value) return false
    published.value = true
    return true
  }

  return {
    status,
    batches,
    cursor,
    accepted,
    skipped,
    completed,
    error,
    errorCode,
    published,
    total,
    failedBatch,
    currentBatch,
    unprocessed,
    busy,
    start,
    retry,
    skip,
    stop,
    invalidate,
    markPublished
  }
}
