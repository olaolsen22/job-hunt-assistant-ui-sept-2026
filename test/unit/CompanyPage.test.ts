import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CompanyPage from '~/pages/companies/[id]/index.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

// Location 1 is Oslo, 3 is Stockholm (see `locations` below).
const position = (
  id: number,
  status: string,
  archivedAt: string | null = null,
  locationId = 1
) => ({
  id,
  title: `Job ${id}`,
  status,
  archivedAt,
  jobRole: { name: 'Developer' },
  locations: [{ location: { id: locationId } }]
})

const location = (id: number, city: string, countryCode: string, isTarget = false) => ({
  location: { id, city, countryCode, isTarget }
})

const baseCompany = {
  id: 3,
  name: 'Acme',
  favoritedAt: null,
  avoidedAt: null as string | null,
  notes: null as string | null,
  applicationCount: 2,
  industry: { name: 'Consulting' },
  locations: [location(1, 'Oslo', 'NO')],
  contacts: [] as Record<string, unknown>[],
  orgNumber: null as string | null,
  websiteUrl: null as string | null,
  careersUrl: null as string | null,
  linkedInUrl: null as string | null,
  kind: null as string | null,
  sizeBand: null as string | null,
  foundedYear: null as number | null,
  description: null as string | null,
  workMode: null as string | null,
  workingLanguage: null as string | null,
  researchedAt: null as string | null,
  skills: [] as { skill: { id: number; name: string } }[]
}

type Request = { query: string; variables: Record<string, unknown> }

// The page query answers with the current company; mutations flip it like the API would.
const mountPage = async (overrides: Partial<typeof baseCompany> = {}, found = true) => {
  const company = { ...baseCompany, ...overrides }
  const requests: Request[] = []
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const body: Request = await readBody(event)
      requests.push(body)
      const input = body.variables.input as Record<string, unknown> | undefined
      if (body.query.includes('setCompanyAvoided')) {
        company.avoidedAt = input!.isAvoided ? '2026-10-07T10:00:00Z' : null
        return { data: { setCompanyAvoided: { company: { id: 3 }, errors: null } } }
      }
      if (body.query.includes('addContact')) {
        const contact = input!.contact as Record<string, unknown>
        company.contacts = [...company.contacts, { id: 9, notes: null, ...contact }]
        return { data: { addContact: { contact: { id: 9 }, errors: null } } }
      }
      if (body.query.includes('setCompanyNotes')) {
        company.notes = String(input!.notes).trim() || null
        return { data: { setCompanyNotes: { company: { id: 3 }, errors: null } } }
      }
      return {
        data: {
          companies: { nodes: found ? [company] : [] },
          open: {
            items: [position(1, 'SAVED'), position(2, 'REJECTED'), position(3, 'INTERVIEWING')]
          },
          archived: { items: [position(4, 'APPLIED', '2026-09-01T10:00:00Z', 3)] }
        }
      }
    }
  })
  const wrapper = await mountSuspended(CompanyPage, {
    route: '/companies/3',
    attachTo: document.body
  })
  await flushPromises()
  return { wrapper, requests }
}

