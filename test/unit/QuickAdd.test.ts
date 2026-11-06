import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import QuickAddPage from '~/pages/listings/quick-add.vue'
import { llmModels, unknownModelError } from '../fixtures/llmModels'

// Mounting at a route runs the auth middleware.
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const { navigation, routing } = vi.hoisted(() => ({
  navigation: vi.fn(),
  routing: { guard: undefined as undefined | ((to: { fullPath: string }) => boolean) }
}))
mockNuxtImport('navigateTo', () => navigation)
mockNuxtImport('onBeforeRouteLeave', () => (guard: typeof routing.guard) => {
  routing.guard = guard
})
beforeEach(() => {
  navigation.mockReset()
  routing.guard = undefined
})

const saved = (id: number) => ({
  listing: {
    id,
    title: `Job ${id}`,
    url: `https://jobs.example/${id}`,
    postedOn: '2026-10-01',
    deadlineType: 'UNSPECIFIED',
    deadlineOn: null,
    status: 'SAVED',
    company: { name: 'Acme' },
    jobRole: { name: 'Developer' },
    locations: []
  },
  previousAttempts: null,
  possibleDuplicates: null,
  errors: null
})
const duplicate = (id: number) => ({
  ...saved(id),
  possibleDuplicates: [{ ...saved(90).listing, archivedAt: null }]
})
const appliedBefore = (id: number) => ({
  ...saved(id),
  previousAttempts: [{ id: 80, title: 'Job 80', status: 'REJECTED' }]
})
const failed = {
  listing: null,
  previousAttempts: null,
  possibleDuplicates: null,
  errors: [{ __typename: 'ValidationError', message: 'Something is wrong' }]
}

// Each test sets how the batch's rows come back; saves are counted to catch accidental ones.
const mockApi = (results: unknown[]) => {
  const saves = { count: 0, variables: {} as Record<string, unknown>, deleted: [] as number[] }
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      if (query.includes('ListingQuickParsePrompt')) {
        return { data: { prompt: { instructions: 'x' } } }
      }
      if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
      if (query.includes('DeleteListing')) {
        saves.deleted.push(variables.id)
        return { data: { deleteListing: { errors: null } } }
      }
      if (query.includes('QuickAddListings')) {
        saves.count++
        saves.variables = variables
        return { data: Object.fromEntries(results.map((r, i) => [`r${i}`, r])) }
      }
      return { data: { result: { nodes: [] } } }
    }
  })
  return saves
}

const row = (n: number) => ({
  title: `Job ${n}`,
  companyName: 'Acme',
  jobRoleName: 'Developer',
  url: `https://jobs.example/${n}`
})

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

// Reka tabs switch on mousedown. Tests pick one: the remembered AI method lasts between tests.
const aiTab = (w: VueWrapper, method: 'builtin' | 'own') =>
  w.findAll('[role="tab"]')[method === 'builtin' ? 0 : 1]!
const chooseAi = async (w: VueWrapper, method: 'builtin' | 'own') => {
  await aiTab(w, method).trigger('mousedown')
  await flushPromises()
}

const pasteRows = async (count: number) => {
  wrapper = await mountSuspended(QuickAddPage, { attachTo: document.body })
  await flushPromises()
  await chooseAi(wrapper, 'own')
  const reply = JSON.stringify([...Array(count).keys()].map((i) => row(i + 1)))
  await wrapper.get('[data-testid="quick-add-json"]').setValue(reply)
  await wrapper.get('[data-testid="quick-add-parse"]').trigger('click')
  await flushPromises()
  return wrapper
}

const save = async (w: VueWrapper) => {
  await w.get('[data-testid="quick-add-save"]').trigger('click')
  await vi.waitFor(() => expect(w.find('[data-testid="quick-add-status"]').exists()).toBe(true))
}

const confirmModal = async () => {
  await vi.waitFor(() =>
    expect(document.body.querySelector('[data-testid="confirm-modal-confirm"]')).not.toBeNull()
  )
  ;(
    document.body.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLButtonElement
  ).click()
  await flushPromises()
}

const cancelModal = async () => {
  const buttons = [...document.body.querySelectorAll('[role="dialog"] button')]
  ;(buttons.find((button) => button.textContent?.trim() === 'Cancel') as HTMLButtonElement).click()
  await flushPromises()
}

