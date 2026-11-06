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

type Body = { query: string; variables: { input?: Record<string, unknown> } }
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
      return { data: { baseCvFromProfile: content('From profile') } }
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
const mountPage = (route = '/cv-templates/new?name=Frontend&lang=en') =>
  mountSuspended(NewTemplatePage, { route, attachTo: document.body })

const created = () => calls.filter((c) => c.query.includes('mutation CreateBaseCv'))

// Through the AI modal, which opens by itself: role, prompt, reply.
const loadAiDraft = async () => {
  await vi.waitFor(() => expect(inBody('cv-ai-draft-role')).not.toBeNull())
  await type('cv-ai-draft-role', 'Senior developer')
  inBody('cv-ai-draft-create')!.click()
  await vi.waitFor(() =>
    expect(inBody('cv-ai-draft-create')!.textContent).toContain('Prompt ready')
  )
  await type('cv-ai-draft-json', '{"summary":"From the AI"}')
  inBody('cv-ai-draft-load')!.click()
  await vi.waitFor(() => expect(inBody('cv-template-ai-draft')).not.toBeNull())
}

beforeEach(() => {
  navigateTo.mockReset()
  calls = []
  createReply = { baseCv: { id: 9 }, errors: null }
})

describe('New CV template from an AI draft', () => {
  it('creates nothing until Save, then saves the reviewed draft as the first version', async () => {
    const wrapper = await mountPage()
    await loadAiDraft()
    expect(created()).toHaveLength(0)
    expect(inBody('tailored-cv-summary-text')!.textContent).toBe('From the AI')

    inBody('cv-template-save')!.click()
    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]!.variables.input).toMatchObject({
      name: 'Frontend',
      description: null,
      language: 'ENGLISH',
      content: { summary: 'From the AI' }
    })
    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('/cv-templates/9', { replace: true })
    )
    wrapper.unmount()
  })

  it('shows a taken name on the field and keeps the draft', async () => {
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
    await loadAiDraft()

    inBody('cv-template-save')!.click()
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('A CV template with this name already exists.')
    )
    const link = [...document.body.querySelectorAll('a')].find(
      (a) => a.textContent === 'Open the existing template'
    )!
    expect(link.getAttribute('href')).toBe('/cv-templates/1')
    expect(navigateTo).not.toHaveBeenCalled()
    expect(inBody('tailored-cv-summary-text')!.textContent).toBe('From the AI')
    wrapper.unmount()
  })

  it('discards the AI draft back to the profile, still unsaved', async () => {
    const wrapper = await mountPage()
    await loadAiDraft()
    const discard = [...inBody('cv-template-ai-draft')!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Discard'
    )!
    discard.click()
    await vi.waitFor(() => expect(inBody('cv-template-ai-draft')).toBeNull())
    expect(inBody('tailored-cv-summary-text')!.textContent).toBe('From profile')
    expect(created()).toHaveLength(0)
    wrapper.unmount()
  })

  it('goes back to the list when there is no name to continue with', async () => {
    const wrapper = await mountPage('/cv-templates/new')
    expect(navigateTo).toHaveBeenCalledWith('/cv-templates', { replace: true })
    wrapper.unmount()
  })
})
