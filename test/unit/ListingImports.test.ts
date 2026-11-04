import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ImportsPage from '~/pages/listings/imports.vue'

// Mounting at a route runs the auth middleware.
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const item = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  fileName: `2026-11-0${id}-it.json`,
  kind: 'it',
  generatedAt: `2026-11-0${id}T08:30:00Z`,
  itemCount: 12,
  error: null,
  reviewedAt: null,
  ...extra
})

// The list answers by `isReviewed`; every request is kept to check what was asked.
const mockApi = (pages: { nodes: unknown[]; hasNextPage?: boolean }[]) => {
  const requests = { lists: [] as Record<string, unknown>[], reviewed: [] as unknown[] }
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      if (query.includes('query ListingImports')) {
        requests.lists.push(variables)
        const page = pages[variables.after ? 1 : 0]!
        return {
          data: {
            listingImports: {
              nodes: page.nodes,
              pageInfo: { hasNextPage: !!page.hasNextPage, endCursor: 'c1' },
              totalCount: pages.reduce((n, p) => n + p.nodes.length, 0)
            }
          }
        }
      }
      if (query.includes('SetListingImportReviewed')) {
        requests.reviewed.push(variables)
        return {
          data: {
            setListingImportReviewed: {
              listingImport: { id: variables.id, reviewedAt: null },
              errors: null
            }
          }
        }
      }
      if (query.includes('PendingListingImportCount'))
        return { data: { pendingListingImportCount: pages[0]!.nodes.length } }
      return { data: {} }
    }
  })
  return requests
}

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

const mountPage = async (route = '/listings/imports') => {
  wrapper = await mountSuspended(ImportsPage, { route })
  await flushPromises()
  return wrapper
}

describe('Job imports', () => {
  it('lists pending imports with a way into quick add, and errors without one', async () => {
    const requests = mockApi([
      { nodes: [item(2), item(1, { error: 'Not a JSON array', itemCount: 0 })] }
    ])
    const w = await mountPage()
    expect(requests.lists[0]).toMatchObject({ isReviewed: false })
    await vi.waitFor(() =>
      expect(w.get('[data-testid="imports-tabs"]').text()).toContain('To review2')
    )
    const rows = w.findAll('[data-testid="imports-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('12 jobs')
    expect(rows[0]!.get('[data-testid="imports-row-open"]').attributes('href')).toBe(
      '/listings/quick-add?import=2'
    )
    expect(rows[1]!.get('[data-testid="imports-row-error"]').text()).toContain('Not a JSON array')
    expect(rows[1]!.find('[data-testid="imports-row-open"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-testid="imports-row-toggle"]').exists()).toBe(true)
  })

  it('marks an import reviewed and reloads the list', async () => {
    const requests = mockApi([{ nodes: [item(1)] }])
    const w = await mountPage()
    await w.get('[data-testid="imports-row-toggle"]').trigger('click')
    await vi.waitFor(() => expect(requests.lists).toHaveLength(2))
    expect(requests.reviewed).toEqual([{ id: 1, isReviewed: true }])
  })

  it('shows every import under All and loads further pages on request', async () => {
    const requests = mockApi([
      { nodes: [item(3, { reviewedAt: '2026-11-03T09:00:00Z' })], hasNextPage: true },
      { nodes: [item(2)] }
    ])
    const w = await mountPage('/listings/imports?view=all')
    expect(requests.lists[0]).toMatchObject({ isReviewed: null })
    expect(w.get('[data-testid="imports-row-reviewed"]').text()).toBe('Reviewed')
    expect(w.get('[data-testid="imports-row-toggle"]').text()).toBe('Mark unreviewed')
    await w.get('[data-testid="imports-load-more"]').trigger('click')
    await vi.waitFor(() => expect(w.findAll('[data-testid="imports-row"]')).toHaveLength(2))
    expect(requests.lists[1]).toMatchObject({ isReviewed: null, after: 'c1' })
    expect(w.find('[data-testid="imports-load-more"]').exists()).toBe(false)
  })

  it('says when nothing is left to review', async () => {
    mockApi([{ nodes: [] }])
    const w = await mountPage()
    expect(w.get('[data-testid="imports-empty"]').text()).toContain('Nothing to review')
  })
})
