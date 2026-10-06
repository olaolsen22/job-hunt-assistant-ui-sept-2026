import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CompaniesPage from '~/pages/companies/index.vue'

const company = (id: number, name: string) => ({
  id,
  name,
  listingCount: 3,
  applicationCount: 1,
  industry: { name: 'Consulting' },
  locations: [{ location: { city: 'Oslo', countryCode: 'NO' } }]
})

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
              nodes: [company(1, 'Bekk'), company(2, 'Vipps')],
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

    await wrapper.getComponent('[data-testid="companies-pagination"]').vm.$emit('update:page', 2)
    await flushPromises()

    expect(afters).toEqual([null, 'c2'])
  })
})
