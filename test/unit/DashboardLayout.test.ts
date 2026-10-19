import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import IndexPage from '~/pages/index.vue'
import { VueDraggable } from 'vue-draggable-plus'
import Editor from '~/components/dashboard/Editor.vue'
import type { DashboardLayout } from '~/composables/useDashboardLayout'

// useAsyncData caches by key across mounts in the same app, so each test starts from a clean cache.
beforeEach(() => clearNuxtData())

const layoutOf = (...entries: [DashboardLayout[number]['widget'], boolean][]): DashboardLayout =>
  entries.map(([widget, isShown]) => ({ widget, isShown }))

describe('Dashboard page', () => {
  it('shows the shown widgets in the saved order and never queries hidden ones', async () => {
    const queries: string[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        queries.push(query)
        if (query.includes('dashboardLayout')) {
          return {
            data: {
              dashboardLayout: layoutOf(
                ['TO_ANALYZE', true],
                ['OFFERS_TO_ANSWER', false],
                ['CLOSING_SOON', true]
              )
            }
          }
        }
        return { data: { listings: { items: [], totalCount: 0 } } }
      }
    })

    const wrapper = await mountSuspended(IndexPage)
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="dashboard-widget"]')).toHaveLength(2)
    )
    await vi.waitFor(() =>
      expect(queries.some((q) => q.includes('DashboardClosingSoon'))).toBe(true)
    )

    const titles = wrapper.findAll('[data-testid="dashboard-widget"] h3').map((h) => h.text())
    expect(titles).toEqual(['To analyze', 'Closing soon'])
    expect(queries.some((q) => q.includes('DashboardOffers'))).toBe(false)
  })

  it('says so, with an edit action, when every widget is hidden', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { dashboardLayout: layoutOf(['CLOSING_SOON', false]) } })
    })

    const wrapper = await mountSuspended(IndexPage)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="dashboard-empty"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="dashboard-widget"]').exists()).toBe(false)
  })

  it('shows an error instead of widgets when the layout fails to load', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ errors: [{ message: 'boom' }] })
    })

    const wrapper = await mountSuspended(IndexPage)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="dashboard-layout-error"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="dashboard-widget"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="dashboard-edit"]').attributes('disabled')).toBeDefined()
  })

  it('shows a healthy API as a badge, without a warning', async () => {
    registerEndpoint('/api/health', () => 'Healthy')
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { dashboardLayout: [] } })
    })

    const wrapper = await mountSuspended(IndexPage)
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="api-health"]').text()).toBe('API healthy')
    )
    expect(wrapper.find('[data-testid="api-health-alert"]').exists()).toBe(false)
  })

  it('warns above the widgets when the API is up but its database is down', async () => {
    registerEndpoint('/api/health', () => {
      throw createError({ statusCode: 503 })
    })
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { dashboardLayout: [] } })
    })

    const wrapper = await mountSuspended(IndexPage)
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="api-health"]').text()).toBe('Database down')
    )
    expect(wrapper.get('[data-testid="api-health-alert"]').text()).toContain('database')
  })
})

