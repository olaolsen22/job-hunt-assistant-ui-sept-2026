import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CompaniesPage from '~/pages/companies/index.vue'
import { useCompaniesView } from '~/composables/useListingsList'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)

const company = (id: number, name: string, avoidedAt: string | null = null) => ({
  id,
  name,
  avoidedAt,
  kind: 'CONSULTANCY' as string | null,
  contacts: [] as { id: number }[],
  sizeBand: null as string | null,
  listingCount: 3,
  applicationCount: 1,
  industry: { name: 'Consulting' },
  locations: [{ location: { city: 'Oslo', countryCode: 'NO' } }]
})

// Mounting at a route and writing the URL run the global auth middleware.
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

describe('Companies list', () => {
  it('shows the companies and asks for page 2 with the end cursor of page 1', async () => {
    const afters: unknown[] = []
    const queries: string[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        queries.push(query)
        afters.push(variables.after)
        return {
          data: {
            companies: {
              nodes: [{ ...company(1, 'Bekk'), sizeBand: 'MEDIUM' }, company(2, 'Vipps')],
              pageInfo: { hasNextPage: true, endCursor: 'c2' },
              totalCount: 45
            }
          }
        }
      }
    })

    const wrapper = await mountSuspended(CompaniesPage)
    // The first fetch starts on mount (the grid is measured first), so mounting doesn't wait for it.
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="companies-row"]')).toHaveLength(2))

    // A measured literal, not a variable (the API's cost check rejects a `first` variable).
    expect(queries[0]).toMatch(/first: \d+/)
    expect(queries[0]).not.toContain('$first')
    expect(wrapper.get('[data-testid="companies-total"]').text()).toBe('45 companies')
    expect(wrapper.findAll('[data-testid="companies-row-industry"]').map((p) => p.text())).toEqual([
      '51–200 · Consulting',
      'Consulting'
    ])

    await wrapper.getComponent('[data-testid="companies-pagination"]').vm.$emit('update:page', 2)
    await flushPromises()

    expect(afters).toEqual([null, 'c2'])
    // Another mounted page would share the `companies` data key with the next test.
    wrapper.unmount()
  })

  // The page after cursor `last` is the last one.
  const pages = (last: string | null) => {
    const afters: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { variables } = await readBody(event)
        afters.push(variables.after)
        // Page n ends at cursor `c<n>`.
        const n = variables.after ? Number(variables.after.slice(1)) + 1 : 1
        return {
          data: {
            companies: {
              nodes: [company(n, `Company ${n}`)],
              pageInfo: { hasNextPage: variables.after !== last, endCursor: `c${n}` },
              totalCount: 45
            }
          }
        }
      }
    })
    return afters
  }

  it('opens the page from the URL and keeps it there', async () => {
    const afters = pages('never')
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies?search=bekk&page=2' })
    const pager = () => wrapper.findComponent('[data-testid="companies-pagination"]')
    await vi.waitFor(() => expect(pager().exists() && pager().props('page')).toBe(2))

    // Page 1 is walked for its end cursor, then page 2 is fetched with it.
    expect(afters).toEqual([null, 'c1'])
    expect(
      wrapper.get<HTMLInputElement>('input[data-testid="companies-search"]').element.value
    ).toBe('bekk')
    expect(useRouter().currentRoute.value.query).toEqual({ search: 'bekk', page: '2' })
    wrapper.unmount()
  })

  it('shows the last page when the URL points past the end', async () => {
    // Page 2 starts after c1 and is the last one.
    const afters = pages('c1')
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies?page=9' })
    const pager = () => wrapper.findComponent('[data-testid="companies-pagination"]')
    await vi.waitFor(() => expect(pager().exists() && pager().props('page')).toBe(2))

    expect(afters).toEqual([null, 'c1', 'c1'])
    // The URL is written by a watcher after the page settles.
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({ page: '2' }))
    wrapper.unmount()
  })

  it('links rows to the company page and badges avoided companies', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          companies: {
            nodes: [company(1, 'Bekk'), company(2, 'Vipps', '2026-10-07T10:00:00Z')],
            pageInfo: { hasNextPage: false, endCursor: 'c2' },
            totalCount: 2
          }
        }
      })
    })
    const wrapper = await mountSuspended(CompaniesPage)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="companies-row"]')).toHaveLength(2))

    const [bekk, vipps] = wrapper.findAll('[data-testid="companies-row"]')
    expect(bekk!.get('[data-testid="companies-row-link"]').attributes('href')).toBe('/companies/1')
    expect(bekk!.find('[data-testid="company-avoided"]').exists()).toBe(false)
    expect(vipps!.get('[data-testid="company-avoided"]').text()).toBe('Avoided')
    wrapper.unmount()
  })

  // Records each request; `nodes` decides the reply.
  const record = (nodes: (query: string) => ReturnType<typeof company>[]) => {
    const requests: { query: string; variables: Record<string, unknown> }[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        requests.push({ query, variables })
        const list = nodes(query)
        return {
          data: {
            companies: {
              nodes: list,
              pageInfo: { hasNextPage: false, endCursor: null },
              totalCount: list.length
            }
          }
        }
      }
    })
    return requests
  }

  it('keeps old Hide avoided links working and drops the filter from its chip', async () => {
    const requests = record(() => [company(1, 'Bekk')])
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies?hideAvoided=1' })
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]!.query).toMatch(/avoidedAt: \{\s*eq: null\s*\}/)

    await wrapper.get('[data-testid="companies-chip-hideAvoided"]').trigger('click')

    await vi.waitFor(() => expect(requests.at(-1)!.query).not.toMatch(/avoidedAt: \{/))
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({}))
    expect(useCompaniesView().value).toBe('/companies')
    wrapper.unmount()
  })

  it('switches to consultancies by type and keeps the tab in the URL', async () => {
    const requests = record((query) =>
      query.includes('CONSULTANCY')
        ? [company(2, 'Bekk')]
        : [company(1, 'Acme'), company(2, 'Bekk')]
    )
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies' })
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="companies-row"]')).toHaveLength(2))
    expect(requests[0]!.query).not.toContain('kind:')
    expect(wrapper.get('[data-testid="companies-total"]').text()).toBe('2 companies')

    // Reka tabs switch on mousedown.
    await wrapper.findAll('[data-testid="companies-tabs"] [role="tab"]')[1]!.trigger('mousedown')

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="companies-total"]').text()).toBe('1 consultancy')
    )
    expect(requests.at(-1)!.query).toMatch(/kind: \{\s*eq: CONSULTANCY\s*\}/)
    // The tab already says it, so rows don't repeat the type.
    expect(wrapper.find('[data-testid="companies-row-kind"]').exists()).toBe(false)
    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.query).toEqual({ tab: 'consultancies' })
    )
    wrapper.unmount()
  })

  it('lists every other type under Employers and says where untyped companies are', async () => {
    const requests = record(() => [])
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies?tab=employers' })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="companies-empty"]').exists()).toBe(true)
    )

    expect(requests[0]!.query).toMatch(
      /kind: \{\s*in: \[PRODUCT, IN_HOUSE, PUBLIC_SECTOR, AGENCY, STARTUP\]/
    )
    expect(wrapper.get('[data-testid="companies-tab-hint"]').text()).toBe(
      'Companies without a type yet are under All.'
    )
    expect(wrapper.get('[data-testid="companies-empty"]').text()).toContain('No employers yet.')
    wrapper.unmount()
  })

  it('applies facets from the URL as variables, shows them as chips and clears them', async () => {
    const requests = record(() => [])
    const wrapper = await mountSuspended(CompaniesPage, {
      route: '/companies?skill=Vue&size=SMALL,MEDIUM&researched=no'
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="companies-empty"]').exists()).toBe(true)
    )

    expect(requests[0]!.variables).toMatchObject({
      skills: ['Vue'],
      sizeBands: ['SMALL', 'MEDIUM']
    })
    // User values only travel as variables.
    expect(requests[0]!.query).not.toContain('"Vue"')
    expect(wrapper.get('[data-testid="companies-chip-skill"]').text()).toBe('Skill: Vue')
    expect(wrapper.get('[data-testid="companies-chip-size"]').text()).toBe('Size: 11–50, 51–200')
    expect(wrapper.get('[data-testid="companies-chip-researched"]').text()).toBe('Not researched')
    expect(wrapper.get('[data-testid="companies-filters-toggle"]').text()).toContain('3')
    expect(wrapper.get('[data-testid="companies-empty"]').text()).toContain('No companies match.')

    await wrapper.get('[data-testid="companies-empty-clear"]').trigger('click')
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({}))
    expect(requests.at(-1)!.variables).not.toHaveProperty('skills')
    wrapper.unmount()
  })

  it('shows the type, contacts, listings even at zero and other counts only when non-zero', async () => {
    record(() => [
      {
        ...company(1, 'Acme'),
        kind: 'PRODUCT',
        listingCount: 0,
        applicationCount: 0,
        contacts: [{ id: 4 }, { id: 5 }]
      },
      { ...company(2, 'Fresh'), kind: null }
    ])
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies' })
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="companies-row"]')).toHaveLength(2))

    const [acme, fresh] = wrapper.findAll('[data-testid="companies-row"]')
    expect(acme!.get('[data-testid="companies-row-kind"]').text()).toBe('Product company')
    expect(acme!.get('[data-testid="companies-row-contacts"]').text()).toBe('2 contacts')
    expect(acme!.get('[data-testid="companies-row-listings"]').text()).toBe('0 listings')
    expect(acme!.find('[data-testid="companies-row-applications"]').exists()).toBe(false)
    expect(fresh!.get('[data-testid="companies-row-kind"]').text()).toBe('Not researched')
    expect(fresh!.get('[data-testid="companies-row-listings"]').text()).toBe('3 listings')
    wrapper.unmount()
  })

  it('keeps the selection across searches and hands the names to the add page', async () => {
    navigateTo.mockClear()
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { variables } = await readBody(event)
        const nodes = variables.search
          ? [company(3, 'Cegal')]
          : [company(1, 'Bekk'), company(2, 'Vipps')]
        return {
          data: {
            companies: {
              nodes,
              pageInfo: { hasNextPage: false, endCursor: null },
              totalCount: nodes.length
            }
          }
        }
      }
    })
    const wrapper = await mountSuspended(CompaniesPage)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="companies-row"]')).toHaveLength(2))
    expect(wrapper.find('[data-testid="companies-selection-bar"]').exists()).toBe(false)

    await wrapper.get('[data-testid="companies-row-select"]').trigger('click')
    expect(wrapper.get('[data-testid="companies-selection-bar"]').text()).toContain('1 selected')

    // The selected company is no longer listed, but is still counted.
    await wrapper.get('input[data-testid="companies-search"]').setValue('ceg')
    await vi.waitFor(
      () => expect(wrapper.get('[data-testid="companies-row-link"]').text()).toBe('Cegal'),
      { timeout: 2000 }
    )
    await wrapper.get('[data-testid="companies-row-select"]').trigger('click')
    expect(wrapper.get('[data-testid="companies-selection-bar"]').text()).toContain('2 selected')

    await wrapper.get('[data-testid="companies-research-selected"]').trigger('click')
    expect(navigateTo).toHaveBeenCalledWith('/companies/add')
    expect(useState<string[]>('companiesResearchNames').value).toEqual(['Bekk', 'Cegal'])
    wrapper.unmount()
  })

  it('selects every listed company at once and clears the selection', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          companies: {
            nodes: [company(1, 'Bekk'), company(2, 'Vipps')],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 2
          }
        }
      })
    })
    const wrapper = await mountSuspended(CompaniesPage)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="companies-row"]')).toHaveLength(2))

    await wrapper.get('[data-testid="companies-select-all"]').trigger('click')
    expect(wrapper.get('[data-testid="companies-selection-bar"]').text()).toContain('2 selected')

    await wrapper.get('[data-testid="companies-selection-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="companies-selection-bar"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