describe('Quick add', () => {
  it('saves only from the Save button', async () => {
    const saves = mockApi([saved(1)])
    const w = await pasteRows(1)

    // jsdom doesn't do implicit submission, so check what browsers rely on for it: Enter in a
    // field submits only when the form has a submit button.
    expect(w.get('form').find('[type="submit"]').exists()).toBe(false)
    expect(saves.count).toBe(0)

    await save(w)
    expect(saves.count).toBe(1)
  })

  it('reports a partial save and confirms before leaving unsaved rows', async () => {
    mockApi([saved(1), failed])
    const w = await pasteRows(2)
    await save(w)

    expect(w.get('[data-testid="quick-add-status"]').text()).toMatch(/1 saved\s*1 needs fixing/)
    expect(w.get('[data-testid="quick-add-paste-summary"]').text()).toContain('then save')

    await w.get('[data-testid="quick-add-back"]').trigger('click')
    await flushPromises()
    // The confirm is teleported to <body>, outside the wrapper.
    expect(document.body.textContent).toContain('Leave 1 unsaved listing?')
  })

  // Every save is a full listing; an omitted kind would make an open invitation a vacancy.
  it('saves the kind each parsed ad came with', async () => {
    const saves = mockApi([saved(1), saved(2)])
    wrapper = await mountSuspended(QuickAddPage, { attachTo: document.body })
    await flushPromises()
    await chooseAi(wrapper, 'own')
    await wrapper
      .get('[data-testid="quick-add-json"]')
      .setValue(JSON.stringify([{ ...row(1), kind: 'OPEN_INVITATION' }, row(2)]))
    await wrapper.get('[data-testid="quick-add-parse"]').trigger('click')
    await flushPromises()
    await save(wrapper)

    expect(saves.variables).toMatchObject({
      l0: { kind: 'OPEN_INVITATION' },
      l1: { kind: 'VACANCY' }
    })
  })

  it('opens the listing after saving a single new one, but not a flagged one or a batch', async () => {
    mockApi([saved(7)])
    await save(await pasteRows(1))
    expect(navigation).toHaveBeenCalledWith('/listings/7')

    navigation.mockReset()
    mockApi([duplicate(8)])
    await save(await pasteRows(1))
    expect(navigation).not.toHaveBeenCalled()

    mockApi([saved(1), saved(2)])
    await save(await pasteRows(2))
    expect(navigation).not.toHaveBeenCalled()
  })

  it('offers View listings instead of Save once everything is saved', async () => {
    mockApi([saved(1), saved(2)])
    const w = await pasteRows(2)
    await save(w)

    expect(w.find('[data-testid="quick-add-view-listings"]').exists()).toBe(true)
    expect(w.find('[data-testid="quick-add-save"]').exists()).toBe(false)
    expect(w.find('[data-testid="quick-add-back"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-paste-summary"]').text()).toContain('All saved.')
  })

  it('shows flagged rows first and groups the rest as added', async () => {
    mockApi([duplicate(1), saved(2), saved(3), failed])
    const w = await pasteRows(4)
    await save(w)

    const review = w.get('[data-testid="quick-add-review"]')
    expect(review.text()).toContain('Needs a look (1)')
    expect(review.findAll('[data-testid="quick-add-row-saved"]')).toHaveLength(1)
    expect(w.get('[data-testid="quick-add-added-toggle"]').text()).toBe('2 listings added')
    expect(w.find('[data-testid="quick-add-added"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-unsaved"]').text()).toBe('Not saved (1)')

    await w.get('[data-testid="quick-add-added-toggle"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="quick-add-added"]').text()).toContain('Job 3')
  })

  it('opens the compare modal from the note and moves a kept row into added', async () => {
    mockApi([duplicate(1), saved(2)])
    const w = await pasteRows(2)
    await save(w)

    await w.get('[data-testid="quick-add-row-compare"]').trigger('click')
    await flushPromises()
    // The modal is teleported to <body>, outside the wrapper.
    expect(document.body.querySelector('[data-testid="compare-keep"]')).not.toBeNull()

    const keep = w.findAll('[data-testid="quick-add-row-duplicates"] button')
    await keep.find((b) => b.text() === 'Keep both')!.trigger('click')
    expect(w.find('[data-testid="quick-add-review"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-added-toggle"]').text()).toBe('2 listings added')
  })

  it('removes the existing listing from the compare modal and keeps the new row', async () => {
    const saves = mockApi([duplicate(1)])
    const w = await pasteRows(1)
    await save(w)

    await w.get('[data-testid="quick-add-row-compare"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="compare-remove-existing"]')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-testid="compare-confirm"]')!.textContent).toContain(
      'Remove existing “Job 90”?'
    )
    document.body.querySelector<HTMLElement>('[data-testid="compare-confirm-remove"]')!.click()
    await flushPromises()

    // The mock endpoint answers after the click's flush, so wait for the row to settle.
    await vi.waitFor(() => expect(w.find('[data-testid="quick-add-review"]').exists()).toBe(false))
    expect(saves.deleted).toEqual([90])
    expect(w.get('[data-testid="quick-add-added-toggle"]').text()).toBe('1 listing added')
  })

  it('clears an applied-before note with Got it', async () => {
    mockApi([appliedBefore(1)])
    const w = await pasteRows(1)
    await save(w)

    await w.get('[data-testid="quick-add-row-got-it"]').trigger('click')
    expect(w.find('[data-testid="quick-add-review"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-added-toggle"]').text()).toBe('1 listing added')
  })
})

type CheckRow = {
  index: number
  normalizedUrl: string
  existingListingIds: number[]
  shouldProcess: boolean
}
type ParseReply =
  { result: string } | { error: string } | { unknownModel: true } | { safety: string }