describe('Dashboard editor', () => {
  const layout = layoutOf(['CLOSING_SOON', true], ['STALE_LISTINGS', true], ['PIPELINE', true])

  // The editor is a slideover, teleported out of the wrapper, so its DOM is read from the body.
  let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
  afterEach(() => wrapper?.unmount())
  const mountEditor = async () => {
    wrapper = await mountSuspended(Editor, {
      props: { layout, open: true },
      attachTo: document.body
    })
    await vi.waitFor(() => expect(all('dashboard-editor-row')).toHaveLength(3))
    return wrapper
  }
  const all = (testid: string) => [
    ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)
  ]
  const one = (testid: string) => all(testid)[0]!
  const click = async (el: HTMLElement) => {
    el.click()
    await nextTick()
  }
  const rowNames = () => all('dashboard-editor-row').map((r) => r.textContent!.trim())

  const recordSaves = () => {
    const inputs: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { variables } = await readBody(event)
        inputs.push(variables.input)
        return { data: { saveDashboardLayout: { layout: variables.input.widgets, errors: null } } }
      }
    })
    return inputs
  }

  // jsdom can't do a real pointer drag, so emit what SortableJS would: the list in its new order.
  const dragFirstDown = async () => {
    const list = wrapper!.getComponent(VueDraggable)
    const [first, ...rest] = list.props('modelValue') as DashboardLayout
    list.vm.$emit('update:modelValue', [rest[0], first, ...rest.slice(1)])
    await nextTick()
  }

  it('saves the whole list in the edited order with the edited visibility', async () => {
    const inputs = recordSaves()
    await mountEditor()

    // Drag Closing soon below Stale listings, then hide Pipeline.
    await dragFirstDown()
    await click(all('dashboard-editor-shown')[2]!)
    await click(one('dashboard-editor-save'))

    await vi.waitFor(() => expect(wrapper!.emitted('saved')).toHaveLength(1))
    expect(inputs).toEqual([
      {
        widgets: [
          { widget: 'STALE_LISTINGS', isShown: true },
          { widget: 'CLOSING_SOON', isShown: true },
          { widget: 'PIPELINE', isShown: false }
        ]
      }
    ])
  })

  it('reorders with the arrow buttons, which stop at the ends', async () => {
    await mountEditor()
    expect(all('dashboard-editor-up')[0]!.hasAttribute('disabled')).toBe(true)
    expect(all('dashboard-editor-down')[2]!.hasAttribute('disabled')).toBe(true)

    await click(all('dashboard-editor-down')[0]!)
    expect(rowNames()).toEqual(['Stale listings', 'Closing soon', 'Pipeline'])
    await click(all('dashboard-editor-up')[2]!)
    expect(rowNames()).toEqual(['Stale listings', 'Pipeline', 'Closing soon'])
  })

  it('keeps Save off until something changes', async () => {
    await mountEditor()
    expect(one('dashboard-editor-save').hasAttribute('disabled')).toBe(true)

    await click(all('dashboard-editor-shown')[0]!)
    expect(one('dashboard-editor-save').hasAttribute('disabled')).toBe(false)
  })

  it('resets to the default order with everything shown, but only saves on Save', async () => {
    const inputs = recordSaves()
    await mountEditor()

    await click(all('dashboard-editor-shown')[0]!)
    await click(one('dashboard-editor-reset'))
    expect(inputs).toEqual([])

    await click(one('dashboard-editor-save'))
    await vi.waitFor(() => expect(wrapper!.emitted('saved')).toHaveLength(1))

    const saved = (inputs[0] as { widgets: { widget: string; isShown: boolean }[] }).widgets
    expect(saved.map((w) => w.widget)).toEqual([
      'CLOSING_SOON',
      'UPCOMING_INTERVIEWS',
      'OFFERS_TO_ANSWER',
      'STALE_LISTINGS',
      'PIPELINE',
      'APPLIED_THIS_WEEK',
      'TO_ANALYZE',
      'FAVORITED_LISTINGS',
      'FAVORITED_COMPANIES',
      'LLM_USAGE'
    ])
    expect(saved.every((w) => w.isShown)).toBe(true)
  })

  it('closes without saving and starts from the saved layout when reopened', async () => {
    const inputs = recordSaves()
    await mountEditor()
    await dragFirstDown()
    await click(one('dashboard-editor-cancel'))

    expect(wrapper!.emitted('update:open')).toEqual([[false]])
    expect(inputs).toEqual([])
    // The prop, which the page keeps, is untouched.
    expect(layout.map((w) => w.widget)).toEqual(['CLOSING_SOON', 'STALE_LISTINGS', 'PIPELINE'])

    await wrapper!.setProps({ open: false })
    await wrapper!.setProps({ open: true })
    await vi.waitFor(() =>
      expect(rowNames()).toEqual(['Closing soon', 'Stale listings', 'Pipeline'])
    )
  })

  it('shows the API message and keeps the edits when the save is rejected', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          saveDashboardLayout: {
            layout: null,
            errors: [{ __typename: 'InvalidDashboardLayoutError', message: 'Widget missing' }]
          }
        }
      })
    })
    await mountEditor()
    await dragFirstDown()
    await click(one('dashboard-editor-save'))

    await vi.waitFor(() =>
      expect(one('dashboard-editor-error')?.textContent).toContain('Widget missing')
    )
    expect(wrapper!.emitted('saved')).toBeUndefined()
    expect(rowNames()[0]).toBe('Stale listings')
  })
})
