import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import Stale from '~/components/dashboard/Stale.vue'
import Interviews from '~/components/dashboard/Interviews.vue'
import FavoriteCompanies from '~/components/dashboard/FavoriteCompanies.vue'

// useAsyncData caches by key across mounts in the same app, so each test starts from a clean cache.
beforeEach(() => clearNuxtData())

const respond = (handler: (query: string, variables: Record<string, unknown>) => unknown) =>
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      return handler(query, variables ?? {})
    }
  })

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('sv-SE')
}

describe('Stale widget', () => {
  it('asks for Saved listings posted 14-45 days ago, without the expiry clause, and shows their age', async () => {
    let seen: { query: string; variables: Record<string, unknown> } | undefined
    respond((query, variables) => {
      seen = { query, variables }
      return {
        data: {
          listings: {
            items: [
              { id: 1, title: 'Frontend dev', postedOn: daysAgo(30), company: { name: 'Bekk' } }
            ],
            totalCount: 1
          }
        }
      }
    })

    const wrapper = await mountSuspended(Stale)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="dashboard-row"]')).toHaveLength(1))

    expect(wrapper.text()).toContain('30 days old')
    expect(seen!.variables).toEqual({ from: daysAgo(45), to: daysAgo(14) })
    expect(seen!.query).toContain('SAVED')
    expect(seen!.query).not.toContain('deadlineOn')
  })

  it('shows its own error with a retry when the request fails', async () => {
    respond(() => ({ errors: [{ message: 'boom' }] }))
    const wrapper = await mountSuspended(Stale)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="dashboard-widget-error"]').exists()).toBe(true)
    )
  })

  it('shows the empty message when nothing is stale', async () => {
    respond(() => ({ data: { listings: { items: [], totalCount: 0 } } }))
    const wrapper = await mountSuspended(Stale)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="dashboard-widget-empty"]').exists()).toBe(true)
    )
  })
})

describe('Interviews widget', () => {
  it('lists future interviews soonest first across listings and drops past ones', async () => {
    const day = 86_400_000
    const at = (offset: number) => new Date(Date.now() + offset * day).toISOString()
    respond(() => ({
      data: {
        listings: {
          items: [
            {
              id: 1,
              title: 'Later',
              company: { name: 'A' },
              interviews: [{ id: 10, scheduledAt: at(5) }]
            },
            {
              id: 2,
              title: 'Sooner',
              company: { name: 'B' },
              interviews: [
                { id: 20, scheduledAt: at(-1) },
                { id: 21, scheduledAt: at(1) }
              ]
            }
          ]
        }
      }
    }))

    const wrapper = await mountSuspended(Interviews)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="dashboard-row"]')).toHaveLength(2))

    const titles = wrapper
      .findAll('[data-testid="dashboard-row"] p.font-medium')
      .map((p) => p.text())
    expect(titles).toEqual(['Sooner', 'Later'])
  })
})

describe('Favorited companies widget', () => {
  it('groups the open listings under their company with one listings request', async () => {
    const queries: string[] = []
    respond((query, variables) => {
      queries.push(query)
      if (query.includes('companies(')) {
        return {
          data: {
            companies: {
              nodes: [
                { id: 1, name: 'Bekk' },
                { id: 2, name: 'Vipps' }
              ],
              totalCount: 2
            }
          }
        }
      }
      expect((variables as { ids: number[] }).ids).toEqual([1, 2])
      return {
        data: {
          listings: {
            items: [
              { id: 11, title: 'Dev', companyId: 1, dueOn: daysAgo(-3) },
              { id: 12, title: 'Lead', companyId: 1, dueOn: daysAgo(-5) }
            ]
          }
        }
      }
    })

    const wrapper = await mountSuspended(FavoriteCompanies)
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="dashboard-company"]')).toHaveLength(2)
    )

    const [bekk, vipps] = wrapper.findAll('[data-testid="dashboard-company"]')
    expect(bekk!.findAll('[data-testid="dashboard-row"]')).toHaveLength(2)
    expect(bekk!.text()).toContain('2 open')
    expect(vipps!.text()).toContain('No open listings')
    expect(queries).toHaveLength(2)
  })
})
