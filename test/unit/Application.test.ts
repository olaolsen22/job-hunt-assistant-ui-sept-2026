import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import Application from '~/components/listings/Application.vue'
import type { ListingDetail } from '~/composables/useListing'
import {
  APPLIED_AT,
  NOW,
  applicationListing,
  history,
  interview,
  sentCv
} from '../fixtures/application'

type Call = { query: string; variables: { input: Record<string, unknown> } }

let calls: Call[] = []
let replies: Record<string, unknown> = {}
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body: Call = await readBody(event)
    calls.push(body)
    const field = Object.keys(replies).find((name) => body.query.includes(`${name}(`))
    return { data: field ? { [field]: replies[field] } : {} }
  }
})

const applied: [ListingDetail['status'], string, string] = ['APPLIED', APPLIED_AT, 'Via the site']
const interviewing: [ListingDetail['status'], string] = ['INTERVIEWING', '2026-11-11T16:00:00']
const offerAt = '2026-11-17T12:00:00'

const scenarios = {
  saved: applicationListing(),
  applied: applicationListing({
    status: 'APPLIED',
    statusHistory: history(applied),
    documents: [sentCv]
  }),
  upcoming: applicationListing({
    status: 'INTERVIEWING',
    statusHistory: history(applied, interviewing),
    interviews: [interview(1, '2026-11-25T10:00:00', 'Technical')]
  }),
  pastOnly: applicationListing({
    status: 'INTERVIEWING',
    statusHistory: history(applied, [...interviewing, 'Went **well**']),
    interviews: [interview(1, '2026-11-14T13:00:00')]
  }),
  offer: applicationListing({
    status: 'OFFER',
    statusHistory: history(applied, interviewing, ['OFFER', offerAt, 'Verbal offer'])
  }),
  rejected: applicationListing({
    status: 'REJECTED',
    statusHistory: history(applied, ['REJECTED', '2026-11-16T07:00:00'])
  }),
  declined: applicationListing({
    status: 'WITHDRAWN',
    statusHistory: history(applied, ['OFFER', '2026-11-15T12:00:00'], ['WITHDRAWN', offerAt])
  }),
  archived: applicationListing({
    status: 'REJECTED',
    statusHistory: history(applied, ['REJECTED', '2026-11-16T07:00:00']),
    archivedAt: '2026-11-17T10:00:00'
  })
}