const collectedApi = (
  respond: (urls: string[]) => Promise<CheckRow[]> | CheckRow[],
  parseReply: (posting: string, attempt: number) => ParseReply | Promise<ParseReply> = (
    posting
  ) => ({ result: posting })
) => {
  const requests = {
    checks: [] as string[][],
    parses: [] as string[],
    modes: [] as string[],
    models: [] as (string | undefined)[],
    requestIds: [] as string[],
    reviewed: [] as unknown[],
    saves: 0
  }
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      if (query.includes('ListingQuickParsePrompt')) {
        return { data: { prompt: { instructions: 'Parse these jobs' } } }
      }
      if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
      if (query.includes('CheckListingUrls')) {
        requests.checks.push(variables.urls)
        try {
          return { data: { checkListingUrls: await respond(variables.urls) } }
        } catch (error) {
          return { errors: [{ message: (error as Error).message }] }
        }
      }
      if (query.includes('mutation ParseListing')) {
        requests.parses.push(variables.text)
        requests.modes.push(variables.mode)
        requests.models.push(variables.model)
        requests.requestIds.push(variables.requestId)
        const reply = await parseReply(variables.text, requests.parses.length)
        if ('unknownModel' in reply)
          return { data: { parseListing: { parseJob: null, errors: [unknownModelError] } } }
        if ('safety' in reply) {
          const error = {
            __typename: 'AiSafetyError',
            message: `Stopped: ${reply.safety}`,
            code: reply.safety
          }
          return { data: { parseListing: { parseJob: null, errors: [error] } } }
        }
        return {
          data: {
            parseListing: {
              parseJob:
                'result' in reply
                  ? { status: 'SUCCEEDED', result: reply.result, error: null }
                  : { status: 'FAILED', result: null, error: reply.error },
              errors: []
            }
          }
        }
      }
      if (query.includes('QuickAddListings')) {
        requests.saves++
        return {
          data: Object.fromEntries(Object.keys(variables).map((_, i) => [`r${i}`, saved(i + 1)]))
        }
      }
      if (query.includes('query ListingImport(')) {
        return { data: { listingImports: { nodes: storedImport ? [storedImport] : [] } } }
      }
      if (query.includes('query ListingImports(')) {
        const nodes = [
          { id: 7, error: null },
          { id: 8, error: 'Not a JSON array' },
          { id: 9, error: null }
        ]
        return { data: { listingImports: { nodes } } }
      }
      if (query.includes('SetListingImportReviewed')) {
        requests.reviewed.push(variables)
        const listingImport = { id: variables.id, reviewedAt: '2026-11-03T10:00:00Z' }
        return { data: { setListingImportReviewed: { listingImport, errors: null } } }
      }
      return { data: {} }
    }
  })
  return requests
}
const eligible = (urls: string[]) =>
  urls.map((normalizedUrl, index) => ({
    index,
    normalizedUrl,
    existingListingIds: index === 0 ? [] : [100 + index],
    shouldProcess: index === 0
  }))
const collection = [
  {
    title: 'Seasonal Waiter',
    companyName: 'A. C. Perchs Thehandel',
    jobRoleName: 'Waiter',
    url: 'https://arbeidsplassen.nav.no/stillinger/stilling/ee9e3293-53bf-42ae-93f7-8d137dd2ecac',
    postedOn: '2026-10-09',
    deadlineType: 'ASAP',
    deadlineOn: null,
    locations: [{ city: 'Oslo', countryCode: 'NO' }]
  },
  { title: 'Already saved job', url: 'https://jobs.example/saved' }
]
const openCollected = async (source = JSON.stringify(collection)) => {
  wrapper = await mountSuspended(QuickAddPage, { attachTo: document.body })
  await flushPromises()
  await chooseAi(wrapper, 'own')
  await wrapper.get('[data-testid="quick-add-mode-collected"]').trigger('click')
  await wrapper.get('[data-testid="quick-add-collected"]').setValue(source)
  return wrapper
}
const checkCollection = async (w: VueWrapper) => {
  await w.get('[data-testid="quick-add-check"]').trigger('click')
  await vi.waitFor(() =>
    expect(w.find('[data-testid="quick-add-check-summary"]').exists()).toBe(true)
  )
}

