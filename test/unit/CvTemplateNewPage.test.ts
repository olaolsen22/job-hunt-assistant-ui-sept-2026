import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import NewTemplatePage from '~/pages/cv-templates/new.vue'
import { toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'
import { tailoredCvFromProfile } from '../fixtures/tailoredCv'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)

type Body = {
  query: string
  variables: { input?: Record<string, unknown>; language?: string }
}
let calls: Body[] = []
let createReply: unknown

const content = (summary: string) =>
  toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), summary })

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    if (body.query.includes('query BaseCvFromProfile'))
      return {
        data: {
          baseCvFromProfile: {
            ...content('From profile'),
            language: (body.variables as { language?: string }).language ?? 'ENGLISH'
          }
        }
      }
    if (body.query.includes('query BaseCvExternalPrompt'))
      return { data: { baseCvExternalPrompt: { instructions: 'Draft a CV' } } }
    if (body.query.includes('mutation PreviewBaseCv'))
      return {
        data: {
          previewBaseCv: { candidate: { content: content('From the AI') }, errors: null }
        }
      }
    if (body.query.includes('mutation CreateBaseCv')) return { data: { createBaseCv: createReply } }
    return { data: { skillCategories: { nodes: [] } } }
  }
})

const inBody = <T extends HTMLElement = HTMLElement>(testid: string) =>
  document.body.querySelector<T>(`[data-testid="${testid}"]`)
const type = async (testid: string, value: string) => {
  const input = inBody<HTMLInputElement | HTMLTextAreaElement>(testid)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}
const mountPage = () =>
  mountSuspended(NewTemplatePage, { route: '/cv-templates/new', attachTo: document.body })

const created = () => calls.filter((c) => c.query.includes('mutation CreateBaseCv'))
const fromProfile = () => calls.filter((c) => c.query.includes('query BaseCvFromProfile('))

const startFromProfile = async () => {
  await vi.waitFor(() => expect(inBody('cv-template-start-profile')).not.toBeNull())
  inBody('cv-template-start-profile')!.click()
  await vi.waitFor(() => expect(inBody('tailored-cv-summary-text')).not.toBeNull())
}

// Draft with my AI from the empty state: the profile loads as what the reply is compared with.
const draftWithAi = async () => {
  await vi.waitFor(() => expect(inBody('cv-template-start-ai')).not.toBeNull())
  inBody('cv-template-start-ai')!.click()
  await vi.waitFor(() => expect(inBody('cv-ai-draft-role')).not.toBeNull())
  await type('cv-ai-draft-role', 'Senior developer')
  inBody('cv-ai-draft-create')!.click()
  await vi.waitFor(() =>
    expect(inBody('cv-ai-draft-create')!.textContent).toContain('Prompt ready')
  )
  await type('cv-ai-draft-json', '{"summary":"From the AI"}')
  inBody('cv-ai-draft-load')!.click()
  await vi.waitFor(() => expect(inBody('cv-template-suggestions')).not.toBeNull())
}

beforeEach(() => {
  navigateTo.mockReset()
  calls = []
  createReply = { baseCv: { id: 9 }, errors: null }
})

describe('New CV template', () => {
  it('puts Back to the templates in the navbar', async () => {
    const wrapper = await mountPage()
    expect(useBackLinkState().value).toEqual({
      path: '/cv-templates/new',
      to: '/cv-templates',
      label: 'CV templates'
    })
    wrapper.unmount()
  })

  it('starts empty, then creates the profile in the chosen language as v1 only on Create', async () => {
    const wrapper = await mountPage()
    await vi.waitFor(() => expect(inBody('cv-template-start')).not.toBeNull())
    expect(inBody('tailored-cv-summary-text')).toBeNull()

    await type('cv-template-name', 'Generic')
    const norwegian = [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (el) => el.closest('[data-testid="cv-template-language"]') && el.id.endsWith('NORWEGIAN')
    )!
    norwegian.click()
    await flushPromises()
    await startFromProfile()
    expect(fromProfile().at(-1)!.variables.language).toBe('NORWEGIAN')
    expect(created()).toHaveLength(0)
    expect(inBody('cv-template-save-status')!.textContent).toBe('Nothing is created until you save')

    inBody('cv-template-save')!.click()
    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]!.variables.input).toMatchObject({
      name: 'Generic',
      description: null,
      language: 'NORWEGIAN',
      content: { summary: 'From profile', language: 'NORWEGIAN' }
    })
    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('/cv-templates/9', { replace: true })
    )
    wrapper.unmount()
  })

  it('needs a name before anything is created', async () => {
    const wrapper = await mountPage()
    await startFromProfile()
    inBody('cv-template-save')!.click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Give the template a name'))
    expect(created()).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows a taken name on the field with a link, and keeps the content', async () => {
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
    await type('cv-template-name', 'frontend')
    await startFromProfile()
    inBody('cv-template-save')!.click()
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('A CV template with this name already exists.')
    )
    expect(inBody('cv-template-existing')!.getAttribute('href')).toBe('/cv-templates/1')
    expect(navigateTo).not.toHaveBeenCalled()
    expect(inBody('tailored-cv-summary-text')!.textContent).toBe('From profile')
    wrapper.unmount()
  })

  it('reviews an AI draft against the profile, and creates only what was accepted', async () => {
    const wrapper = await mountPage()
    await type('cv-template-name', 'Frontend')
    await draftWithAi()
    // The summary waits on its card; the content is still the profile's.
    expect(inBody('tailored-cv-summary-text')!.textContent).toBe('From profile')
    expect(inBody('cv-template-suggestions')!.textContent).toContain('1 suggestion to review')
    expect(inBody('cv-template-save-status')!.textContent).toBe('1 suggestion not applied')

    inBody('tailored-cv-accept')!.click()
    await flushPromises()
    expect(inBody('tailored-cv-summary-text')!.textContent).toBe('From the AI')
    expect(inBody('cv-template-suggestions')).toBeNull()

    inBody('cv-template-save')!.click()
    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]!.variables.input).toMatchObject({ content: { summary: 'From the AI' } })
    wrapper.unmount()
  })
})
