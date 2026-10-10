import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import QuickAddPage from '~/pages/listings/quick-add.vue'

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
const failed = {
  listing: null,
  previousAttempts: null,
  possibleDuplicates: null,
  errors: [{ __typename: 'ValidationError', message: 'Something is wrong' }]
}

// Each test sets how the batch's rows come back; saves are counted to catch accidental ones.
const mockApi = (results: unknown[]) => {
  const saves = { count: 0 }
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query } = await readBody(event)
      if (query.includes('ListingQuickParsePrompt')) {
        return { data: { prompt: { instructions: 'x' } } }
      }
      if (query.includes('QuickAddListings')) {
        saves.count++
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
afterEach(() => wrapper?.unmount())

const pasteRows = async (count: number) => {
  wrapper = await mountSuspended(QuickAddPage, { attachTo: document.body })
  await flushPromises()
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

  it('offers View listings instead of Save once everything is saved', async () => {
    mockApi([saved(1), saved(2)])
    const w = await pasteRows(2)
    await save(w)

    expect(w.find('[data-testid="quick-add-view-listings"]').exists()).toBe(true)
    expect(w.find('[data-testid="quick-add-save"]').exists()).toBe(false)
    expect(w.find('[data-testid="quick-add-back"]').exists()).toBe(false)
    expect(w.get('[data-testid="quick-add-paste-summary"]').text()).toContain('All saved.')
  })
})
