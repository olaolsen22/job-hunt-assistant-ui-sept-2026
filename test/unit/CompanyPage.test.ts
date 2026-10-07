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
  locations: [location(1, 'Oslo', 'NO')]
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
})