describe('Quick add collected jobs', () => {
  it('validates input before any check or AI request', async () => {
    const requests = collectedApi(eligible)
    const w = await openCollected('[{"text":"Missing URL"}]')
    await w.get('[data-testid="quick-add-check"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="quick-add-check-error"]').text()).toContain('Job 1')
    expect(requests.checks).toEqual([])
    expect(requests.parses).toEqual([])
    expect(w.get('[data-testid="quick-add-copy-prompt"]').attributes('disabled')).toBeDefined()
  })

  it('accepts full listing JSON and copies all fields of retained listings only', async () => {
    const requests = collectedApi(eligible)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} }
    })
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const w = await openCollected()
    expect(w.get('[data-testid="quick-add-copy-prompt"]').attributes('disabled')).toBeDefined()
    await checkCollection(w)
    expect(w.get('[data-testid="quick-add-check-summary"]').text()).toContain(
      '2 collected · 1 skipped · 1 ready'
    )
    await w.get('[data-testid="quick-add-copy-prompt"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(
      `Parse these jobs\n\n<posting>\n${JSON.stringify([collection[0]], null, 2)}\n</posting>`
    )
    expect(requests.checks).toEqual([collection.map((job) => job.url)])
    expect(w.get('[data-testid="quick-add-collected"]').attributes('readonly')).toBeDefined()
    await w.get('[data-testid="quick-add-edit-collected"]').trigger('click')
    await confirmModal()
    await w
      .get('[data-testid="quick-add-collected"]')
      .setValue(JSON.stringify(collection.slice(0, 1)))
    expect(w.find('[data-testid="quick-add-check-summary"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-copy-prompt"]').attributes('disabled')).toBeDefined()
  })

  it('adds checked jobs as rows without the AI', async () => {
    const requests = collectedApi(eligible)
    const w = await openCollected()
    await checkCollection(w)
    await w.get('[data-testid="quick-add-add-collected"]').trigger('click')
    await vi.waitFor(() => expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(1))
    expect(requests.parses).toEqual([])
    expect(routing.guard!({ fullPath: '/listings' })).toBe(false)
  })

  it('sends only retained jobs to the built-in parser after checking', async () => {
    const requests = collectedApi(eligible)
    const w = await openCollected()
    await chooseAi(w, 'builtin')
    expect(w.get('[data-testid="quick-add-builtin-run"]').attributes('disabled')).toBeDefined()
    await checkCollection(w)
    await w.get('[data-testid="quick-add-builtin-run"]').trigger('click')
    await vi.waitFor(() => expect(requests.parses).toHaveLength(1))
    expect(requests.parses.map((posting) => JSON.parse(posting))).toEqual([[collection[0]]])
    await vi.waitFor(() => expect(w.find('[data-testid="quick-add-paste"]').exists()).toBe(false))
  })

  it('keeps both AI actions disabled when every row is skipped', async () => {
    collectedApi((urls) => eligible(urls).map((r) => ({ ...r, shouldProcess: false })))
    const w = await openCollected()
    await checkCollection(w)
    expect(w.get('[data-testid="quick-add-check-summary"]').text()).toContain(
      '2 collected · 2 skipped · 0 ready'
    )
    expect(w.get('[data-testid="quick-add-check-empty"]').text()).toContain('No new jobs remain')
    expect(w.get('[data-testid="quick-add-copy-prompt"]').attributes('disabled')).toBeDefined()
    await chooseAi(w, 'builtin')
    expect(w.get('[data-testid="quick-add-builtin-run"]').attributes('disabled')).toBeDefined()
  })

  it('blocks input and AI actions while checking', async () => {
    let finish!: (value: CheckRow[]) => void
    const requests = collectedApi(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const w = await openCollected()
    await w.get('[data-testid="quick-add-check"]').trigger('click')
    await vi.waitFor(() => expect(requests.checks).toHaveLength(1))
    expect(w.get('[data-testid="quick-add-collected"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="quick-add-copy-prompt"]').attributes('disabled')).toBeDefined()
    expect(aiTab(w, 'builtin').attributes('disabled')).toBeDefined()
    finish(eligible(collection.map((r) => r.url)))
    await vi.waitFor(() =>
      expect(w.find('[data-testid="quick-add-check-summary"]').exists()).toBe(true)
    )
    expect(w.get('[data-testid="quick-add-collected"]').attributes('disabled')).toBeUndefined()
  })

  it('discards earlier preparation on a failed session check and allows a full retry', async () => {
    let fail = false
    const requests = collectedApi((urls) => {
      if (fail) throw new Error('Login session expired')
      return eligible(urls)
    })
    const source = JSON.stringify(collection)
    const w = await openCollected(source)
    await checkCollection(w)
    await w.get('[data-testid="quick-add-edit-collected"]').trigger('click')
    await confirmModal()
    fail = true
    await w.get('[data-testid="quick-add-check"]').trigger('click')
    await vi.waitFor(() =>
      expect(w.find('[data-testid="quick-add-check-error"]').exists()).toBe(true)
    )
    expect(w.get('[data-testid="quick-add-check-error"]').text()).toContain('Login session expired')
    expect(w.find('[data-testid="quick-add-check-summary"]').exists()).toBe(false)
    expect(
      (w.get('[data-testid="quick-add-collected"]').element as HTMLTextAreaElement).value
    ).toBe(source)
    expect(w.get('[data-testid="quick-add-copy-prompt"]').attributes('disabled')).toBeDefined()
    await chooseAi(w, 'builtin')
    expect(w.get('[data-testid="quick-add-builtin-run"]').attributes('disabled')).toBeDefined()
    expect(requests.parses).toEqual([])
    fail = false
    await checkCollection(w)
    expect(requests.checks).toEqual(Array.from({ length: 3 }, () => collection.map((r) => r.url)))
    expect(w.find('[data-testid="quick-add-check-error"]').exists()).toBe(false)
  })
})

const allEligible = (urls: string[]) =>
  eligible(urls).map((job) => ({ ...job, shouldProcess: true }))
