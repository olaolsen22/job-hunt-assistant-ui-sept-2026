import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ListingsPage from '~/pages/listings/index.vue'

const { size } = vi.hoisted(() => ({ size: { width: { value: 1200 } } }))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useElementSize: () => size
}))

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: () => ({ data: { listings: { items: [], totalCount: 0 } } })
})

describe('Listings desktop columns', () => {
  beforeEach(() => {
    size.width = ref(1200)
  })

  it('switches between rows and table using the space left for results', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          listings: {
            items: [{ id: 7, title: 'Frontend Developer' }],
            totalCount: 1
          }
        }
      })
    })
    const wrapper = await mountSuspended(ListingsPage, {
      route: '/listings',
      global: { stubs: { ListingsTable: true, ListingsRow: true } }
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ListingsTable' }).exists()).toBe(true)

    // Desktop results stay tabular even with only 872px after both sidebars.
    size.width.value = 872
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ListingsTable' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ListingsRow' }).exists()).toBe(false)

    size.width.value = 767
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ListingsTable' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ListingsRow' }).exists()).toBe(true)

    size.width.value = 768
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ListingsTable' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ListingsRow' }).exists()).toBe(false)
    wrapper.unmount()
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { listings: { items: [], totalCount: 0 } } })
    })
  })

  it('keeps search tools alongside results even when a search has no matches', async () => {
    const wrapper = await mountSuspended(ListingsPage, { route: '/listings?search=frontend' })
    await flushPromises()
    const tools = wrapper.get('[data-testid="listings-tools"]')
    const results = wrapper.get('[data-testid="listings-results"]')
    expect(wrapper.get('[data-testid="listings-columns"]').classes()).toContain(
      '2xl:grid-cols-[24rem_minmax(0,1fr)]'
    )
    expect(tools.find('input').exists()).toBe(true)
    expect(tools.find('[data-testid="listings-sort"]').exists()).toBe(true)
    expect(results.find('[data-testid="listings-empty"]').exists()).toBe(true)
    expect(results.find('[data-testid="listings-empty-clear"]').exists()).toBe(true)
    expect(results.find('[data-testid="listings-sort"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
