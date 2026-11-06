import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CvTemplatesPage from '~/pages/cv-templates/index.vue'
import { toTailoredCvInput } from '~/utils/tailoredCv'
import { tailoredCvFromProfile } from '../fixtures/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

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
let createReply: unknown

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query, variables } = body
    if (query.includes('query BaseCvs('))
      return { data: { baseCvs: variables.archived ? lists.archived : lists.active } }
    if (query.includes('query BaseCvFromProfile'))
      return {
        data: {
          baseCvFromProfile: toTailoredCvInput(
            tailoredCvFromProfile(cvProfile(), variables.language as 'NORWEGIAN')
          )
        }
      }
    if (query.includes('mutation CreateBaseCv')) return { data: { createBaseCv: createReply } }
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
  createReply = { baseCv: { id: 9 }, errors: null }
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
  const fillAndCreate = async (name: string) => {
    inBody('cv-templates-new')!.click()
    await flushPromises()
    const input = inBody<HTMLInputElement>('cv-template-name')!
    input.value = name
    input.dispatchEvent(new Event('input'))
    const norwegian = [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (el) => el.closest('[data-testid="cv-template-language"]') && el.id.endsWith('NORWEGIAN')
    )
    norwegian!.click()
    await flushPromises()
    input.closest('form')!.dispatchEvent(new Event('submit'))
  }

  it('starts from the profile in the chosen language and opens the editor', async () => {
    const wrapper = await mountPage()
    await fillAndCreate('Generic (NO)')

    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/cv-templates/9'))
    const fromProfile = calls.find((c) => c.query.includes('query BaseCvFromProfile'))!
    expect(fromProfile.variables.language).toBe('NORWEGIAN')
    const create = calls.find((c) => c.query.includes('mutation CreateBaseCv'))!
    expect(create.variables.input).toMatchObject({
      name: 'Generic (NO)',
      description: null,
      language: 'NORWEGIAN'
    })
    expect((create.variables.input!.content as { language: string }).language).toBe('NORWEGIAN')
    wrapper.unmount()
  })

  it('starting from an AI draft creates nothing yet and carries the answers to the draft page', async () => {
    const wrapper = await mountPage()
    inBody('cv-templates-new')!.click()
    await flushPromises()
    const input = inBody<HTMLInputElement>('cv-template-name')!
    input.value = 'Frontend (AI)'
    input.dispatchEvent(new Event('input'))
    const aiDraft = [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (el) => el.closest('[data-testid="cv-template-start-from"]') && el.id.endsWith('ai')
    )
    aiDraft!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Continue to AI draft')
    input.closest('form')!.dispatchEvent(new Event('submit'))

    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith({
        path: '/cv-templates/new',
        query: { name: 'Frontend (AI)', description: undefined, lang: 'en' }
      })
    )
    expect(calls.some((c) => c.query.includes('mutation CreateBaseCv'))).toBe(false)
    expect(calls.some((c) => c.query.includes('query BaseCvFromProfile'))).toBe(false)
    wrapper.unmount()
  })

  it('shows a taken name on the field with a link to that template', async () => {
    createReply = {
      baseCv: null,
      errors: [
        {
          __typename: 'DuplicateBaseCvError',
          message: 'A CV template with this name already exists.',
          existingBaseCvId: 1
        }
      ]
    }
    const wrapper = await mountPage()
    await fillAndCreate('frontend (en)')

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('A CV template with this name already exists.')
    )
    const link = [...document.body.querySelectorAll('a')].find(
      (a) => a.textContent === 'Open the existing template'
    )!
    expect(link.getAttribute('href')).toBe('/cv-templates/1')
    expect(navigateTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
