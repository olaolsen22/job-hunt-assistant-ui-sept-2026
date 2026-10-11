<script setup lang="ts">
import type { PreparedJobs } from '~/utils/collectedJobs'
import { collectedJobsPosting, prepareCollectedJobs } from '~/utils/collectedJobs'
import { useCollectedJobProcessing } from '~/composables/useCollectedJobProcessing'
import type { FormError } from '@nuxt/ui'
import { print } from '@0no-co/graphql.web'
import type { ResultOf } from 'gql.tada'
import type { ListingLocation } from '~/composables/useListingForm'
import { COUNTRY_CODES } from '~/constants/countries'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'
import type { DeadlineType } from '~/constants/listing'

definePageMeta({ title: 'Quick add listings' })

const RESULT_FRAGMENT = graphql(
  `
    fragment R on CreateListingPayload {
      listing {
        ...ListingCompareFields
      }
      previousAttempts {
        id
        title
        status
      }
      possibleDuplicates {
        ...ListingCompareFields
        archivedAt
      }
      errors {
        __typename
        ... on Error {
          message
        }
        ... on DuplicateListingError {
          existingListingId
        }
      }
    }
  `,
  [LISTING_COMPARE_FIELDS]
)

type CreateListingResult = ResultOf<typeof RESULT_FRAGMENT>
type PossibleDuplicate = NonNullable<CreateListingResult['possibleDuplicates']>[number]
type PreviousAttempt = NonNullable<CreateListingResult['previousAttempts']>[number]

interface Row {
  key: number
  title: string
  companyName?: string
  jobRoleName?: string
  url: string
  postedOn: string
  deadlineType: DeadlineType
  deadlineOn: string
  locations: ListingLocation[]
  saved?: CreateListingResult['listing']
  duplicates?: PossibleDuplicate[]
  previousAttempts?: PreviousAttempt[]
  error?: string
  existingListingId?: number
}

// One aliased createListing per row keeps a batch to one request; the API saves each row on its
// own, so one failing row doesn't stop the others.
const buildMutation = (count: number) => {
  const indexes = [...Array(count).keys()]
  return batchDocument<CreateListingResult>(`
    mutation QuickAddListings(${indexes.map((i) => `$l${i}: ListingInput!`).join(', ')}) {
      ${indexes.map((i) => `r${i}: createListing(input: { listing: $l${i} }) { ...R }`).join('\n')}
    }
    ${print(RESULT_FRAGMENT)}
  `)
}

