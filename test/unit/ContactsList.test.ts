import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ContactsPage from '~/pages/contacts/index.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const contact = (id: number, name: string, extra: object = {}) => ({
  id,
  companyId: 1,
  name,
  title: null as string | null,
  email: null,
  phone: null,
  url: null,
  notes: null,
  followUpOn: null as string | null,
  lastInteractionAt: null as string | null,
  company: { id: 1, name: 'Acme' },
  ...extra
})

// The main field is the one without an alias; its arguments are what the tab changes.
const mainArgs = (query: string) => query.match(/\n\s*contacts\(([^)]*)\)/)![1]!

const respond = (nodes: ReturnType<typeof contact>[], due = 2) => {
  const queries: string[] = []
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query } = await readBody(event)
      queries.push(query)
      return {
        data: {
          contacts: {
            nodes,
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: nodes.length
          },
          due: { totalCount: due }
        }
      }
    }
  })
  return queries
}

describe('People list', () => {
  it('lists everyone by name with their company and last contact, and switches to due follow-ups', async () => {
    const queries = respond([
      contact(1, 'Kari Nordmann', {
        title: 'Recruiter',
        lastInteractionAt: new Date().toISOString()
      }),
      contact(2, 'Ola Hansen')
    ])
    const wrapper = await mountSuspended(ContactsPage, { route: '/contacts' })
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="contacts-row"]')).toHaveLength(2))

    const rows = wrapper.findAll('[data-testid="contacts-row"]')
    expect(rows[0]!.text()).toContain('Recruiter · Acme')
    expect(rows[0]!.text()).toContain('Last contacted today')
    expect(rows[1]!.text()).toContain('Not contacted yet')
    expect(wrapper.get('[data-testid="contacts-row-link"]').attributes('href')).toBe('/contacts/1')
    expect(mainArgs(queries[0]!)).not.toContain('where')
    expect(wrapper.get('[data-testid="contacts-tabs"]').text()).toContain('Follow-up due2')

    await wrapper.findAll('[role="tab"]')[1]!.trigger('mousedown')
    await vi.waitFor(() => expect(queries).toHaveLength(2))
    // Inline, not a filter variable, and the oldest follow-up first.
    expect(mainArgs(queries[1]!)).toMatch(/where: \{\s*followUpOn: \{\s*lte: \$today/)
    expect(mainArgs(queries[1]!)).toMatch(/order: \[\{\s*followUpOn: ASC/)
    await flushPromises()
    expect(useRouter().currentRoute.value.query).toEqual({ due: '1' })
    wrapper.unmount()
  })

  it('opens on due follow-ups from the URL and says when nothing is due', async () => {
    const queries = respond([], 0)
    const wrapper = await mountSuspended(ContactsPage, { route: '/contacts?due=1' })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="contacts-empty"]').text()).toBe('Nothing to follow up.')
    )
    expect(mainArgs(queries[0]!)).toContain('followUpOn')
    wrapper.unmount()
  })

  it('points to the companies when there are no people yet', async () => {
    respond([], 0)
    const wrapper = await mountSuspended(ContactsPage, { route: '/contacts' })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="contacts-empty"]').text()).toContain('No people yet.')
    )
    expect(wrapper.get('[data-testid="contacts-empty"] a').attributes('href')).toBe('/companies')
    wrapper.unmount()
  })
})
