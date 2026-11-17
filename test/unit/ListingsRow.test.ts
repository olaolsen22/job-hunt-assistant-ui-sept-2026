import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import Row from '~/components/listings/Row.vue'
import type { ListingListItem } from '~/composables/useListingsList'

const { refreshNuxtData } = vi.hoisted(() => ({ refreshNuxtData: vi.fn() }))
mockNuxtImport('refreshNuxtData', () => refreshNuxtData)

const listing = (overrides: Partial<ListingListItem> = {}): ListingListItem => ({
  id: 7,
  title: 'Frontend Developer',
  company: { name: 'Acme', avoidedAt: null },
  locations: [
    { location: { city: 'Oslo', countryCode: 'NO' } },
    { location: { city: 'Bergen', countryCode: 'NO' } }
  ],
  postedOn: '2026-10-01',
  deadlineType: 'DATE',
  deadlineOn: '2026-12-01',
  dueOn: '2026-12-01',
  url: 'https://example.com/ad',
  favoritedAt: null,
  shortlistedAt: null,
  archivedAt: null,
  analyzedAt: '2026-10-02T10:00:00Z',
  status: 'SAVED',
  jobRole: { name: 'Developer' },
  seniority: 'SENIOR',
  ...overrides
})

describe('ListingsRow', () => {
  it('links the title to the listing and the ad externally', async () => {
    const wrapper = await mountSuspended(Row, { props: { listing: listing() } })
    expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
      'false'
    )
    expect(wrapper.get('h3 a').attributes('href')).toBe('/listings/7')
    const ad = wrapper.get('[data-testid="listing-view-ad"]')
    expect(ad.attributes('href')).toBe('https://example.com/ad')
    expect(ad.attributes('target')).toBe('_blank')
    expect(ad.attributes('aria-label')).toBe('View ad for Frontend Developer')
  })

  it('shows the first location with a count of the rest, and the seniority', async () => {
    const wrapper = await mountSuspended(Row, { props: { listing: listing() } })
    expect(wrapper.get('[data-testid="listing-location"]').text()).toMatch(/^Oslo, .+\s+\+1$/)
    expect(wrapper.text()).toContain('Senior')
  })

  it('flags an unanalyzed listing and leaves out a missing seniority', async () => {
    const wrapper = await mountSuspended(Row, {
      props: { listing: listing({ analyzedAt: null, seniority: null, locations: [] }) }
    })
    expect(wrapper.get('[data-testid="listing-analyzed"]').text()).toBe('To analyze')
    expect(wrapper.text()).not.toContain('Senior')
    expect(wrapper.get('[data-testid="listing-location"]').text()).toBe('Location not specified')
  })

  it('archives from the row and asks the list to refresh', async () => {
    const inputs: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        inputs.push((await readBody(event)).variables.input)
        return {
          data: {
            setListingArchived: {
              listing: { id: 7, archivedAt: '2026-10-15T10:00:00Z' },
              errors: null
            }
          }
        }
      }
    })
    const wrapper = await mountSuspended(Row, { props: { listing: listing() } })
    const button = wrapper.get('[data-testid="listing-archive"]')
    expect(button.attributes('aria-label')).toBe('Archive Frontend Developer')

    await button.trigger('click')

    await vi.waitFor(() => expect(inputs).toEqual([{ id: 7, isArchived: true }]))
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
  })

  it('offers Undo after archiving, but not again after that Undo', async () => {
    useToast().clear()
    const inputs: { isArchived: boolean }[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const input = (await readBody(event)).variables.input
        inputs.push(input)
        const archivedAt = input.isArchived ? '2026-10-15T10:00:00Z' : null
        return { data: { setListingArchived: { listing: { id: 7, archivedAt }, errors: null } } }
      }
    })
    const wrapper = await mountSuspended(Row, { props: { listing: listing() } })
    await wrapper.get('[data-testid="listing-archive"]').trigger('click')

    const { toasts } = useToast()
    await vi.waitFor(() => expect(toasts.value.at(-1)?.title).toBe('Archived Frontend Developer'))
    const undo = toasts.value.at(-1)!.actions!
    expect(undo.map((a) => a.label)).toEqual(['Undo'])
    // The refreshed list no longer has the row, so Undo must work without it.
    wrapper.unmount()
    undo[0]!.onClick!(new MouseEvent('click'))

    await vi.waitFor(() => expect(toasts.value.at(-1)?.title).toBe('Unarchived Frontend Developer'))
    expect(inputs.map((i) => i.isArchived)).toEqual([true, false])
    expect(toasts.value.at(-1)!.actions).toBeUndefined()
    await vi.waitFor(() => expect(refreshNuxtData).toHaveBeenCalledWith('listings'))
  })

  it('offers Unarchive on an archived listing', async () => {
    const wrapper = await mountSuspended(Row, {
      props: { listing: listing({ archivedAt: '2026-10-10T10:00:00Z' }) }
    })
    expect(wrapper.get('[data-testid="listing-archive"]').attributes('aria-label')).toBe(
      'Unarchive Frontend Developer'
    )
  })
})
