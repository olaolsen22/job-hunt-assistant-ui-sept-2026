import type { PreparedJobs } from '~/utils/collectedJobs'
import { collectedJobsPosting, prepareCollectedJobs } from '~/utils/collectedJobs'
import { useCollectedJobProcessing } from '~/composables/useCollectedJobProcessing'
import type { QuickAddRows } from '~/composables/useQuickAddRows'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// How rows get onto the quick add page: pasted ads through built-in or your own AI, or a collected
// jobs file that is checked for duplicates and then added directly or processed in batches.
export const useQuickAddPaste = (rows: QuickAddRows, startsClosed: boolean) => {
  const {
    instructions,
    copied,
    load,
    copy,
    parsing,
    parse,
    needsConfirm,
    safetyMessage,
    confirmRetry,
    toastError
  } = useParsePrompt('listingQuickParsePrompt')
  const batchRun = useCollectedJobProcessing(parse)
  onMounted(load)
  onBeforeUnmount(() => batchRun.invalidate())

  const open = ref(!startsClosed)
  const ad = ref('')
  const json = ref('')
  const jsonError = ref('')
  // Opens on the AI used last, like the AI modals; only a run that worked remembers a choice.
  const aiMethod = useAiMethod()
  const aiTab = ref<string>(aiMethod.value ?? 'builtin')
  const builtIn = computed(() => aiTab.value === 'builtin')
  watch(json, () => (jsonError.value = ''))

  const inputMode = ref('text')
  const collectedMode = computed(() => inputMode.value === 'collected')
  const collected = ref('')
  const checking = ref(false)
  const checkError = ref('')
  const prepared = ref<PreparedJobs | null>(null)
  const collectedError = ref('')
  const publishedKeys = ref<number[]>([])
  // Set when the checked jobs went straight into rows, without the AI.
  const addedDirectly = ref(false)
  const processing = batchRun.busy

  const hasUnsavedWork = computed(
    () =>
      rows.pending.value.length > 0 ||
      // A check that found no new jobs leaves nothing to lose.
      (!!prepared.value?.remaining && !batchRun.published.value && !addedDirectly.value) ||
      processing.value ||
      (batchRun.published.value && (batchRun.skipped.value > 0 || batchRun.unprocessed.value > 0))
  )
  const posting = computed(() =>
    collectedMode.value ? collectedJobsPosting(prepared.value?.rows ?? []) : ad.value.trim()
  )
  const aiDisabled = computed(
    () =>
      checking.value || parsing.value || processing.value || !posting.value || needsConfirm.value
  )

  watch(collected, () => {
    prepared.value = null
    checkError.value = ''
    collectedError.value = ''
  })
  const checkJobs = async () => {
    if (processing.value) return
    checking.value = true
    checkError.value = ''
    prepared.value = null
    try {
      prepared.value = await prepareCollectedJobs(collected.value)
    } catch (error) {
      checkError.value = error instanceof Error ? error.message : ERROR_MESSAGES.generic
    } finally {
      checking.value = false
    }
  }

  // Collected jobs are already listing JSON, so the checked ones become rows as they are; the AI run
  // below stays for files that only have links or raw text. An import counts as reviewed only once
  // a save leaves nothing unsaved, so opening it and leaving keeps it pending.
  const addCollectedRows = async () => {
    if (!prepared.value?.rows.length || batchRun.status.value !== 'idle' || rows.saving.value)
      return
    const added = prepared.value.rows.map((job) => ({ ...toQuickAddRow(job), sourceUrl: job.url }))
    publishedKeys.value = added.map((row) => row.key)
    if (!(await rows.append(added))) return
    addedDirectly.value = true
    open.value = false
  }

  // An import's file, like a paste followed by Check jobs and Add as rows.
  const loadCollected = async (content: string) => {
    inputMode.value = 'collected'
    collected.value = content
    // The collected watcher clears a check, so it has to run before this one starts.
    await nextTick()
    await checkJobs()
    await addCollectedRows()
  }

  const copyPrompt = () => {
    if (!aiDisabled.value) return copy(posting.value)
  }

  const decodeRows = (reply: string) => {
    // AIs often wrap the JSON in a code fence or a sentence, so take the outermost array.
    const raw = reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1)
    let items: unknown
    try {
      items = JSON.parse(raw)
    } catch {
      jsonError.value = 'That doesn’t look like a valid JSON array.'
      return false
    }
    const decoded = (Array.isArray(items) ? items : []).map(toQuickAddRow)
    if (!decoded.length) {
      jsonError.value = 'No listings found in that reply.'
      return false
    }
    return decoded
  }

  const addRows = async (reply: string) => {
    const decoded = decodeRows(reply)
    if (!decoded) return false
    const added = await rows.append(decoded)
    if (added) {
      if (collectedMode.value) collected.value = ''
      else ad.value = ''
      json.value = ''
      open.value = false
    }
    return added
  }

  const parseBuiltIn = async () => {
    if (aiDisabled.value) return
    const reply = await parse(posting.value)
    // An interrupted or lost run shows the retry warning by the run button instead.
    if (needsConfirm.value) return
    if ('error' in reply) toastError(reply)
    // Failed: show the copy-paste steps, with the ads still filled in.
    if ('error' in reply || !(await addRows(reply.result))) aiTab.value = 'own'
    else aiMethod.value = 'builtin'
  }
  const addOwnRows = async () => {
    if (await addRows(json.value)) aiMethod.value = 'own'
  }

  const startProcessing = () => {
    if (!prepared.value?.rows.length || batchRun.status.value !== 'idle' || rows.saving.value)
      return
    collectedError.value = ''
    try {
      batchRun.start(prepared.value.rows)
    } catch (cause) {
      collectedError.value = cause instanceof Error ? cause.message : ERROR_MESSAGES.generic
    }
  }

  // The last run may have been billed without a result; only this explicit choice sends another.
  const retryConfirmed = () => {
    confirmRetry()
    if (batchRun.status.value === 'paused') batchRun.retry()
    else if (collectedMode.value) startProcessing()
    else void parseBuiltIn()
  }

  const publishBatchResults = async () => {
    if (!['finished', 'stopped'].includes(batchRun.status.value) || !batchRun.markPublished())
      return
    const accepted = batchRun.accepted.value.map(toQuickAddRow)
    publishedKeys.value = accepted.map((row) => row.key)
    if (!(await rows.append(accepted))) return
    open.value = false
    aiMethod.value = 'builtin'
  }
  watch(batchRun.status, (status) => {
    if (status === 'finished' || status === 'stopped') void publishBatchResults()
  })

  const editCollected = () => {
    rows.dropUnsaved(publishedKeys.value)
    publishedKeys.value = []
    addedDirectly.value = false
    batchRun.invalidate()
    prepared.value = null
    collectedError.value = ''
    open.value = true
  }

  return {
    open,
    ad,
    json,
    jsonError,
    aiTab,
    builtIn,
    inputMode,
    collectedMode,
    collected,
    checking,
    checkError,
    prepared,
    collectedError,
    addedDirectly,
    batchRun,
    processing,
    hasUnsavedWork,
    aiDisabled,
    instructions,
    copied,
    parsing,
    needsConfirm,
    safetyMessage,
    checkJobs,
    addCollectedRows,
    loadCollected,
    copyPrompt,
    parseBuiltIn,
    addOwnRows,
    startProcessing,
    retryConfirmed,
    editCollected
  }
}

export type QuickAddPaste = ReturnType<typeof useQuickAddPaste>
