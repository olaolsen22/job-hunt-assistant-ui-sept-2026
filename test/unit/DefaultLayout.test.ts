import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import DefaultLayout from '~/layouts/default.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: () => ({ data: { pendingListingImportCount: 3 } })
})

// A one-finger swipe from (x1, y) to (x2, y), as the browser reports it.
const swipe = (target: EventTarget, x1: number, x2: number, y = 300) => {
  const fire = (type: string, x: number) => {
    const event = new Event(type, { bubbles: true })
    Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: y }] })
    target.dispatchEvent(event)
  }
  fire('touchstart', x1)
  fire('touchmove', (x1 + x2) / 2)
  fire('touchmove', x2)
  fire('touchend', x2)
}

const mountLayout = async (slot = '<p data-testid="page">Page</p>', route = '/') => {
  const wrapper = await mountSuspended(DefaultLayout, {
    route,
    slots: { default: () => h('div', { innerHTML: slot }) },
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

describe('Opening the phone menu by swiping', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 400)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens after a swipe right across 30% of the screen', async () => {
    const wrapper = await mountLayout()

    swipe(wrapper.get('[data-testid="page"]').element, 60, 280)

    expect(wrapper.vm.sidebarOpen).toBe(true)
    wrapper.unmount()
  })

  it('ignores short swipes, swipes from the back-gesture edge and sideways scrollers', async () => {
    const wrapper = await mountLayout(
      '<p data-testid="page">Page</p><div data-testid="scroller" style="overflow-x: auto"></div>'
    )
    const page = wrapper.get('[data-testid="page"]').element
    const scroller = wrapper.get<HTMLElement>('[data-testid="scroller"]').element
    Object.defineProperty(scroller, 'scrollWidth', { value: 800 })
    Object.defineProperty(scroller, 'clientWidth', { value: 400 })

    swipe(page, 60, 150)
    swipe(page, 10, 300)
    swipe(scroller, 60, 300)

    expect(wrapper.vm.sidebarOpen).toBe(false)
    wrapper.unmount()
  })

  it('closes the open menu with a swipe left across 30% of the screen', async () => {
    const wrapper = await mountLayout()
    const page = wrapper.get('[data-testid="page"]').element
    swipe(page, 60, 280)

    swipe(document.body, 300, 220)
    expect(wrapper.vm.sidebarOpen).toBe(true)
    swipe(document.body, 300, 160)
    expect(wrapper.vm.sidebarOpen).toBe(false)
    wrapper.unmount()
  })
})

describe('Pending job imports', () => {
  it('badges the sidebar entry with the pending count', async () => {
    const wrapper = await mountLayout(undefined, '/listings')
    const link = wrapper.get('a[href="/listings/imports"]')
    expect(link.text()).toContain('Job imports')
    expect(link.text()).toContain('3')
    wrapper.unmount()
  })

  it('also says so on the dashboard, with a link to the imports', async () => {
    const wrapper = await mountLayout()
    const notice = wrapper.get('[data-testid="imports-notice"]')
    expect(notice.text()).toContain('3 job imports to review')
    expect(notice.get('a').attributes('href')).toBe('/listings/imports')
    wrapper.unmount()
  })

  it('keeps the notice off other pages', async () => {
    const wrapper = await mountLayout(undefined, '/listings')
    expect(wrapper.find('[data-testid="imports-notice"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
