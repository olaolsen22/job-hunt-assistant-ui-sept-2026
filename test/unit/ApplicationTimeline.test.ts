import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ApplicationTimeline from '~/components/listings/ApplicationTimeline.vue'
import {
  APPLIED_AT,
  NOW,
  applicationListing,
  history,
  interview,
  sentCv,
  unsentCv
} from '../fixtures/application'

type Call = { query: string; variables: { input: Record<string, unknown> } }

let calls: Call[] = []
let reply: Record<string, unknown> = {}
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body: Call = await readBody(event)
    calls.push(body)
    return { data: reply }
  }
})

const listing = applicationListing({
  status: 'INTERVIEWING',
  statusHistory: history(
    ['APPLIED', APPLIED_AT, 'Sent via **email**'],
    ['INTERVIEWING', '2026-11-11T16:00:00']
  ),
  interviews: [
    interview(1, '2026-11-14T13:00:00', 'HR screen', 'Asked about **notice period**.'),
    interview(2, '2026-11-25T10:00:00', null)
  ],
  documents: [sentCv, unsentCv]
})

const mountTimeline = async () => {
  const wrapper = await mountSuspended(ApplicationTimeline, {
    props: { listing },
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

const openRowMenu = async (wrapper: Awaited<ReturnType<typeof mountTimeline>>, index: number) => {
  // Reka opens on pointerdown, not click; the keyboard path is the reliable one in happy-dom.
  await wrapper.findAll('[data-testid="timeline-row-menu"]')[index]!.trigger('keydown', {
    key: 'Enter'
  })
  await vi.waitFor(() =>
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0)
  )
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

const pick = async (items: HTMLElement[], label: string) => {
  items.find((el) => el.textContent?.includes(label))!.click()
  await flushPromises()
}

const confirm = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  calls = []
  reply = {}
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ApplicationTimeline', () => {
  it('shows status changes and interviews newest first, without the Interviewing stamp', async () => {
    const wrapper = await mountTimeline()
    const titles = wrapper
      .findAll('[data-testid="timeline-interview"], [data-testid="timeline-status"]')
      .map((el) => el.text())

    expect(titles).toEqual(['Interview', 'HR screen', 'Applied'])
    expect(wrapper.text()).not.toContain('Interviewing')
    wrapper.unmount()
  })

  it('dates interviews with the time, how far off, and Upcoming for future ones', async () => {
    const wrapper = await mountTimeline()
    const text = wrapper.get('[data-testid="status-timeline"]').text()

    expect(text).toContain('25. nov. 2026, 10:00 · in 7 days')
    expect(text).toContain('14. nov. 2026, 13:00 · 4 days ago')
    expect(text.match(/Upcoming/g)).toHaveLength(1)
    expect(text.indexOf('Upcoming')).toBeLessThan(text.indexOf('HR screen'))
    // Status rows show the date alone.
    expect(text).toContain('10. nov. 2026')
    expect(text).not.toContain('10. nov. 2026, 09:00')
    wrapper.unmount()
  })

  it('renders notes as markdown and lists the sent documents on the Applied row', async () => {
    const wrapper = await mountTimeline()

    expect(wrapper.html()).toContain('<strong>email</strong>')
    expect(wrapper.html()).toContain('<strong>notice period</strong>')
    const documents = wrapper.get('[data-testid="listing-documents"]')
    expect(documents.text()).toContain('Sent:')
    expect(documents.text()).toContain('cv-acme.pdf')
    expect(documents.text()).not.toContain('cv-unsent.pdf')
    expect(documents.get('a').attributes('href')).toBe('/api/documents/91')
    wrapper.unmount()
  })

  it('edits a status change’s date and note from its row menu', async () => {
    reply = { updateStatusChange: { listing: { id: 5 }, errors: null } }
    const wrapper = await mountTimeline()

    // Rows: upcoming interview, past interview, Applied.
    await pick(await openRowMenu(wrapper, 2), 'Edit date and note')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Edit status change'))
    confirm()

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(calls[0]!.query).toContain('updateStatusChange(')
    expect(calls[0]!.variables.input).toEqual({
      id: 1,
      occurredAt: new Date(APPLIED_AT).toISOString(),
      note: 'Sent via **email**'
    })
    wrapper.unmount()
  })

  it('edits an interview from its row menu', async () => {
    reply = { updateInterview: { interview: { id: 1 }, errors: null } }
    const wrapper = await mountTimeline()

    const items = await openRowMenu(wrapper, 1)
    expect(items.map((el) => el.textContent?.trim())).toEqual([
      'Edit interview',
      'Delete interview'
    ])
    await pick(items, 'Edit interview')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Edit interview'))
    // An edit never moves the status, so it doesn't say so.
    expect(document.body.textContent).not.toContain('This moves the application to Interviewing.')
    confirm()

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(calls[0]!.query).toContain('updateInterview(')
    expect(calls[0]!.variables.input).toMatchObject({ id: 1, title: 'HR screen' })
    wrapper.unmount()
  })

  it('deletes an interview only after confirming', async () => {
    reply = { deleteInterview: { id: 1, errors: null } }
    const wrapper = await mountTimeline()

    await pick(await openRowMenu(wrapper, 1), 'Delete interview')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Delete interview?'))
    expect(calls).toEqual([])
    confirm()

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(calls[0]!.query).toContain('deleteInterview(')
    expect(calls[0]!.variables.input).toEqual({ id: 1 })
    wrapper.unmount()
  })

  it('shows the API error and refetches when the interview is already gone', async () => {
    reply = {
      deleteInterview: {
        id: null,
        errors: [{ __typename: 'InterviewNotFoundError', message: 'Interview not found.' }]
      }
    }
    const wrapper = await mountTimeline()

    await pick(await openRowMenu(wrapper, 1), 'Delete interview')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Delete interview?'))
    confirm()

    const { toasts } = useToast()
    await vi.waitFor(() => expect(toasts.value.at(-1)?.title).toBe('Interview not found.'))
    // The refetch from useMutation, and no success emit on top of it.
    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })
})