const DELETE_LISTING = graphql(`
  mutation DeleteListing($id: Int!) {
    deleteListing(input: { id: $id }) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

let nextKey = 0
const newRow = (): Row => ({
  key: nextKey++,
  title: '',
  url: '',
  postedOn: todayIso(),
  deadlineType: 'UNSPECIFIED',
  deadlineOn: '',
  locations: []
})

// Rows come from the pasted AI reply; "Add row" is only for a stray manual entry.
const state = reactive({ rows: [] as Row[] })

const isBlank = (r: Row) => !r.title.trim() && !r.companyName && !r.jobRoleName && !r.url.trim()
const toSave = (rows: Row[]) => rows.filter((r) => !r.saved && !isBlank(r))
const pending = computed(() => toSave(state.rows))
const savedCount = computed(() => state.rows.filter((r) => r.saved).length)
const failedCount = computed(() => pending.value.filter((r) => r.error).length)

// Clearing a row's flags (Keep both, Got it) moves it from flagged into added.
type SavedRow = Row & { saved: NonNullable<Row['saved']> }
const isSaved = (r: Row): r is SavedRow => !!r.saved
const isFlagged = (r: Row) => !!(r.duplicates || r.previousAttempts)
const flagged = computed(() => state.rows.filter(isSaved).filter(isFlagged))
const added = computed(() => state.rows.filter(isSaved).filter((r) => !isFlagged(r)))
const unsaved = computed(() => state.rows.filter((r) => !r.saved))
const addedOpen = ref(false)

// Field names use the row key, not the index, so errors stay on the right row after a removal.
const validate = (s: typeof state): FormError[] =>
  toSave(s.rows).flatMap((r) => {
    const errors: FormError[] = []
    if (!r.title.trim()) errors.push({ name: `${r.key}.title`, message: 'Required' })
    if (!r.companyName) errors.push({ name: `${r.key}.companyName`, message: 'Required' })
    if (!r.jobRoleName) errors.push({ name: `${r.key}.jobRoleName`, message: 'Required' })
    if (!/^https?:\/\/\S+$/i.test(r.url.trim())) {
      errors.push({ name: `${r.key}.url`, message: 'Enter an http(s) link' })
    }
    if (!r.postedOn) {
      errors.push({ name: `${r.key}.postedOn`, message: 'Required' })
    } else if (r.postedOn > todayIso()) {
      errors.push({ name: `${r.key}.postedOn`, message: 'Can’t be in the future' })
    }
    if (r.deadlineType === 'DATE' && !r.deadlineOn) {
      errors.push({ name: `${r.key}.deadlineOn`, message: 'Pick a date' })
    }
    return errors
  })

// Skills and languages are filled in later on the edit page.
const toInput = (r: Row) => ({
  title: r.title.trim(),
  companyName: r.companyName,
  jobRoleName: r.jobRoleName,
  url: r.url.trim(),
  postedOn: r.postedOn,
  deadlineType: r.deadlineType,
  // The API rejects a date unless the type is DATE.
  deadlineOn: r.deadlineType === 'DATE' ? r.deadlineOn : null,
  locations: r.locations.map((l) => ({ ...l, city: l.city || null })),
  skills: [],
  languages: []
})

// The reply is an external AI's JSON, so keep only values a row can hold.
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])

const toRow = (d: Record<string, unknown>): Row => ({
  ...newRow(),
  title: text(d?.title),
  companyName: text(d?.companyName) || undefined,
  jobRoleName: text(d?.jobRoleName) || undefined,
  url: text(d?.url),
  postedOn: isoDate(d?.postedOn) || todayIso(),
  // Parse results saved before the backend merged ROLLING into ASAP can still say ROLLING.
  deadlineType:
    DEADLINE_TYPE_OPTIONS.find(
      (o) => o.value === (d?.deadlineType === 'ROLLING' ? 'ASAP' : d?.deadlineType)
    )?.value ?? 'UNSPECIFIED',
  deadlineOn: isoDate(d?.deadlineOn),
  locations: list(d?.locations)
    .filter((l) => COUNTRY_CODES.find((c) => c === l?.countryCode))
    .map((l) => ({ countryCode: l.countryCode, city: text(l.city) }))
})

const { instructions, copied, load, copy, parsing, parse } =
  useParsePrompt('listingQuickParsePrompt')
const batchRun = useCollectedJobProcessing(parse)
onMounted(load)

const form = useTemplateRef('form')
const pasteOpen = ref(true)
const ad = ref('')
const json = ref('')
const jsonError = ref('')
const pastedCount = ref(0)
const builtIn = ref(false)
watch(json, () => (jsonError.value = ''))

const inputMode = ref('text')
const INPUT_MODES = [
  { label: 'Paste text', value: 'text' },
  { label: 'Collected jobs', value: 'collected' }
]
const collected = ref('')
const checking = ref(false)
const checkError = ref('')
const prepared = ref<PreparedJobs | null>(null)
const collectedError = ref('')
const publishedKeys = ref<number[]>([])
const processing = batchRun.busy
const runStatus = batchRun.status
const runProgress = batchRun.completed
const runTotal = batchRun.total
const runCurrentBatch = batchRun.currentBatch
const runBatchCount = computed(() => batchRun.batches.value.length)
const runSkipped = batchRun.skipped
const runUnprocessed = batchRun.unprocessed
const runError = batchRun.error
const runTitle = computed(() => {
  if (runStatus.value === 'stopped') return 'Processing incomplete'
  if (runStatus.value === 'paused') return 'Processing paused'
  if (runStatus.value === 'finished')
    return runSkipped.value ? 'Finished with skipped jobs' : 'Processing complete'
  return 'Processing jobs'
})
const hasUnsavedWork = computed(
  () =>
    pending.value.length > 0 ||
    (!!prepared.value && !batchRun.published.value) ||
    processing.value ||
    (batchRun.published.value && (batchRun.skipped.value > 0 || batchRun.unprocessed.value > 0))
)
const collectedMode = computed(() => inputMode.value === 'collected')
const posting = computed(() =>
  collectedMode.value ? collectedJobsPosting(prepared.value?.rows ?? []) : ad.value.trim()
)
const aiDisabled = computed(
  () => checking.value || parsing.value || batchRun.busy.value || !posting.value
)
watch(collected, () => {
  prepared.value = null
  checkError.value = ''
  collectedError.value = ''
})
const checkJobs = async () => {
  if (batchRun.busy.value) return
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
  const rows = list(items).map(toRow)
  if (!rows.length) {
    jsonError.value = 'No listings found in that reply.'
    return false
  }
  return rows
}

const appendRows = async (rows: Row[]) => {
  if (!rows.length) return false
  // Appended, not replaced, so a second paste never drops rows already saved or edited.
  state.rows.push(...rows)
  pastedCount.value = rows.length
  // Shows what the AI missed (e.g. a null url) right away instead of on Save. The row fields use
  // eager-validation because UForm otherwise only rechecks a field on input after its first blur:
  // the error would stay while fixing it, then vanish on the Save mousedown, shifting Save away
  // from under the click.
  await nextTick()
  form.value?.validate({ silent: true })
  return true
}

const addRows = async (reply: string) => {
  const rows = decodeRows(reply)
  if (!rows) return false
  const added = await appendRows(rows)
  if (added) {
    if (collectedMode.value) collected.value = ''
    else ad.value = ''
    json.value = ''
    pasteOpen.value = false
  }
  return added
}

const parseBuiltIn = async () => {
  if (aiDisabled.value) return
  const reply = await parse(posting.value)
  if ('error' in reply) {
    toast.add({ title: reply.error, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  // Failed: show the copy-paste steps, with the ads still filled in.
  if ('error' in reply || !(await addRows(reply.result))) builtIn.value = false
}

const startCollectedProcessing = () => {
  if (!prepared.value?.rows.length || batchRun.status.value !== 'idle' || saving.value) return
  collectedError.value = ''
  try {
    batchRun.start(prepared.value.rows)
  } catch (cause) {
    collectedError.value = cause instanceof Error ? cause.message : ERROR_MESSAGES.generic
  }
}

const publishBatchResults = async () => {
  if (!['finished', 'stopped'].includes(batchRun.status.value) || !batchRun.markPublished()) return
  const rows = batchRun.accepted.value.map(toRow)
  publishedKeys.value = rows.map((row) => row.key)
  if (await appendRows(rows)) pasteOpen.value = false
}
watch(batchRun.status, (status) => {
  if (status === 'finished' || status === 'stopped') void publishBatchResults()
})

const toast = useToast()
const saving = ref(false)
const saveError = ref('')

const onSave = async () => {
  if (processing.value || saving.value) return
  const rows = pending.value
  saving.value = true
  saveError.value = ''
  try {
    const data = await gql(
      buildMutation(rows.length),
      Object.fromEntries(rows.map((r, i) => [`l${i}`, toInput(r)]))
    )
    rows.forEach((row, i) => {
      const { listing, possibleDuplicates, previousAttempts, errors } = data[`r${i}`]!
      Object.assign(row, {
        saved: listing ?? undefined,
        duplicates: possibleDuplicates?.length ? possibleDuplicates : undefined,
        previousAttempts: previousAttempts?.length ? previousAttempts : undefined,
        error: errors?.map((e) => e.message).join(' '),
        existingListingId: errors?.find((e) => e.__typename === 'DuplicateListingError')
          ?.existingListingId
      })
    })
    const savedCount = rows.filter((r) => r.saved).length
    if (savedCount) {
      clearNuxtState('name-lookups')
      toast.add({
        title: `${savedCount} ${savedCount === 1 ? 'listing' : 'listings'} added`,
        color: 'success',
        icon: 'i-lucide-check'
      })
    }
  } catch {
    saveError.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}

const leaveOpen = ref(false)
const leaveDestination = ref('/listings')
const leaveReason = ref<'leave' | 'edit' | 'restart'>('leave')
let allowRouteLeave = false
const requestLeave = (destination: string) => {
  if (allowRouteLeave || !hasUnsavedWork.value) return true
  leaveDestination.value = destination
  leaveReason.value = 'leave'
  leaveOpen.value = true
  return false
}
onBeforeRouteLeave((to) => requestLeave(to.fullPath))
const onBack = () => {
  if (requestLeave('/listings')) return navigateTo('/listings')
}
const editCollected = () => {
  // A replacement drops only this run's unsaved drafts, keeping earlier edits and saved rows.
  state.rows = state.rows.filter((row) => row.saved || !publishedKeys.value.includes(row.key))
  publishedKeys.value = []
  batchRun.invalidate()
  prepared.value = null
  collectedError.value = ''
  pasteOpen.value = true
}
const requestEditCollected = () => {
  if (!hasUnsavedWork.value) return editCollected()
  leaveReason.value = 'edit'
  leaveOpen.value = true
}
const restartCollected = () => {
  leaveReason.value = 'restart'
  leaveOpen.value = true
}
const confirmDiscard = async () => {
  leaveOpen.value = false
  if (leaveReason.value === 'edit' || leaveReason.value === 'restart') {
    editCollected()
    return
  }
  batchRun.invalidate()
  allowRouteLeave = true
  try {
    await navigateTo(leaveDestination.value)
  } finally {
    allowRouteLeave = false
  }
}
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (!hasUnsavedWork.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => {
  watch(
    hasUnsavedWork,
    (unsaved) => {
      if (unsaved) window.addEventListener('beforeunload', beforeUnload)
      else window.removeEventListener('beforeunload', beforeUnload)
    },
    { immediate: true }
  )
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  batchRun.invalidate()
})

const removeRow = (row: Row) => state.rows.splice(state.rows.indexOf(row), 1)

const toRemove = ref<Row>()
const confirmOpen = ref(false)
const deleting = ref(false)

const askRemove = (row: Row) => {
  toRemove.value = row
  confirmOpen.value = true
}

const compareRow = ref<Row>()
const compareId = ref(0)
const compareOpen = ref(false)

const openCompare = (row: Row, id: number) => {
  compareRow.value = row
  compareId.value = id
  compareOpen.value = true
}

const onCompareKeep = () => {
  compareOpen.value = false
  compareRow.value!.duplicates = undefined
}

// Closed first so the remove confirmation doesn't stack on top of it.
const onCompareRemove = () => {
  compareOpen.value = false
  askRemove(compareRow.value!)
}

const onConfirmRemove = async () => {
  const row = toRemove.value!
  deleting.value = true
  try {
    const { deleteListing } = await gql(DELETE_LISTING, {
      id: row.saved!.id
    })
    if (deleteListing.errors?.length) {
      toast.add({ title: deleteListing.errors.map((e) => e.message).join(' '), color: 'error' })
      return
    }
    removeRow(row)
    toast.add({ title: 'Listing removed', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    deleting.value = false
    confirmOpen.value = false
  }
}
</script>

<template>
  <UForm
    ref="form"
    :state="state"
    :validate="validate"
    class="space-y-4"
    data-testid="quick-add-form"
    @submit="onSave"
  >
    <p v-if="collectedMode" class="text-sm text-muted" data-testid="quick-add-stages">
      Check duplicates → Process jobs → Review → Save
    </p>
    <UCard v-if="pasteOpen" data-testid="quick-add-paste">
      <div class="space-y-6">
        <div class="space-y-3">
          <UFormField label="Input">
            <UFieldGroup class="w-full">
              <UButton
                v-for="mode in INPUT_MODES"
                :key="mode.value"
                :label="mode.label"
                color="neutral"
                :variant="inputMode === mode.value ? 'solid' : 'outline'"
                :aria-pressed="inputMode === mode.value"
                :disabled="checking || parsing || processing || saving"
                class="flex-1"
                :data-testid="`quick-add-mode-${mode.value}`"
                @click="inputMode = mode.value"
              />
            </UFieldGroup>
          </UFormField>
          <UFormField label="AI method">
            <UFieldGroup class="w-full">
              <UButton
                label="Built-in AI"
                color="neutral"
                :variant="builtIn ? 'solid' : 'outline'"
                :aria-pressed="builtIn"
                :disabled="checking || parsing || processing || saving"
                class="flex-1"
                data-testid="quick-add-builtin"
                @click="builtIn = true"
              />
              <UButton
                label="Use your own AI"
                color="neutral"
                :variant="!builtIn ? 'solid' : 'outline'"
                :aria-pressed="!builtIn"
                :disabled="checking || parsing || processing || saving"
                class="flex-1"
                data-testid="quick-add-external"
                @click="builtIn = false"
              />
            </UFieldGroup>
          </UFormField>
          <UFormField
            v-if="!collectedMode"
            :label="
              builtIn
                ? 'Paste one or more ads, or a job-board results page'
                : '1. Paste one or more ads, or a job-board results page'
            "
            help="Only the basics are parsed; fill in the details later."
          >
            <UTextarea
              v-model="ad"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The ads or results page text"
              class="w-full"
              :disabled="parsing || processing || saving"
              data-testid="quick-add-ad"
            />
          </UFormField>
          <template v-else>
            <UFormField
              label="Collected jobs"
              help='Paste the full listing JSON array. Each job needs a URL; all other fields are kept. Example: [{ "title": "Waiter", "companyName": "Acme", "url": "https://example.com/job/1" }]'
            >
              <UTextarea
                v-model="collected"
                :rows="6"
                :maxrows="12"
                autoresize
                :disabled="checking || parsing || processing || saving"
                :readonly="!!prepared"
                placeholder="The collected jobs JSON array"
                class="w-full font-mono"
                data-testid="quick-add-collected"
              />
            </UFormField>
            <UButton
              :loading="checking"
              :disabled="
                !collected.trim() || checking || parsing || processing || saving || !!prepared
              "
              data-testid="quick-add-check"
              @click="checkJobs"
              >Check jobs</UButton
            >
            <UAlert
              v-if="checkError"
              color="error"
              icon="i-lucide-circle-alert"
              :title="checkError"
              data-testid="quick-add-check-error"
            />
            <p
              v-if="prepared"
              class="text-sm text-muted"
              role="status"
              data-testid="quick-add-check-summary"
            >
              {{ prepared.remaining + prepared.skipped }} collected · {{ prepared.skipped }} skipped
              · {{ prepared.remaining }} ready
            </p>
            <UButton
              v-if="prepared && runStatus !== 'finished' && runStatus !== 'stopped'"
              color="neutral"
              variant="ghost"
              :disabled="saving || processing"
              data-testid="quick-add-edit-collected"
              @click="requestEditCollected"
              >Edit collected jobs</UButton
            >
            <div
              v-if="prepared && !prepared.remaining"
              class="py-6 text-center text-muted"
              data-testid="quick-add-check-empty"
            >
              <UIcon name="i-lucide-check-check" class="mb-2 size-8" />
              <p>No new jobs remain.</p>
            </div>
          </template>
          <UButton
            v-if="builtIn"
            icon="i-lucide-sparkles"
            :loading="parsing"
            :disabled="aiDisabled || saving || (collectedMode && runStatus !== 'idle')"
            data-testid="quick-add-builtin-run"
            @click="collectedMode ? startCollectedProcessing() : parseBuiltIn()"
          >
            {{ collectedMode ? `Process ${prepared?.remaining ?? 0} jobs` : 'Parse into rows' }}
          </UButton>
          <p v-if="builtIn && collectedMode" class="text-sm text-muted">
            Creates drafts for review. Nothing is saved until you choose Save.
          </p>
          <UAlert
            v-if="collectedError"
            color="error"
            icon="i-lucide-circle-alert"
            :title="collectedError"
            data-testid="quick-add-process-error"
          />
          <UButton
            v-if="!builtIn"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="copied ? 'success' : 'primary'"
            variant="subtle"
            :loading="!instructions"
            :disabled="
              aiDisabled || !instructions || saving || (collectedMode && runStatus !== 'idle')
            "
            data-testid="quick-add-copy-prompt"
            @click="copyPrompt"
          >
            {{ copied ? 'Copied' : 'Copy prompt' }}
          </UButton>
        </div>

        <USeparator v-if="!builtIn" />

        <div v-if="!builtIn" class="space-y-3">
          <UFormField label="2. Paste the AI’s reply" :error="jsonError || undefined">
            <UTextarea
              v-model="json"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The JSON array the AI returned"
              class="w-full font-mono"
              :disabled="processing || saving || (collectedMode && runStatus !== 'idle')"
              data-testid="quick-add-json"
            />
          </UFormField>
          <UButton
            :disabled="
              !json.trim() || processing || saving || (collectedMode && runStatus !== 'idle')
            "
            data-testid="quick-add-parse"
            @click="addRows(json)"
            >Parse into rows</UButton
          >
        </div>
      </div>
    </UCard>

    <div
      v-else
      class="flex items-center justify-between gap-2"
      data-testid="quick-add-paste-summary"
    >
      <p class="text-sm text-muted">
        <template v-if="runStatus !== 'idle'">Prepared {{ pastedCount }} drafts.</template>
        <template v-else
          >Pasted {{ pastedCount }} {{ pastedCount === 1 ? 'listing' : 'listings' }}.</template
        >
        {{ pending.length ? 'Check them below, then save.' : 'All saved.' }}
      </p>
      <UButton
        icon="i-lucide-clipboard-paste"
        color="neutral"
        variant="ghost"
        data-testid="quick-add-paste-more"
        :disabled="processing || saving"
        @click="collectedMode && prepared ? requestEditCollected() : (pasteOpen = true)"
        >Paste more</UButton
      >
    </div>

    <UCard v-if="runStatus !== 'idle'" data-testid="quick-add-processing">
      <div class="space-y-3">
        <h2 class="font-semibold text-highlighted">{{ runTitle }}</h2>
        <UProgress
          :model-value="runProgress"
          :max="runTotal"
          :get-value-label="() => 'Processing jobs'"
          :get-value-text="(value, max) => `${value ?? 0} of ${max} jobs processed`"
          data-testid="quick-add-progress"
        />
        <p
          role="status"
          aria-live="polite"
          class="text-sm text-muted"
          data-testid="quick-add-progress-status"
        >
          {{ runProgress }} of {{ runTotal }} jobs processed · Batch {{ runCurrentBatch }} of
          {{ runBatchCount }}
        </p>
        <p v-if="prepared" class="text-sm text-muted">
          {{ prepared.remaining + prepared.skipped }} collected · {{ prepared.skipped }} skipped
          before AI · {{ prepared.remaining }} ready
        </p>
        <UAlert
          v-if="runStatus === 'paused'"
          color="error"
          icon="i-lucide-circle-alert"
          :title="`Batch ${runCurrentBatch} failed`"
          :description="runError"
          data-testid="quick-add-batch-error"
        />
        <div v-if="runStatus === 'paused'" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <UButton data-testid="quick-add-retry" @click="batchRun.retry()">Retry batch</UButton>
          <UButton
            color="neutral"
            variant="subtle"
            data-testid="quick-add-skip"
            @click="batchRun.skip()"
            >Skip batch and continue</UButton
          >
          <UButton
            color="neutral"
            variant="ghost"
            data-testid="quick-add-stop"
            @click="batchRun.stop()"
            >Stop and review</UButton
          >
        </div>
        <template v-if="runStatus === 'finished' || runStatus === 'stopped'">
          <p class="text-sm text-muted" data-testid="quick-add-terminal-counts">
            {{ runProgress }} processed · {{ runSkipped }} skipped after failure ·
            {{ runUnprocessed }} unprocessed
          </p>
          <p v-if="runProgress" class="text-sm text-muted">Review the drafts below, then save.</p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="saving"
              data-testid="quick-add-edit-collected"
              @click="requestEditCollected"
              >Edit collected jobs</UButton
            >
            <UButton
              color="neutral"
              variant="subtle"
              :disabled="saving"
              data-testid="quick-add-restart"
              @click="restartCollected"
              >Restart processing</UButton
            >
          </div>
        </template>
      </div>
    </UCard>

    <section v-if="flagged.length" class="space-y-3" data-testid="quick-add-review">
      <div>
        <h2 class="font-semibold text-highlighted">Needs a look ({{ flagged.length }})</h2>
        <p class="text-sm text-muted">Saved, but may match a listing you already have.</p>
      </div>
      <UCard v-for="row in flagged" :key="row.key" data-testid="quick-add-row-saved">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-circle-check" class="mt-0.5 size-5 shrink-0 text-success" />
          <div class="min-w-0 flex-1 space-y-1">
            <NuxtLink
              :to="`/listings/${row.saved.id}`"
              class="font-medium text-highlighted hover:underline"
              >{{ row.saved.title }}</NuxtLink
            >
            <p class="text-sm text-muted">{{ row.companyName }} · {{ row.jobRoleName }}</p>
            <!-- The API's cleaned-up URL, which can differ from what was typed. -->
            <ULink :to="row.saved.url" target="_blank" class="block truncate text-sm">{{
              row.saved.url
            }}</ULink>
          </div>
        </div>

        <UAlert
          v-if="row.duplicates"
          color="warning"
          variant="subtle"
          icon="i-lucide-copy"
          title="Possible duplicate"
          class="mt-3"
          data-testid="quick-add-row-duplicates"
        >
          <template #description>
            <ul class="space-y-1">
              <li
                v-for="match in row.duplicates"
                :key="match.id"
                class="flex flex-wrap items-center gap-x-2"
              >
                <!-- New tab, so following it keeps the unsaved rows on this page. -->
                <NuxtLink
                  :to="`/listings/${match.id}`"
                  target="_blank"
                  class="font-medium hover:underline"
                  >{{ match.title }}</NuxtLink
                >
                <span class="text-muted">{{ match.company.name }} · {{ match.jobRole.name }}</span>
                <!-- Archived means the user already applied to it. -->
                <UBadge v-if="match.archivedAt" color="neutral" variant="subtle" size="sm"
                  >Applied</UBadge
                >
              </li>
            </ul>
            <!-- One Compare for the note: the modal's "Compare with" switches between matches. -->
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton
                icon="i-lucide-columns-2"
                data-testid="quick-add-row-compare"
                :disabled="processing"
                @click="openCompare(row, row.duplicates[0]!.id)"
                >Compare{{
                  row.duplicates.length > 1 ? ` (${row.duplicates.length})` : ''
                }}</UButton
              >
              <UButton
                color="neutral"
                variant="subtle"
                :disabled="processing"
                @click="row.duplicates = undefined"
                >Keep both</UButton
              >
              <UButton
                color="error"
                variant="soft"
                data-testid="quick-add-row-remove-duplicate"
                :disabled="processing"
                @click="askRemove(row)"
                >Remove new one</UButton
              >
            </div>
          </template>
        </UAlert>

        <UAlert
          v-if="row.previousAttempts"
          color="neutral"
          variant="subtle"
          icon="i-lucide-history"
          title="Applied to this URL before"
          class="mt-3"
          data-testid="quick-add-row-previous-attempts"
        >
          <template #description>
            <ul class="space-y-1">
              <li
                v-for="attempt in row.previousAttempts"
                :key="attempt.id"
                class="flex flex-wrap items-center gap-x-2"
              >
                <NuxtLink
                  :to="`/listings/${attempt.id}`"
                  target="_blank"
                  class="font-medium hover:underline"
                  >{{ attempt.title }}</NuxtLink
                >
                <ListingsStatusBadge :status="attempt.status" />
              </li>
            </ul>
            <UButton
              color="neutral"
              variant="subtle"
              class="mt-3"
              data-testid="quick-add-row-got-it"
              :disabled="processing"
              @click="row.previousAttempts = undefined"
              >Got it</UButton
            >
          </template>
        </UAlert>
      </UCard>
    </section>

    <UCollapsible v-if="added.length" v-model:open="addedOpen">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-circle-check"
        :trailing-icon="addedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        block
        data-testid="quick-add-added-toggle"
        >{{ added.length }} {{ added.length === 1 ? 'listing' : 'listings' }} added</UButton
      >
      <template #content>
        <UCard class="mt-2" data-testid="quick-add-added">
          <ul class="divide-y divide-default">
            <li v-for="row in added" :key="row.key" class="min-w-0 py-2 first:pt-0 last:pb-0">
              <NuxtLink
                :to="`/listings/${row.saved.id}`"
                class="block truncate font-medium text-highlighted hover:underline"
                >{{ row.saved.title }}</NuxtLink
              >
              <p class="truncate text-sm text-muted">
                {{ row.companyName }} · {{ row.jobRoleName }}
              </p>
            </li>
          </ul>
        </UCard>
      </template>
    </UCollapsible>

    <h2
      v-if="savedCount && unsaved.length"
      class="font-semibold text-highlighted"
      data-testid="quick-add-unsaved"
    >
      Not saved ({{ unsaved.length }})
    </h2>

    <template v-for="row in unsaved" :key="row.key">
      <UCard data-testid="quick-add-row">
        <div class="grid gap-3 sm:grid-cols-2 xl:flex xl:items-start">
          <UFormField
            label="Job title"
            eager-validation
            :name="`${row.key}.title`"
            required
            class="sm:col-span-2 xl:flex-1"
          >
            <UInput v-model="row.title" :disabled="processing" class="w-full" />
          </UFormField>
          <UFormField
            label="Company"
            eager-validation
            :name="`${row.key}.companyName`"
            required
            class="xl:w-44"
          >
            <ListingsNameCombobox
              v-model="row.companyName"
              lookup="companies"
              :disabled="processing"
              placeholder="Search or add"
            />
          </UFormField>
          <UFormField
            label="Role"
            eager-validation
            :name="`${row.key}.jobRoleName`"
            required
            class="xl:w-44"
          >
            <ListingsNameCombobox
              v-model="row.jobRoleName"
              lookup="jobRoles"
              :disabled="processing"
              placeholder="Search or add"
            />
          </UFormField>
          <UFormField
            label="Job ad URL"
            eager-validation
            :name="`${row.key}.url`"
            required
            class="sm:col-span-2 xl:flex-1"
          >
            <div class="flex items-center gap-2">
              <UInput
                v-model="row.url"
                :disabled="processing"
                type="url"
                placeholder="https://"
                class="min-w-0 flex-1"
              />
              <UButton
                v-if="/^https?:\/\/\S+$/i.test(row.url.trim())"
                :to="row.url.trim()"
                target="_blank"
                rel="noopener noreferrer"
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                aria-label="Open job ad in a new tab"
                title="Open job ad in a new tab"
                data-testid="quick-add-row-open-ad"
              />
            </div>
          </UFormField>
          <div class="flex items-end gap-2 xl:w-48">
            <UFormField
              label="Posted on"
              eager-validation
              :name="`${row.key}.postedOn`"
              required
              class="flex-1"
            >
              <UInput
                v-model="row.postedOn"
                :disabled="processing"
                type="date"
                :max="todayIso()"
                class="w-full"
              />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Remove row"
              data-testid="quick-add-row-remove"
              :disabled="processing"
              @click="removeRow(row)"
            />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-end gap-3">
          <UFormField label="Deadline" :name="`${row.key}.deadlineType`" class="w-40">
            <USelect
              v-model="row.deadlineType"
              :disabled="processing"
              :items="[...DEADLINE_TYPE_OPTIONS]"
              class="w-full"
              data-testid="quick-add-row-deadline-type"
            />
          </UFormField>
          <UFormField
            v-if="row.deadlineType === 'DATE'"
            label="Deadline date"
            eager-validation
            :name="`${row.key}.deadlineOn`"
            class="w-40"
          >
            <UInput
              v-model="row.deadlineOn"
              :disabled="processing"
              type="date"
              class="w-full"
              data-testid="quick-add-row-deadline-on"
            />
          </UFormField>
          <!-- Read-only: the locations repeater is too big for a row; fix them on the edit page. -->
          <p
            v-if="row.locations.length"
            class="flex items-center gap-1 pb-1.5 text-sm text-muted"
            data-testid="quick-add-row-locations"
          >
            <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
            {{
              row.locations
                .map((l) => (l.city ? `${l.city}, ${l.countryCode}` : l.countryCode))
                .join(' · ')
            }}
          </p>
        </div>

        <UAlert
          v-if="row.error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="row.error"
          class="mt-3"
          data-testid="quick-add-row-error"
        >
          <template v-if="row.existingListingId" #description>
            <NuxtLink :to="`/listings/${row.existingListingId}`" class="underline"
              >View the existing listing</NuxtLink
            >
          </template>
        </UAlert>
      </UCard>
    </template>

    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="saveError"
    />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        class="justify-center"
        data-testid="quick-add-add-row"
        :disabled="processing || saving"
        @click="state.rows.push(newRow())"
        >Add row</UButton
      >
      <div class="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row sm:items-center">
        <!-- No Done/Cancel: a leave action named by where it goes can't be mistaken for saving. -->
        <UButton
          v-if="savedCount && !hasUnsavedWork"
          to="/listings"
          class="justify-center"
          data-testid="quick-add-view-listings"
          >View listings</UButton
        >
        <template v-else>
          <UButton
            color="neutral"
            variant="ghost"
            class="justify-center"
            data-testid="quick-add-back"
            @click="onBack"
            >Back to listings</UButton
          >
          <!-- Not type="submit": with no submit button, Enter in a row field can't save every row. -->
          <UButton
            :loading="saving"
            :disabled="!pending.length || processing"
            class="justify-center"
            data-testid="quick-add-save"
            @click="form?.submit()"
            >Save {{ pending.length || '' }}
            {{ pending.length === 1 ? 'listing' : 'listings' }}</UButton
          >
        </template>
        <!-- Last in the DOM so it sits on top in the reversed phone stack, first from sm up. -->
        <p
          v-if="savedCount"
          class="flex items-center justify-center gap-3 text-sm text-muted sm:order-first"
          data-testid="quick-add-status"
        >
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-circle-check" class="size-4 text-success" />
            {{ savedCount }} saved
          </span>
          <span v-if="failedCount" class="flex items-center gap-1">
            <UIcon name="i-lucide-circle-alert" class="size-4 text-error" />
            {{ failedCount }} {{ failedCount === 1 ? 'needs' : 'need' }} fixing
          </span>
        </p>
      </div>
    </div>

    <ListingsCompareModal
      v-if="compareRow?.saved && compareRow.duplicates"
      v-model:open="compareOpen"
      v-model:match-id="compareId"
      :listing="compareRow.saved"
      :matches="compareRow.duplicates"
      @keep="onCompareKeep"
      @remove="onCompareRemove"
    />

    <AppConfirmModal
      v-model:open="leaveOpen"
      :title="
        leaveReason !== 'leave'
          ? 'Reset collected jobs?'
          : processing
            ? 'Leave batch processing?'
            : pending.length
              ? `Leave ${pending.length} unsaved ${pending.length === 1 ? 'listing' : 'listings'}?`
              : 'Leave collected jobs?'
      "
      :description="
        leaveReason !== 'leave'
          ? 'Checked input, batch progress, and this run’s unsaved drafts will be reset. Earlier review rows and saved listings are kept.'
          : 'Unsaved listings, checked input, and batch progress will be lost. Saved listings are kept.'
      "
      :confirm-label="leaveReason === 'leave' ? 'Leave' : 'Reset'"
      @confirm="confirmDiscard"
    />

    <AppConfirmModal
      v-model:open="confirmOpen"
      title="Remove this listing?"
      :description="toRemove?.saved?.title"
      confirm-label="Remove"
      :loading="deleting"
      @confirm="onConfirmRemove"
    />
  </UForm>
</template>
