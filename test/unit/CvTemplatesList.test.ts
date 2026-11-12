import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CvTemplatesPage from '~/pages/cv-templates/index.vue'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)

type Body = {
  query: string
  variables: Record<string, unknown> & { input?: Record<string, unknown> }
}

const row = (id: number, name: string, archivedAt: string | null = null) => ({
  id,
  name,
  description: `${name} description`,
  languages: ['ENGLISH', 'NORWEGIAN'],
  archivedAt,
  updatedAt: new Date().toISOString(),
  versions: [
    {
      id: id * 10 + 5,
      language: 'NORWEGIAN',
      number: 1,
      note: null,
      createdAt: '2026-11-01T10:00:00Z'
    },
    {
      id: id * 10 + 2,
      language: 'ENGLISH',
      number: 2,
      note: null,
      createdAt: '2026-10-30T10:00:00Z'
    }
  ]
})

let calls: Body[]
let lists: { active: unknown[]; archived: unknown[] }
let deleteReply: unknown

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query, variables } = body
    if (query.includes('query BaseCvs('))
      return { data: { baseCvs: variables.archived ? lists.archived : lists.active } }
    if (query.includes('mutation DeleteBaseCv')) return { data: { deleteBaseCv: deleteReply } }
    if (query.includes('mutation SetBaseCvArchived'))
      return { data: { setBaseCvArchived: { baseCv: { id: 1 }, errors: null } } }
    return { data: {} }
  }
})

beforeEach(() => {
  clearNuxtData()
  navigateTo.mockClear()
  calls = []
  lists = { active: [row(1, 'Frontend (EN)'), row(2, 'Generic (NO)')], archived: [] }
  deleteReply = { errors: null }
})

const inBody = <T extends HTMLElement = HTMLElement>(testid: string) =>
  document.body.querySelector<T>(`[data-testid="${testid}"]`)

const mountPage = async (route = '/cv-templates') => {
  const wrapper = await mountSuspended(CvTemplatesPage, { route, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const menuItem = async (label: string) => {
  await vi.waitFor(() =>
    expect([...document.body.querySelectorAll('[role="menuitem"]')].length).toBeGreaterThan(0)
  )
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
    el.textContent?.includes(label)
  )!
  item.click()
  await flushPromises()
}

const openMenu = async (wrapper: Awaited<ReturnType<typeof mountPage>>, index: number) => {
  const trigger = wrapper.findAll('[data-testid="cv-templates-row-menu"]')[index]!
  // From the keyboard, like the tailored CV page's test: Reka opens on pointerdown, not click.
  trigger.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await flushPromises()
}

describe('CV templates list', () => {
  it('lists active templates with each language’s latest version', async () => {
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="cv-templates-row"]')).toHaveLength(2)
    )

    const first = wrapper.findAll('[data-testid="cv-templates-row"]')[0]!
    expect(first.text()).toContain('Frontend (EN)')
    expect(first.findAll('[data-testid="cv-templates-row-language"]').map((b) => b.text())).toEqual(
      ['EN v2', 'NO v1']
    )
    expect(first.text()).toContain('updated today')
    expect(first.get('[data-testid="cv-templates-row-link"]').attributes('href')).toBe(
      '/cv-templates/1'
    )
    wrapper.unmount()
  })

  it('shows archived templates on their own tab, opened from the URL', async () => {
    lists.archived = [row(3, 'Old (EN)', '2026-10-01T10:00:00Z')]
    const wrapper = await mountPage('/cv-templates?archived=1')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Old (EN)'))

    expect(calls.find((c) => c.query.includes('query BaseCvs('))!.variables.archived).toBe(true)
    expect(wrapper.text()).not.toContain('Frontend (EN)')
    wrapper.unmount()
  })

  it('shows an empty state that starts a new template', async () => {
    lists.active = []
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-templates-empty"]').exists()).toBe(true)
    )

    expect(wrapper.get('[data-testid="cv-templates-empty"]').text()).toContain(
      'No CV templates yet'
    )
    wrapper.unmount()
  })

  it('offers archiving when a template was already used for an application', async () => {
    deleteReply = {
      errors: [{ __typename: 'BaseCvInUseError', message: 'Used by a document.' }]
    }
    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="cv-templates-row"]')).toHaveLength(2)
    )

    await openMenu(wrapper, 0)
    await menuItem('Delete')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Delete Frontend (EN)?'))
    inBody('confirm-modal-confirm')!.click()

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Archive Frontend (EN) instead?')
    )
    inBody('confirm-modal-confirm')!.click()
    await vi.waitFor(() =>
      expect(
        calls.find((c) => c.query.includes('mutation SetBaseCvArchived'))?.variables.input
      ).toEqual({ id: 1, isArchived: true })
    )
    wrapper.unmount()
  })
})

describe('New CV template', () => {
  it('goes straight to the create page, with no dialog and nothing created', async () => {
    const wrapper = await mountPage()
    expect(inBody('cv-templates-new')!.getAttribute('href')).toBe('/cv-templates/new')
    expect(inBody('cv-template-name')).toBeNull()

    wrapper.unmount()
    clearNuxtData()
    lists.active = []
    const empty = await mountPage()
    await vi.waitFor(() => expect(inBody('cv-templates-empty')).not.toBeNull())
    const start = [...inBody('cv-templates-empty')!.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('New CV template')
    )!
    expect(start.getAttribute('href')).toBe('/cv-templates/new')
    expect(calls.some((c) => c.query.includes('mutation CreateBaseCv'))).toBe(false)
    empty.unmount()
  })
})
