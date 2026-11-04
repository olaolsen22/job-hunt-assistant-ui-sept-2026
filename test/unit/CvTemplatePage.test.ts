import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CvTemplatePage from '~/pages/cv-templates/[id].vue'
import { tailoredCvFromProfile, toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

const content = (summary = 'Frontend summary') =>
  toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), summary })

const template = (number = 3) => ({
  id: 7,
  name: 'Frontend (EN)',
  description: 'For frontend roles',
  language: 'ENGLISH',
  archivedAt: null,
  latestVersion: { id: 70 + number, number, content: content() },
  versions: Array.from({ length: number }, (_, i) => ({
    id: 70 + number - i,
    number: number - i,
    note: i === 0 ? 'Shorter summary' : null,
    createdAt: '2026-10-30T10:00:00Z'
  }))
})

let calls: Body[]
let active: unknown[]
let saveReply: (input: Record<string, unknown>) => unknown
let fromProfileSummary: string

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query } = body
    if (query.includes('query Profile')) return { data: { profile: cvProfile() } }
    if (query.includes('query BaseCvPage')) return { data: { active, archived: [] } }
    if (query.includes('query BaseCvFromProfile'))
      return { data: { baseCvFromProfile: content(fromProfileSummary) } }
    if (query.includes('mutation SaveBaseCvVersion'))
      return { data: { saveBaseCvVersion: saveReply(body.variables.input!) } }
    return { data: {} }
  }
})

beforeEach(() => {
  clearNuxtData()
  useToast().clear()
  calls = []
  active = [template()]
  fromProfileSummary = 'From profile'
  saveReply = (input) => ({
    baseCvVersion: { id: 74, number: 4, content: input.content },
    errors: null
  })
})

const toastTitles = () => useToast().toasts.value.map((t) => t.title)

const inBody = (testid: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)

const mountPage = async () => {
  const wrapper = await mountSuspended(CvTemplatePage, {
    route: '/cv-templates/7',
    attachTo: document.body
  })
  await vi.waitFor(() =>
    expect(wrapper.find('[data-testid="cv-template-title"]').exists()).toBe(true)
  )
  return wrapper
}

// Edits the summary through its modal, as the owner would.
const editSummary = async (wrapper: Awaited<ReturnType<typeof mountPage>>, text: string) => {
  await wrapper.get('[data-testid="tailored-cv-summary-edit"]').trigger('click')
  await flushPromises()
  const input = inBody('tailored-cv-summary-input') as HTMLTextAreaElement
  input.value = text
  input.dispatchEvent(new Event('input'))
  await flushPromises()
  input.closest('form')!.dispatchEvent(new Event('submit'))
  await flushPromises()
}

describe('CV template page', () => {
  it('shows the template’s latest version in the editor, without AI', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="cv-template-title"]').text()).toBe('Frontend (EN)')
    expect(wrapper.get('[data-testid="cv-template-version"]').text()).toBe('v3')
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Frontend summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe('Saved as v3')
    expect(wrapper.text()).not.toContain('Tailor with AI')
    wrapper.unmount()
  })

  it('saves edits as the next version with its note', async () => {
    const wrapper = await mountPage()
    await editSummary(wrapper, 'A sharper summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe('Unsaved changes')
    // Preview shows a saved version, so it waits for the save.
    expect(wrapper.get('[data-testid="cv-template-preview"]').attributes('disabled')).toBeDefined()

    const note = wrapper.get('[data-testid="cv-template-note"]')
    await note.setValue('Sharper summary')
    active = [template(4)]
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as v4'))

    const save = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!
    expect(save.variables.input).toMatchObject({ baseCvId: 7, note: 'Sharper summary' })
    expect((save.variables.input!.content as { summary: string }).summary).toBe('A sharper summary')
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="cv-template-version"]').text()).toBe('v4')
    )
    wrapper.unmount()
  })

  it('says the version stayed when the API found nothing changed', async () => {
    saveReply = (input) => ({
      baseCvVersion: { id: 73, number: 3, content: input.content },
      errors: null
    })
    const wrapper = await mountPage()
    await editSummary(wrapper, 'Frontend summary ')
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')

    await vi.waitFor(() => expect(toastTitles()).toContain('No changes. Still v3'))
    expect(toastTitles()).not.toContain('Saved as v4')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe('Saved as v3')
    wrapper.unmount()
  })

  it('offers reloading from the profile when the content points at a deleted profile item', async () => {
    saveReply = () => ({
      baseCvVersion: null,
      errors: [{ __typename: 'InvalidTailoredCvDraftError', message: 'Bullet 100 is gone.' }]
    })
    const wrapper = await mountPage()
    await editSummary(wrapper, 'Changed')
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-invalid"]').exists()).toBe(true)
    )

    const alert = wrapper.get('[data-testid="cv-template-invalid"]')
    expect(alert.text()).toContain('Bullet 100 is gone.')
    await alert
      .findAll('button')
      .find((b) => b.text() === 'Reload from profile')!
      .trigger('click')
    await flushPromises()
    // Unsaved edits are at stake, so it asks first.
    inBody('confirm-modal-confirm')!.click()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('From profile')
    )
    expect(wrapper.find('[data-testid="cv-template-invalid"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('says when the template doesn’t exist', async () => {
    active = []
    const wrapper = await mountSuspended(CvTemplatePage, {
      route: '/cv-templates/7',
      attachTo: document.body
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-not-found"]').exists()).toBe(true)
    )
    wrapper.unmount()
  })
})