const mountCard = async (listing: ListingDetail) => {
  const wrapper = await mountSuspended(Application, { props: { listing }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
type Wrapper = Awaited<ReturnType<typeof mountCard>>

const BUTTONS = ['listing-apply', 'interview-add', 'listing-record-outcome', 'application-archive']
const buttons = (wrapper: Wrapper) =>
  BUTTONS.filter((id) => wrapper.find(`[data-testid="${id}"]`).exists())
const context = (wrapper: Wrapper) => wrapper.get('[data-testid="application-context"]').text()
// Solid primary is the one filled button; the others are outlined.
const isPrimary = (wrapper: Wrapper, id: string) =>
  wrapper.get(`[data-testid="${id}"]`).classes().includes('bg-primary')

const openMenu = async (wrapper: Wrapper) => {
  // Reka opens on pointerdown, not click; the keyboard path is the reliable one in happy-dom.
  await wrapper.get('[data-testid="application-menu"]').trigger('keydown', { key: 'Enter' })
  await vi.waitFor(() =>
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0)
  )
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}
const labels = (items: HTMLElement[]) => items.map((el) => el.textContent?.trim())
const pick = async (items: HTMLElement[], label: string) => {
  items.find((el) => el.textContent?.trim() === label)!.click()
  await flushPromises()
}
const confirm = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
const lastToast = () => useToast().toasts.value.at(-1)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  calls = []
  replies = {}
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Application card', () => {
  describe('state and next step', () => {
    it('offers only Record application before applying, with no timeline or menu', async () => {
      const wrapper = await mountCard(scenarios.saved)
      expect(context(wrapper)).toBe('Not applied yet.')
      expect(buttons(wrapper)).toEqual(['listing-apply'])
      expect(wrapper.get('[data-testid="listing-apply"]').text()).toBe('Record application')
      expect(wrapper.find('[data-testid="status-timeline"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="application-menu"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="listing-application-count"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('mentions earlier applications to the same company before applying', async () => {
      const wrapper = await mountCard(
        applicationListing({ company: { id: 3, name: 'Acme', applicationCount: 2 } } as never)
      )
      expect(wrapper.get('[data-testid="listing-application-count"]').text()).toBe(
        "You've applied to 2 other listings at Acme."
      )
      wrapper.unmount()
    })

    it('makes Add interview the next step once applied', async () => {
      const wrapper = await mountCard(scenarios.applied)
      expect(context(wrapper)).toBe('Applied 10. nov. 2026 · 8 days ago')
      expect(buttons(wrapper)).toEqual(['interview-add', 'listing-record-outcome'])
      expect(isPrimary(wrapper, 'interview-add')).toBe(true)
      expect(isPrimary(wrapper, 'listing-record-outcome')).toBe(false)
      expect(wrapper.find('[data-testid="status-timeline"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="listing-documents"]').text()).toContain('cv-acme.pdf')
      wrapper.unmount()
    })

    it('leaves nothing primary while an interview is coming up', async () => {
      const wrapper = await mountCard(scenarios.upcoming)
      expect(context(wrapper)).toBe('Next: Technical · 25. nov. 2026, 10:00 (in 7 days)')
      expect(buttons(wrapper)).toEqual(['interview-add', 'listing-record-outcome'])
      expect(isPrimary(wrapper, 'interview-add')).toBe(false)
      expect(isPrimary(wrapper, 'listing-record-outcome')).toBe(false)
      wrapper.unmount()
    })

    it('makes Record outcome primary once no interview is ahead, with the Interviewing note', async () => {
      const wrapper = await mountCard(scenarios.pastOnly)
      expect(context(wrapper)).toContain('Last interview 14. nov. 2026 · none scheduled')
      expect(wrapper.get('[data-testid="application-context"]').html()).toContain(
        '<strong>well</strong>'
      )
      expect(isPrimary(wrapper, 'listing-record-outcome')).toBe(true)
      expect(isPrimary(wrapper, 'interview-add')).toBe(false)
      wrapper.unmount()
    })

    it('says so when interviewing with no interviews logged', async () => {
      const wrapper = await mountCard(
        applicationListing({
          status: 'INTERVIEWING',
          statusHistory: history(applied, interviewing)
        })
      )
      expect(context(wrapper)).toBe('No interviews scheduled.')
      expect(isPrimary(wrapper, 'listing-record-outcome')).toBe(true)
      wrapper.unmount()
    })

    it('asks for a decision on an offer', async () => {
      const wrapper = await mountCard(scenarios.offer)
      expect(context(wrapper)).toBe('Offer received 17. nov. 2026')
      expect(buttons(wrapper)).toEqual(['listing-record-outcome'])
      expect(wrapper.get('[data-testid="listing-record-outcome"]').text()).toBe('Record decision')
      expect(isPrimary(wrapper, 'listing-record-outcome')).toBe(true)
      wrapper.unmount()
    })

    it.each([
      ['rejected', 'Rejected by company 16. nov. 2026'],
      ['declined', 'Declined by you 17. nov. 2026']
    ] as const)('offers to archive a %s application', async (name, line) => {
      const wrapper = await mountCard(scenarios[name])
      expect(context(wrapper)).toContain(line)
      expect(context(wrapper)).toContain('Application finished.')
      expect(buttons(wrapper)).toEqual(['application-archive'])

      await wrapper.get('[data-testid="application-archive"]').trigger('click')
      expect(wrapper.emitted('archive')).toHaveLength(1)
      wrapper.unmount()
    })

    it('has nothing left to do once archived', async () => {
      const wrapper = await mountCard(scenarios.archived)
      expect(context(wrapper)).toContain('Application finished.')
      expect(buttons(wrapper)).toEqual([])
      wrapper.unmount()
    })
  })

  describe('recording the next step', () => {
    it('says up front and after that the first interview moves the status', async () => {
      replies = { addInterview: { interview: { id: 9 }, errors: null } }
      const wrapper = await mountCard(scenarios.applied)

      await wrapper.get('[data-testid="interview-add"]').trigger('click')
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('This moves the application to Interviewing.')
      )
      const input = document.body.querySelector<HTMLInputElement>('input[type="datetime-local"]')!
      input.value = '2026-11-25T10:00'
      input.dispatchEvent(new Event('input'))
      await flushPromises()
      confirm()

      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
      expect(calls[0]!.query).toContain('addInterview(')
      expect(calls[0]!.variables.input).toEqual({
        listingId: 5,
        scheduledAt: new Date('2026-11-25T10:00').toISOString(),
        title: '',
        notes: ''
      })
      expect(lastToast()?.title).toBe('Interview added. Status is now Interviewing.')
      wrapper.unmount()
    })

    it('adds a later interview without the status notice', async () => {
      const wrapper = await mountCard(scenarios.upcoming)
      await wrapper.get('[data-testid="interview-add"]').trigger('click')
      await vi.waitFor(() => expect(document.body.textContent).toContain('Add interview'))
      expect(document.body.textContent).not.toContain('This moves the application')
      wrapper.unmount()
    })

    it.each([
      ['applied', 'Record outcome', ['Offer received', 'Rejected by company', 'Withdrawn by you']],
      ['offer', 'Record decision', ['Accepted', 'Offer withdrawn by company', 'Declined by you']]
    ] as const)('words the %s outcome choices for the situation', async (name, title, choices) => {
      const wrapper = await mountCard(scenarios[name])
      await wrapper.get('[data-testid="listing-record-outcome"]').trigger('click')
      await vi.waitFor(() =>
        expect(document.body.querySelectorAll('[role="dialog"] [role="radio"]')).toHaveLength(3)
      )
      const dialog = document.body.querySelector('[role="dialog"]')!
      expect(dialog.querySelector('h2')?.textContent).toBe(title)
      for (const choice of choices) expect(dialog.textContent).toContain(choice)
      wrapper.unmount()
    })
  })

  describe('status menu', () => {
    it.each([
      ['applied', ['Edit date and note', 'Undo application']],
      ['upcoming', ['Edit Interviewing note', 'Undo Interviewing']],
      ['offer', ['Edit date and note', 'Undo Offer received']],
      ['archived', ['Edit date and note']]
    ] as const)('offers the %s actions', async (name, expected) => {
      const wrapper = await mountCard(scenarios[name])
      expect(labels(await openMenu(wrapper))).toEqual(expected)
      wrapper.unmount()
    })

    it('edits the current status change', async () => {
      replies = { updateStatusChange: { listing: { id: 5 }, errors: null } }
      const wrapper = await mountCard(scenarios.offer)
      await pick(await openMenu(wrapper), 'Edit date and note')
      await vi.waitFor(() => expect(document.body.textContent).toContain('Edit status change'))
      confirm()

      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
      expect(calls[0]!.variables.input).toEqual({
        id: 3,
        occurredAt: new Date(offerAt).toISOString(),
        note: 'Verbal offer'
      })
      wrapper.unmount()
    })
  })

  describe('undo', () => {
    it('undoes an outcome at once and offers to bring it back', async () => {
      replies = {
        undoStatusChange: { listing: { id: 5 }, errors: null },
        recordOutcome: { listing: { id: 5 }, errors: null }
      }
      const wrapper = await mountCard(scenarios.offer)
      await pick(await openMenu(wrapper), 'Undo Offer received')

      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
      expect(document.body.querySelector('[data-testid="confirm-modal-confirm"]')).toBeNull()
      expect(calls.map((c) => c.variables.input)).toEqual([{ listingId: 5 }])
      expect(calls[0]!.query).toContain('undoStatusChange(')

      const toast = lastToast()!
      expect(toast.title).toBe('Offer received undone')
      expect(toast.actions?.[0]?.label).toBe('Undo')
      toast.actions![0]!.onClick!(new MouseEvent('click'))

      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(2))
      expect(calls[1]!.query).toContain('recordOutcome(')
      expect(calls[1]!.variables.input).toEqual({
        listingId: 5,
        outcome: 'OFFER',
        occurredAt: offerAt,
        note: 'Verbal offer'
      })
      wrapper.unmount()
    })

    it('offers no second undo until the listing refetches', async () => {
      replies = { undoStatusChange: { listing: { id: 5 }, errors: null } }
      const wrapper = await mountCard(scenarios.offer)
      await pick(await openMenu(wrapper), 'Undo Offer received')
      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))

      // The prop still shows the undone Offer: a second undo would remove Interviewing unconfirmed.
      expect(labels(await openMenu(wrapper))).toEqual(['Edit date and note'])
      expect(calls).toHaveLength(1)
      wrapper.unmount()
    })

    it('shows the API error and no Undo toast when the undo fails', async () => {
      replies = {
        undoStatusChange: {
          listing: null,
          errors: [{ __typename: 'InvalidStatusTransitionError', message: 'Cannot undo this.' }]
        }
      }
      const wrapper = await mountCard(scenarios.offer)
      await pick(await openMenu(wrapper), 'Undo Offer received')

      await vi.waitFor(() => expect(lastToast()?.title).toBe('Cannot undo this.'))
      expect(wrapper.emitted('changed')).toBeUndefined()
      wrapper.unmount()
    })

    it('links to the open listing that blocks reopening a duplicate', async () => {
      replies = {
        undoStatusChange: {
          listing: null,
          errors: [
            { __typename: 'DuplicateListingError', message: 'Already open', existingListingId: 7 }
          ]
        }
      }
      const wrapper = await mountCard(scenarios.rejected)
      await pick(await openMenu(wrapper), 'Undo Rejected by company')

      await vi.waitFor(() => expect(lastToast()?.title).toBe('Already open'))
      expect(lastToast()?.actions?.[0]).toMatchObject({
        label: 'View open listing',
        to: '/listings/7'
      })
      expect(wrapper.emitted('changed')).toBeUndefined()
      wrapper.unmount()
    })

    it.each([
      [
        'applied',
        'Undo application',
        'Undo application?',
        'Sent documents will be marked as not sent.'
      ],
      [
        'upcoming',
        'Undo Interviewing',
        'Undo Interviewing?',
        'The application goes back to Applied.'
      ]
    ] as const)('asks before undoing %s', async (name, item, title, description) => {
      replies = { undoStatusChange: { listing: { id: 5 }, errors: null } }
      const wrapper = await mountCard(scenarios[name])
      await pick(await openMenu(wrapper), item)

      await vi.waitFor(() => expect(document.body.textContent).toContain(title))
      expect(document.body.textContent).toContain(description)
      expect(calls).toEqual([])
      confirm()

      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
      expect(calls.map((c) => c.variables.input)).toEqual([{ listingId: 5 }])
      wrapper.unmount()
    })
  })
})
