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

  it('filters avoided companies out server-side when Hide avoided is on', async () => {
    const queries: string[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        queries.push((await readBody(event)).query)
        return {
          data: {
            companies: {
              nodes: [company(1, 'Bekk')],
              pageInfo: { hasNextPage: false, endCursor: 'c1' },
              totalCount: 1
            }
          }
        }
      }
    })
    const wrapper = await mountSuspended(CompaniesPage, { route: '/companies' })
    await vi.waitFor(() => expect(queries).toHaveLength(1))
    expect(queries[0]).not.toMatch(/avoidedAt: \{/)

    await wrapper.get('[data-testid="companies-hide-avoided"]').trigger('click')

    await vi.waitFor(() => expect(queries.at(-1)).toMatch(/avoidedAt: \{\s*eq: null\s*\}/))
    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.query).toEqual({ hideAvoided: '1' })
    )
    expect(useCompaniesView().value).toBe('/companies?hideAvoided=1')
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
