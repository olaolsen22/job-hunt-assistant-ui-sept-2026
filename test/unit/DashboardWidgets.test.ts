import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import Stale from '~/components/dashboard/Stale.vue'
import Interviews from '~/components/dashboard/Interviews.vue'
import FavoriteCompanies from '~/components/dashboard/FavoriteCompanies.vue'
import ClosingSoon from '~/components/dashboard/ClosingSoon.vue'
import FollowUps from '~/components/dashboard/FollowUps.vue'

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

describe('Closing soon widget', () => {
  it('says how soon the next two days are and shows later deadlines as dates', async () => {
    const listing = (id: number, inDays: number) => ({
      id,
      title: `Job ${id}`,
      dueOn: daysAgo(-inDays),
      company: { name: 'Bekk' }
    })
    respond(() => ({
      data: {
        listings: {
          items: [listing(1, 0), listing(2, 1), listing(3, 2), listing(4, 5)],
          totalCount: 4
        }
      }
    }))

    const wrapper = await mountSuspended(ClosingSoon)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="dashboard-due"]')).toHaveLength(4))

    const labels = wrapper.findAll('[data-testid="dashboard-due"]').map((b) => b.text())
    expect(labels.slice(0, 3)).toEqual(['Today', 'Tomorrow', 'In 2 days'])
    expect(labels[3]).toBe(formatDate(daysAgo(-5)))
  })
})

describe('Favorited companies links', () => {
  it('links the company and the listings beyond the first three to that company', async () => {
    respond((query) =>
      query.includes('companies(')
        ? { data: { companies: { nodes: [{ id: 7, name: 'Bekk' }], totalCount: 1 } } }
        : {
            data: {
              listings: {
                items: [1, 2, 3, 4, 5].map((id) => ({
                  id,
                  title: `Job ${id}`,
                  companyId: 7,
                  dueOn: daysAgo(-3)
                }))
              }
            }
          }
    )

    const wrapper = await mountSuspended(FavoriteCompanies)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="dashboard-company-more"]').exists()).toBe(true)
    )
    const more = wrapper.get('[data-testid="dashboard-company-more"]')
    expect(more.text()).toBe('+2 more')
    expect(more.attributes('href')).toBe('/listings?company=7')
    expect(wrapper.get('a[href="/companies/7"]').text()).toBe('Bekk')
  })
})

describe('Follow-ups widget', () => {
  it('asks for follow-ups due by today and links each person with how late it is', async () => {
    let seen: { query: string; variables: Record<string, unknown> } | undefined
    respond((query, variables) => {
      seen = { query, variables }
      return {
        data: {
          contacts: {
            nodes: [
              { id: 7, name: 'Kari Nordmann', followUpOn: daysAgo(3), company: { name: 'Acme' } },
              { id: 8, name: 'Ola Hansen', followUpOn: daysAgo(0), company: { name: 'Bekk' } }
            ],
            totalCount: 6
          }
        }
      }
    })

    const wrapper = await mountSuspended(FollowUps)
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="dashboard-row"]')).toHaveLength(2))

    const rows = wrapper.findAll('[data-testid="dashboard-row"]')
    expect(rows[0]!.attributes('href')).toBe('/contacts/7')
    expect(rows[0]!.text()).toContain('Overdue 3 d')
    expect(rows[1]!.text()).toContain('Due today')
    expect(wrapper.get('[data-testid="dashboard-widget-total"]').text()).toBe('6')
    expect(seen!.variables).toEqual({ today: daysAgo(0) })
    expect(seen!.query).toMatch(/followUpOn: \{\s*lte: \$today/)
  })

  it('says when nothing is due', async () => {
    respond(() => ({ data: { contacts: { nodes: [], totalCount: 0 } } }))
    const wrapper = await mountSuspended(FollowUps)
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="dashboard-widget-empty"]').text()).toBe(
        'No follow-ups due.'
      )
    )
  })
})
