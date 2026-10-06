import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
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
  })
})

describe('Dashboard editor', () => {
  const layout = layoutOf(['CLOSING_SOON', true], ['STALE_LISTINGS', true], ['PIPELINE', true])

  // jsdom can't do a real pointer drag, so emit what SortableJS would: the list in its new order.
  const moveFirstDown = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => {
    const list = wrapper.getComponent(VueDraggable)
    const [first, ...rest] = list.props('modelValue') as DashboardLayout
    list.vm.$emit('update:modelValue', [rest[0], first, ...rest.slice(1)])
    await nextTick()
  }

  it('saves the whole list in the edited order with the edited visibility', async () => {
    const inputs: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { variables } = await readBody(event)
        inputs.push(variables.input)
        return {
          data: { saveDashboardLayout: { layout: variables.input.widgets, errors: null } }
        }
      }
    })
    const wrapper = await mountSuspended(Editor, { props: { layout } })

    // Drag Closing soon below Stale listings, then hide Pipeline.
    await moveFirstDown(wrapper)
    await wrapper.findAll('[data-testid="dashboard-editor-shown"]')[2]!.trigger('click')
    await wrapper.get('[data-testid="dashboard-editor-save"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
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

  it('resets to the default order with everything shown, but only saves on Save', async () => {
    const inputs: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { variables } = await readBody(event)
        inputs.push(variables.input)
        return { data: { saveDashboardLayout: { layout: variables.input.widgets, errors: null } } }
      }
    })
    const wrapper = await mountSuspended(Editor, { props: { layout } })

    await wrapper.findAll('[data-testid="dashboard-editor-shown"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="dashboard-editor-reset"]').trigger('click')
    expect(inputs).toEqual([])

    await wrapper.get('[data-testid="dashboard-editor-save"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))

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

  it('saves nothing when reset is followed by Cancel', async () => {
    const wrapper = await mountSuspended(Editor, { props: { layout } })
    await wrapper.get('[data-testid="dashboard-editor-reset"]').trigger('click')
    await wrapper.get('[data-testid="dashboard-editor-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('discards the edits on cancel', async () => {
    const wrapper = await mountSuspended(Editor, { props: { layout } })
    await moveFirstDown(wrapper)
    await wrapper.get('[data-testid="dashboard-editor-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
    // The prop, which the page keeps, is untouched.
    expect(layout.map((w) => w.widget)).toEqual(['CLOSING_SOON', 'STALE_LISTINGS', 'PIPELINE'])
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
    const wrapper = await mountSuspended(Editor, { props: { layout } })
    await moveFirstDown(wrapper)
    await wrapper.get('[data-testid="dashboard-editor-save"]').trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="dashboard-editor-error"]').text()).toContain(
        'Widget missing'
      )
    )
    expect(wrapper.emitted('saved')).toBeUndefined()
    const rows = wrapper.findAll('[data-testid="dashboard-editor-row"]').map((r) => r.text())
    expect(rows[0]).toContain('Stale listings')
  })
})
