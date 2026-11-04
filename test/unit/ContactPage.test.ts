import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ContactPage from '~/pages/contacts/[id].vue'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

beforeEach(() => clearNuxtData())

const interaction = {
  id: 11,
  occurredAt: '2026-10-20T09:30:00Z',
  direction: 'SENT',
  channel: 'EMAIL',
  note: 'Sent an open application.',
  followUpOn: '2026-10-27'
}

const person = (interactions: object[] = [interaction]) => ({
  id: 5,
  companyId: 1,
  name: 'Kari Nordmann',
  title: 'Recruiter',
  email: 'kari@acme.no',
  phone: null,
  url: null,
  notes: null,
  followUpOn: interactions.length ? '2026-10-27' : null,
  lastInteractionAt: interactions.length ? '2026-10-20T09:30:00Z' : null,
  company: { id: 1, name: 'Acme' },
  interactions
})

const respond = (contact: ReturnType<typeof person> | null) => {
  const sent: { name: string; input: Record<string, unknown> }[] = []
  let loads = 0
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      const mutation = query.match(/mutation (\w+)/)?.[1]
      if (mutation) {
        sent.push({ name: mutation, input: variables.input })
        const field = mutation[0]!.toLowerCase() + mutation.slice(1)
        return { data: { [field]: { contactInteraction: { id: 12 }, errors: null } } }
      }
      loads++
      return { data: { contactById: contact, listings: { items: [] } } }
    }
  })
  return { sent, loads: () => loads }
}

const inBody = <T extends HTMLElement>(testid: string) =>
  document.body.querySelector<T>(`[data-testid="${testid}"]`)

const type = async (testid: string, value: string) => {
  const input = document.body.querySelector<HTMLInputElement>(`input[data-testid="${testid}"]`)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

const mountPage = async () => {
  const wrapper = await mountSuspended(ContactPage, {
    route: '/contacts/5',
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

describe('Person page', () => {
  it('shows the person with their log, follow-up and an open application to start', async () => {
    respond(person())
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="contact-header"]').exists()).toBe(true)
    )

    expect(wrapper.get('[data-testid="contact-header"]').text()).toContain('Recruiter at Acme')
    expect(wrapper.get('[data-testid="follow-up-chip"]').exists()).toBe(true)
    const entry = wrapper.get('[data-testid="interaction"]').text()
    expect(entry).toContain('You sent · Email')
    expect(entry).toContain('Sent an open application.')
    expect(entry).toContain('Follow up by')
    expect(wrapper.get('[data-testid="contact-listings-empty"] a').attributes('href')).toBe(
      '/listings/add?contact=5'
    )
    wrapper.unmount()
  })

  it('logs a received reply without a follow-up and refetches the person', async () => {
    const { sent, loads } = respond(person([]))
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="interactions-empty"]').exists()).toBe(true)
    )
    expect(wrapper.text()).toContain('No follow-up set')

    await wrapper.get('[data-testid="interaction-add"]').trigger('click')
    await flushPromises()
    // Received, then a phone call.
    inBody('interaction-direction')!.querySelectorAll('button')[1]!.click()
    await flushPromises()
    await type('interaction-occurred-at', '2026-10-28T14:00')
    inBody('confirm-modal-confirm')!.click()

    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).toEqual({
      name: 'AddContactInteraction',
      input: {
        contactId: 5,
        interaction: {
          occurredAt: new Date('2026-10-28T14:00').toISOString(),
          direction: 'RECEIVED',
          channel: 'EMAIL',
          note: null,
          followUpOn: null
        }
      }
    })
    await vi.waitFor(() => expect(loads()).toBe(2))
    wrapper.unmount()
  })

  it('blocks a future date and a follow-up before the interaction', async () => {
    const { sent } = respond(person([]))
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="interaction-add"]').exists()).toBe(true)
    )
    await wrapper.get('[data-testid="interaction-add"]').trigger('click')
    await flushPromises()

    await type('interaction-occurred-at', '2999-01-01T10:00')
    expect(document.body.textContent).toContain('Can’t be in the future')
    expect(inBody<HTMLButtonElement>('confirm-modal-confirm')!.disabled).toBe(true)

    await type('interaction-occurred-at', '2026-10-20T10:00')
    await type('interaction-follow-up', '2026-10-19')
    expect(document.body.textContent).toContain('Can’t be before the interaction')
    expect(inBody<HTMLButtonElement>('confirm-modal-confirm')!.disabled).toBe(true)
    expect(sent).toEqual([])
    wrapper.unmount()
  })

  it('edits an interaction by sending all of it again', async () => {
    const { sent } = respond(person())
    const wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="interaction"]').exists()).toBe(true))

    // The ⋮ menu's Edit, through the list's event.
    wrapper.getComponent({ name: 'ContactsInteractionList' }).vm.$emit('edit', interaction)
    await flushPromises()
    expect(inBody('confirm-modal-confirm')!.textContent).toContain('Save changes')
    inBody('confirm-modal-confirm')!.click()

    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).toEqual({
      name: 'UpdateContactInteraction',
      input: {
        id: 11,
        interaction: {
          occurredAt: '2026-10-20T09:30:00.000Z',
          direction: 'SENT',
          channel: 'EMAIL',
          note: 'Sent an open application.',
          followUpOn: '2026-10-27'
        }
      }
    })
    wrapper.unmount()
  })

  it('deletes an interaction only after confirming', async () => {
    const { sent } = respond(person())
    const wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="interaction"]').exists()).toBe(true))

    wrapper.getComponent({ name: 'ContactsInteractionList' }).vm.$emit('delete', interaction)
    await flushPromises()
    expect(sent).toEqual([])
    expect(document.body.textContent).toContain('Delete this interaction?')
    inBody('confirm-modal-confirm')!.click()

    await vi.waitFor(() =>
      expect(sent).toEqual([{ name: 'DeleteContactInteraction', input: { id: 11 } }])
    )
    wrapper.unmount()
  })

  it('says when the person does not exist', async () => {
    respond(null)
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="contact-not-found"]').exists()).toBe(true)
    )
    wrapper.unmount()
  })
})