describe('Company page', () => {
  it('shows the header, positions in status order and the stats', async () => {
    const { wrapper } = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-header"]').exists()).toBe(true)
    )

    const header = wrapper.get('[data-testid="company-header"]')
    expect(header.text()).toContain('Acme')
    expect(header.text()).toContain('Consulting')
    expect(header.find('[data-testid="company-avoided"]').exists()).toBe(false)

    // In progress, then Saved, then finished, then archived.
    const rows = wrapper
      .get('[data-testid="company-positions"]')
      .findAll('[data-testid="dashboard-row"]')
    expect(rows.map((r) => r.attributes('href'))).toEqual([
      '/listings/3',
      '/listings/1',
      '/listings/2',
      '/listings/4'
    ])
    expect(rows[3]!.text()).toContain('Archived')

    const stats = wrapper.get('[data-testid="company-stats"]').text()
    expect(stats).toContain('Listings4')
    expect(stats).toContain('Applications2')
    // Interviewing + the archived Applied one.
    expect(stats).toContain('In progress2')
    expect(stats).toContain('Interviewed1')
    expect(stats).toContain('Offers0')
    expect(stats).toContain('Rejected1')
    wrapper.unmount()
  })

  it('lists locations with listing counts, preferred ones first', async () => {
    const { wrapper } = await mountPage({
      locations: [
        location(1, 'Oslo', 'NO'),
        location(2, 'Bergen', 'NO', true),
        location(3, 'Stockholm', 'SE')
      ]
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-locations"]').exists()).toBe(true)
    )

    const rows = wrapper.findAll('[data-testid="company-location"]')
    // Bergen is preferred despite 0 listings; Oslo (3) beats Stockholm (1, the archived one).
    expect(rows.map((r) => r.text())).toEqual([
      'Bergen, NorwayPreferred0 listings',
      'Oslo, Norway3 listings',
      'Stockholm, Sweden1 listing'
    ])
    expect(wrapper.findAll('[data-testid="company-location-preferred"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('says so when the company does not exist', async () => {
    const { wrapper } = await mountPage({}, false)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-not-found"]').exists()).toBe(true)
    )
    wrapper.unmount()
  })

  it('saves notes from the dialog and renders them as Markdown', async () => {
    const { wrapper, requests } = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-notes-add"]').exists()).toBe(true)
    )

    await wrapper.get('[data-testid="company-notes-add"]').trigger('click')
    await flushPromises()
    const textarea = document.body.querySelector('textarea')!
    textarea.value = 'Bad reviews on **pay**'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-notes"] strong').text()).toBe('pay')
    )
    expect(requests.find((r) => r.query.includes('setCompanyNotes'))!.variables.input).toEqual({
      id: 3,
      notes: 'Bad reviews on **pay**'
    })
    wrapper.unmount()
  })

  it('asks before avoiding, then shows the badge and notice', async () => {
    const { wrapper, requests } = await mountPage()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="company-more"]').exists()).toBe(true))

    await wrapper.get('[data-testid="company-more"]').trigger('click')
    await flushPromises()
    const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
      el.textContent?.includes('Avoid company')
    )!
    item.click()
    await flushPromises()

    // Nothing is sent until the confirmation.
    expect(requests.some((r) => r.query.includes('setCompanyAvoided'))).toBe(false)
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-avoided-notice"]').exists()).toBe(true)
    )
    expect(
      wrapper.get('[data-testid="company-header"] [data-testid="company-avoided"]').text()
    ).toBe('Avoided')
    expect(requests.find((r) => r.query.includes('setCompanyAvoided'))!.variables.input).toEqual({
      id: 3,
      isAvoided: true
    })
    wrapper.unmount()
  })

  it('shows contacts with links and Markdown notes', async () => {
    const { wrapper } = await mountPage({
      contacts: [
        {
          id: 5,
          name: 'Kari Nordmann',
          title: 'Recruiter',
          email: 'kari@acme.no',
          phone: null,
          url: null,
          notes: 'Prefers **email**'
        }
      ]
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="contact"] strong').exists()).toBe(true)
    )

    const contact = wrapper.get('[data-testid="contact"]')
    expect(contact.text()).toContain('Kari Nordmann')
    expect(contact.find('a[href="mailto:kari@acme.no"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('adds a contact from the dialog', async () => {
    const { wrapper, requests } = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="contacts-empty"]').exists()).toBe(true)
    )

    await wrapper.get('[data-testid="contact-add"]').trigger('click')
    await flushPromises()
    // UInput puts the test id on the <input> itself or on its wrapper.
    const input = document.body.querySelector<HTMLInputElement>(
      'input[data-testid="contact-name"], [data-testid="contact-name"] input'
    )!
    input.value = ' Kari '
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() => expect(wrapper.find('[data-testid="contact"]').text()).toContain('Kari'))
    expect(requests.find((r) => r.query.includes('addContact'))!.variables.input).toEqual({
      companyId: 3,
      contact: { name: 'Kari', title: null, email: null, phone: null, url: null, notes: null }
    })
    wrapper.unmount()
  })

  it('shows the research, listing unset facts as Not set', async () => {
    const { wrapper } = await mountPage({
      kind: 'PRODUCT',
      sizeBand: 'MEDIUM',
      orgNumber: '923609016',
      description: 'Builds payment apps.',
      careersUrl: 'https://acme.no/jobs',
      researchedAt: '2026-10-20T10:00:00Z',
      skills: [{ skill: { id: 1, name: 'Kotlin' } }]
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-research"]').exists()).toBe(true)
    )

    expect(wrapper.get('[data-testid="company-header"]').text()).toContain('51–200 employees')
    const research = wrapper.get('[data-testid="company-research"]')
    expect(research.text()).toContain('Builds payment apps.')
    expect(research.get('a[href="https://acme.no/jobs"]').text()).toContain('Careers page')
    expect(research.find('a[href^="https://acme.no"]').attributes('target')).toBe('_blank')
    const facts = research.get('[data-testid="company-facts"]').text()
    expect(facts).toContain('TypeProduct company')
    expect(facts).toContain('Org.nr923 609 016')
    expect(facts).toContain('FoundedNot set')
    expect(research.get('[data-testid="company-skills"]').text()).toBe('Kotlin')
    expect(research.text()).toContain('Researched')
    // In the toolbar beside Edit, like Analyze ad; the edit page only fills the gaps.
    const ai = wrapper.get('[data-testid="company-research-ai"]')
    expect(ai.text()).toBe('Re-research')
    expect(ai.attributes('href')).toBe('/companies/3/edit?analyze')
    wrapper.unmount()
  })

  it('offers to add research when there is none', async () => {
    const { wrapper } = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="company-research-empty"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="company-facts"]').exists()).toBe(false)
    for (const testid of ['company-research-ai', 'company-research-empty-ai']) {
      const ai = wrapper.get(`[data-testid="${testid}"]`)
      expect(ai.text()).toBe('Research company')
      expect(ai.attributes('href')).toBe('/companies/3/edit?analyze')
    }
    wrapper.unmount()
  })
})