const manyJobs = (count: number) => Array.from({ length: count }, (_, i) => row(i + 100))
const startCollected = async (w: VueWrapper) => {
  await chooseAi(w, 'builtin')
  await checkCollection(w)
  await w.get('[data-testid="quick-add-builtin-run"]').trigger('click')
}
const paused = async (w: VueWrapper) => {
  await vi.waitFor(() =>
    expect(w.find('[data-testid="quick-add-batch-error"]').exists()).toBe(true)
  )
}
const finished = async (w: VueWrapper) => {
  await vi.waitFor(() =>
    expect(w.find('[data-testid="quick-add-terminal-counts"]').exists()).toBe(true)
  )
  await flushPromises()
}

describe('Quick add collected batch processing', () => {
  it('stages 43 filtered jobs in sequential 20/20/3 calls and preserves existing review rows', async () => {
    mockApi([saved(1), failed])
    const w = await pasteRows(2)
    await save(w)
    await w.get('[data-testid="quick-add-row"] input').setValue('Earlier edited draft')
    await w.get('[data-testid="quick-add-paste-more"]').trigger('click')
    await w.get('[data-testid="quick-add-mode-collected"]').trigger('click')
    const input = manyJobs(44)
    const source = JSON.stringify(input)
    await w.get('[data-testid="quick-add-collected"]').setValue(source)
    let resolveSecond!: (reply: ParseReply) => void
    const requests = collectedApi(
      (urls) => allEligible(urls).map((job) => ({ ...job, shouldProcess: job.index !== 3 })),
      (posting, attempt) =>
        attempt === 2
          ? new Promise((resolve) => {
              resolveSecond = resolve
            })
          : { result: posting }
    )
    await startCollected(w)
    await vi.waitFor(() => expect(requests.parses).toHaveLength(2))
    expect(w.get('[data-testid="quick-add-stages"]').text()).toBe(
      'Check duplicates → Add as rows → Review → Save'
    )
    const status = w.get('[data-testid="quick-add-progress-status"]')
    expect(status.text()).toContain('20 of 43 jobs processed · Batch 2 of 3')
    expect(status.attributes('role')).toBe('status')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(w.get('[role="progressbar"]').attributes('aria-label')).toBe('Processing jobs')
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(1)
    expect(
      (w.get('[data-testid="quick-add-collected"]').element as HTMLTextAreaElement).value
    ).toBe(source)
    for (const selector of [
      'quick-add-mode-text',
      'quick-add-check',
      'quick-add-add-row',
      'quick-add-row-remove',
      'quick-add-save'
    ]) {
      expect(w.get(`[data-testid="${selector}"]`).attributes('disabled')).toBeDefined()
    }
    expect(aiTab(w, 'builtin').attributes('disabled')).toBeDefined()
    expect(aiTab(w, 'own').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="quick-add-row"] input').attributes('disabled')).toBeDefined()
    for (const combobox of w.findAll('[data-testid="quick-add-row"] [role="combobox"]')) {
      expect(combobox.attributes('disabled')).toBeDefined()
    }
    expect(w.find('[data-testid="quick-add-json"]').exists()).toBe(false)
    expect(requests.saves).toBe(0)
    resolveSecond({ result: requests.parses[1]! })
    await finished(w)
    expect(requests.parses.map((posting) => JSON.parse(posting).length)).toEqual([20, 20, 3])
    expect(requests.parses.flatMap((posting) => JSON.parse(posting))).toEqual(
      input.filter((_, index) => index !== 3)
    )
    expect(requests.modes).toEqual(['QUICK', 'QUICK', 'QUICK'])
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(44)
    expect((w.get('[data-testid="quick-add-row"] input').element as HTMLInputElement).value).toBe(
      'Earlier edited draft'
    )
    expect(w.get('[data-testid="quick-add-status"]').text()).toContain('1 saved')
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('43')
    expect(w.get('[data-testid="quick-add-terminal-counts"]').text()).toBe(
      '43 processed · 0 skipped after failure · 0 unprocessed'
    )
    expect(requests.saves).toBe(0)
  }, 10_000)

  it('asks again on repeated failures, retries only the failed batch, and publishes once', async () => {
    const requests = collectedApi(allEligible, (posting, attempt) =>
      attempt === 2 || attempt === 3 ? { error: 'Rate limit reached' } : { result: posting }
    )
    const w = await openCollected(JSON.stringify(manyJobs(21)))
    await startCollected(w)
    await paused(w)
    expect(requests.parses).toHaveLength(2)
    expect(w.get('[data-testid="quick-add-batch-error"]').text()).toContain('Rate limit reached')
    expect(aiTab(w, 'builtin').attributes('aria-selected')).toBe('true')
    expect(w.get('[data-testid="quick-add-save"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="quick-add-retry"]').trigger('click')
    await vi.waitFor(() => expect(requests.parses).toHaveLength(3))
    await paused(w)
    expect(w.get('[data-testid="quick-add-progress-status"]').text()).toContain('20 of 21')
    await w.get('[data-testid="quick-add-retry"]').trigger('click')
    await finished(w)
    expect(requests.parses).toHaveLength(4)
    expect(requests.parses[1]).toBe(requests.parses[2])
    expect(requests.parses[2]).toBe(requests.parses[3])
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(21)
    await flushPromises()
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(21)
    expect(requests.saves).toBe(0)
  })

  it('pauses on an unknown default model and retries the batch', async () => {
    const requests = collectedApi(allEligible, (posting, attempt) =>
      attempt === 1 ? { unknownModel: true } : { result: posting }
    )
    const w = await openCollected(JSON.stringify(manyJobs(2)))
    await chooseAi(w, 'builtin')
    await checkCollection(w)
    await w.get('[data-testid="quick-add-builtin-run"]').trigger('click')
    await paused(w)
    expect(w.get('[data-testid="quick-add-batch-error"]').text()).toContain('isn’t available')

    await w.get('[data-testid="quick-add-retry"]').trigger('click')
    await finished(w)
    expect(requests.models).toEqual([undefined, undefined])
  })

  it('pauses on a reached daily limit with a way to Settings', async () => {
    const requests = collectedApi(allEligible, () => ({ safety: 'daily-limit-reached' }))
    const w = await openCollected(JSON.stringify(manyJobs(21)))
    await startCollected(w)
    await paused(w)
    expect(requests.parses).toHaveLength(1)
    const error = w.get('[data-testid="quick-add-batch-error"]')
    expect(error.text()).toContain('Stopped: daily-limit-reached')
    expect(error.get('[data-testid="ai-limit-settings"]').attributes('href')).toBe('/settings')
  })

  it('asks before retrying an interrupted batch, with a new request id', async () => {
    const requests = collectedApi(allEligible, (posting, attempt) =>
      attempt === 1 ? { safety: 'result-unavailable' } : { result: posting }
    )
    const w = await openCollected(JSON.stringify(manyJobs(2)))
    await startCollected(w)
    await vi.waitFor(() => expect(w.find('[data-testid="ai-retry-confirm"]').exists()).toBe(true))
    expect(w.find('[data-testid="quick-add-retry"]').exists()).toBe(false)
    expect(requests.parses).toHaveLength(1)

    await w.get('[data-testid="ai-retry-confirm-run"]').trigger('click')
    await finished(w)
    expect(requests.parses).toHaveLength(2)
    expect(requests.requestIds[1]).not.toBe(requests.requestIds[0])
  })

  it('keeps skipped failures below full successful progress and retains input for editing', async () => {
    const input = manyJobs(43)
    collectedApi(allEligible, (posting, attempt) =>
      attempt === 2 ? { error: 'Failed' } : { result: posting }
    )
    const w = await openCollected(JSON.stringify(input))
    await startCollected(w)
    await paused(w)
    await w.get('[data-testid="quick-add-skip"]').trigger('click')
    await finished(w)
    expect(w.get('[data-testid="quick-add-processing"]').text()).toContain(
      'Finished with skipped jobs'
    )
    expect(w.get('[data-testid="quick-add-terminal-counts"]').text()).toBe(
      '23 processed · 20 skipped after failure · 0 unprocessed'
    )
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('23')
    expect(w.get('[role="progressbar"]').attributes('aria-valuemax')).toBe('43')
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(23)
    await w.get('[data-testid="quick-add-edit-collected"]').trigger('click')
    await cancelModal()
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(23)
    await w.get('[data-testid="quick-add-edit-collected"]').trigger('click')
    await confirmModal()
    expect(
      (w.get('[data-testid="quick-add-collected"]').element as HTMLTextAreaElement).value
    ).toBe(JSON.stringify(input))
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(0)
    expect(w.find('[data-testid="quick-add-processing"]').exists()).toBe(false)
  })

  it('stops and publishes successful drafts once with remaining jobs unprocessed', async () => {
    const requests = collectedApi(allEligible, (posting, attempt) =>
      attempt === 2 ? { error: 'Failed' } : { result: posting }
    )
    const w = await openCollected(JSON.stringify(manyJobs(43)))
    await startCollected(w)
    await paused(w)
    await w.get('[data-testid="quick-add-stop"]').trigger('click')
    await finished(w)
    expect(requests.parses).toHaveLength(2)
    expect(w.get('[data-testid="quick-add-processing"]').text()).toContain('Processing incomplete')
    expect(w.get('[data-testid="quick-add-terminal-counts"]').text()).toBe(
      '20 processed · 0 skipped after failure · 23 unprocessed'
    )
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(20)
    expect(w.get('[data-testid="quick-add-save"]').attributes('disabled')).toBeUndefined()
    expect(requests.saves).toBe(0)
    await w.get('[data-testid="quick-add-restart"]').trigger('click')
    await cancelModal()
    expect(requests.parses).toHaveLength(2)
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(20)
    await w.get('[data-testid="quick-add-restart"]').trigger('click')
    await confirmModal()
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(0)
    expect(w.get('[data-testid="quick-add-collected"]').attributes('readonly')).toBeUndefined()
    expect(w.find('[data-testid="quick-add-check-summary"]').exists()).toBe(false)
  })

  it('rejects an oversized listing before any AI request', async () => {
    const requests = collectedApi(allEligible)
    const w = await openCollected(
      JSON.stringify([row(1), { ...row(2), description: 'x'.repeat(12_000) }])
    )
    await startCollected(w)
    expect(w.get('[data-testid="quick-add-process-error"]').text()).toContain('Job 2 is too large')
    expect(requests.parses).toEqual([])
    expect(w.find('[data-testid="quick-add-processing"]').exists()).toBe(false)
  })

  it('keeps free-text parsing a single request', async () => {
    const requests = collectedApi(allEligible, () => ({ result: JSON.stringify([row(1)]) }))
    wrapper = await mountSuspended(QuickAddPage, { attachTo: document.body })
    await flushPromises()
    await chooseAi(wrapper, 'builtin')
    await wrapper
      .get('[data-testid="quick-add-ad"]')
      .setValue('Two ads in unstructured pasted text')
    await wrapper.get('[data-testid="quick-add-builtin-run"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper!.findAll('[data-testid="quick-add-row"]')).toHaveLength(1)
    )
    expect(requests.parses).toEqual(['Two ads in unstructured pasted text'])
    // A run that worked is the method the page (and every AI modal) opens on next time.
    expect(useCookie('ai-method').value).toBe('builtin')
    // No per-run model: the server's own default applies.
    expect(requests.models).toEqual([undefined])
    expect(requests.checks).toEqual([])
    expect(wrapper.find('[data-testid="quick-add-processing"]').exists()).toBe(false)
  })
})

describe('Quick add unsaved work protection', () => {
  it('confirms before the first save and uses the same guard for in-app navigation', async () => {
    mockApi([])
    const w = await pasteRows(1)
    expect(routing.guard!({ fullPath: '/companies' })).toBe(false)
    await flushPromises()
    expect(document.body.textContent).toContain('Leave 1 unsaved listing?')
    await cancelModal()
    expect(navigation).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(1)
    await w.get('[data-testid="quick-add-back"]').trigger('click')
    await confirmModal()
    expect(navigation).toHaveBeenCalledWith('/listings')
  })

  it('keeps a cancelled run and discards late responses after confirmed navigation', async () => {
    let resolve!: (reply: ParseReply) => void
    const requests = collectedApi(
      allEligible,
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const w = await openCollected(JSON.stringify(manyJobs(21)))
    await startCollected(w)
    await vi.waitFor(() => expect(requests.parses).toHaveLength(1))
    await w.get('[data-testid="quick-add-back"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Leave batch processing?')
    await cancelModal()
    expect(navigation).not.toHaveBeenCalled()
    expect(w.get('[data-testid="quick-add-processing"]').text()).toContain('Processing jobs')
    expect(routing.guard!({ fullPath: '/companies' })).toBe(false)
    await confirmModal()
    expect(navigation).toHaveBeenCalledWith('/companies')
    resolve({ result: requests.parses[0]! })
    await flushPromises()
    expect(requests.parses).toHaveLength(1)
    expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(0)
  })

  it('protects prepared input only while work exists', async () => {
    collectedApi(eligible)
    const w = await openCollected()
    expect(routing.guard!({ fullPath: '/listings' })).toBe(true)
    await checkCollection(w)
    expect(routing.guard!({ fullPath: '/listings' })).toBe(false)
    await flushPromises()
    await cancelModal()
    await w.get('[data-testid="quick-add-edit-collected"]').trigger('click')
    await cancelModal()
    expect(w.find('[data-testid="quick-add-check-summary"]').exists()).toBe(true)
    await w.get('[data-testid="quick-add-edit-collected"]').trigger('click')
    await confirmModal()
    expect(routing.guard!({ fullPath: '/listings' })).toBe(true)
  })

  it('does not prompt after all collected drafts have been saved', async () => {
    collectedApi(allEligible)
    const w = await openCollected(JSON.stringify([row(1)]))
    await startCollected(w)
    await finished(w)
    await save(w)
    expect(w.find('[data-testid="quick-add-view-listings"]').exists()).toBe(true)
    expect(routing.guard!({ fullPath: '/listings' })).toBe(true)
  })
})

let storedImport: Record<string, unknown> | null = null
const listingImport = (content: string | null, error: string | null = null) => ({
  id: 7,
  kind: 'it',
  generatedAt: '2026-11-03T08:30:00Z',
  itemCount: 2,
  content,
  error,
  reviewedAt: null
})
const openImport = async () => {
  wrapper = await mountSuspended(QuickAddPage, {
    route: '/listings/quick-add?import=7',
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

describe('Quick add from a job import', () => {
  afterEach(() => (storedImport = null))

  it('offers skipping to the next pending import, past this one and broken files', async () => {
    storedImport = listingImport(JSON.stringify(collection))
    const requests = collectedApi(eligible)
    const w = await openImport()
    await vi.waitFor(() =>
      expect(w.find('[data-testid="quick-add-next-import"]').exists()).toBe(true)
    )
    await w.get('[data-testid="quick-add-next-import"]').trigger('click')
    // Unsaved rows: the leave guard asks first, and skipping leaves the import pending.
    expect(navigation).not.toHaveBeenCalled()
    expect(requests.reviewed).toEqual([])
    expect(w.find('[data-testid="quick-add-paste-more"]').exists()).toBe(false)
    expect(w.find('[data-testid="quick-add-back"]').exists()).toBe(false)
  })

  it('turns the import’s new jobs straight into rows, without the AI, and marks it reviewed only once saved', async () => {
    storedImport = listingImport(JSON.stringify(collection))
    const requests = collectedApi(eligible)
    const w = await openImport()
    await vi.waitFor(() => expect(w.findAll('[data-testid="quick-add-row"]')).toHaveLength(1))
    expect(requests.checks).toEqual([collection.map((r) => r.url)])
    expect(requests.parses).toEqual([])
    // Straight to the rows: the paste and AI steps are for manual input only.
    expect(w.find('[data-testid="quick-add-paste"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-import"]').text()).toContain('From import: it')
    expect(w.get('[data-testid="quick-add-paste-summary"]').text()).toContain(
      'Added 1 collected job.'
    )
    const row = w.get('[data-testid="quick-add-row"]')
    expect((row.get('input').element as HTMLInputElement).value).toBe('Seasonal Waiter')
    // Only viewing it: leaving now must keep the import pending.
    await flushPromises()
    expect(requests.reviewed).toEqual([])
    await w.get('[data-testid="quick-add-save"]').trigger('click')
    await vi.waitFor(() => expect(requests.reviewed).toEqual([{ id: 7, isReviewed: true }]))
    expect(requests.saves).toBe(1)
    // A lone listing doesn't open: the done state leads on to the next import instead.
    const done = w.get('[data-testid="quick-add-import-done"]')
    expect(done.text()).toContain('Import done')
    expect(done.text()).toContain('2 saved · Marked as reviewed')
    // Both jobs show as cards: the one saved just now and the one that already was.
    const cards = w.findAll('[data-testid="import-job"]')
    expect(cards.map((c) => c.get('a').attributes('href'))).toEqual([
      expect.stringMatching(/^\/listings\/\d+$/),
      '/listings/101'
    ])
    expect(cards[0]!.text()).toContain('Seasonal Waiter')
    expect(w.find('[data-testid="quick-add-row"]').exists()).toBe(false)
    expect(w.find('[data-testid="quick-add-save"]').exists()).toBe(false)
    await done.get('[data-testid="quick-add-done-next"]').trigger('click')
    expect(navigation).toHaveBeenCalledWith('/listings/quick-add?import=9')
  })

  it('lets an import with nothing new be marked reviewed by hand', async () => {
    storedImport = listingImport(JSON.stringify(collection))
    const requests = collectedApi((urls) =>
      eligible(urls).map((r) => ({ ...r, shouldProcess: false }))
    )
    const w = await openImport()
    await vi.waitFor(() =>
      expect(w.find('[data-testid="quick-add-import-reviewed"]').exists()).toBe(true)
    )
    expect(w.get('[data-testid="quick-add-import-done"]').text()).toContain('Nothing left to save')
    expect(w.findAll('[data-testid="import-job"]')).toHaveLength(2)
    expect(w.find('[data-testid="quick-add-paste"]').exists()).toBe(false)
    expect(w.find('[data-testid="quick-add-save"]').exists()).toBe(false)
    await w.get('[data-testid="quick-add-import-reviewed"]').trigger('click')
    await vi.waitFor(() =>
      expect(w.find('[data-testid="quick-add-import-reviewed"]').exists()).toBe(false)
    )
    expect(requests.reviewed).toEqual([{ id: 7, isReviewed: true }])
  })

  it('leaves an import with nothing new without asking', async () => {
    storedImport = listingImport(JSON.stringify(collection))
    collectedApi((urls) => eligible(urls).map((r) => ({ ...r, shouldProcess: false })))
    const w = await openImport()
    await vi.waitFor(() =>
      expect(w.find('[data-testid="quick-add-import-reviewed"]').exists()).toBe(true)
    )
    expect(routing.guard!({ fullPath: '/listings' })).toBe(true)
    await w.get('[data-testid="quick-add-import-reviewed"]').trigger('click')
    await vi.waitFor(() =>
      expect(w.get('[data-testid="quick-add-import-done"]').text()).toContain('Import done')
    )
    expect(routing.guard!({ fullPath: '/listings' })).toBe(true)
    await w.get('[data-testid="quick-add-done-next"]').trigger('click')
    expect(navigation).toHaveBeenCalledWith('/listings/quick-add?import=9')
    expect(document.body.textContent).not.toContain('Leave collected jobs?')
  })

  it('shows a failed import’s error instead of filling anything in', async () => {
    storedImport = listingImport(null, 'Not a JSON array')
    const requests = collectedApi(allEligible)
    const w = await openImport()
    await vi.waitFor(() =>
      expect(w.get('[data-testid="quick-add-import-error"]').text()).toContain('Not a JSON array')
    )
    expect(w.find('[data-testid="quick-add-collected"]').exists()).toBe(false)
    expect(requests.checks).toEqual([])
  })
})
