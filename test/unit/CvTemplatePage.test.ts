import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CvTemplatePage from '~/pages/cv-templates/[id].vue'
import { toTailoredCvInput } from '~/utils/tailoredCv'
import { tailoredCvFromProfile } from '../fixtures/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

const content = (summary = 'Frontend summary') =>
  toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), summary })

// English only unless `norwegian` adds a v1 in Norwegian; numbers are per language.
const template = (number = 3, norwegian = false) => ({
  id: 7,
  name: 'Frontend',
  description: 'For frontend roles',
  languages: norwegian ? ['ENGLISH', 'NORWEGIAN'] : ['ENGLISH'],
  archivedAt: null,
  english: { id: 70 + number, content: content() },
  norwegian: norwegian ? { id: 90, content: content('Norsk sammendrag') } : null,
  versions: [
    ...(norwegian
      ? [
          {
            id: 90,
            language: 'NORWEGIAN',
            number: 1,
            note: null,
            createdAt: '2026-11-01T10:00:00Z'
          }
        ]
      : []),
    ...Array.from({ length: number }, (_, i) => ({
      id: 70 + number - i,
      language: 'ENGLISH',
      number: number - i,
      note: i === 0 ? 'Shorter summary' : null,
      createdAt: '2026-10-30T10:00:00Z'
    }))
  ]
})

let calls: Body[]
let active: unknown[]
let saveReply: (input: Record<string, unknown>) => unknown
let fromProfileSummary: string
let translation: unknown
let promptReply: () => unknown
let previewReply: () => unknown

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
    if (query.includes('query BaseCvTranslation'))
      return { data: { baseCvTranslation: translation } }
    if (query.includes('mutation SaveBaseCvVersion'))
      return { data: { saveBaseCvVersion: saveReply(body.variables.input!) } }
    if (query.includes('query BaseCvExternalPrompt')) return promptReply()
    if (query.includes('mutation PreviewBaseCv')) return { data: { previewBaseCv: previewReply() } }
    return { data: {} }
  }
})

beforeEach(() => {
  clearNuxtData()
  useToast().clear()
  calls = []
  active = [template()]
  fromProfileSummary = 'From profile'
  translation = null
  promptReply = () => ({ data: { baseCvExternalPrompt: { instructions: 'The prompt' } } })
  previewReply = () => ({
    candidate: {
      content: {
        ...content('AI summary'),
        email: 'from-profile@example.com',
        sectionOrder: 'DEVELOPER',
        template: 'CONCISE'
      }
    },
    errors: null
  })
  saveReply = (input) => ({
    baseCvVersion: { id: 74, number: 4, content: input.content },
    errors: null
  })
})

const toastTitles = () => useToast().toasts.value.map((t) => t.title)

const inBody = (testid: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)

const mountPage = async (route = '/cv-templates/7') => {
  const wrapper = await mountSuspended(CvTemplatePage, {
    route,
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

const type = async (testid: string, value: string) => {
  const input = inBody(testid) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

const isDisabled = (testid: string) => inBody(testid)!.hasAttribute('disabled')

const openDraftModal = async (wrapper: Awaited<ReturnType<typeof mountPage>>) => {
  await wrapper.get('[data-testid="cv-template-draft-ai"]').trigger('click')
  await vi.waitFor(() => expect(inBody('cv-ai-draft-role')).not.toBeNull())
}

const createPrompt = async (role = 'Frontend developer') => {
  await type('cv-ai-draft-role', role)
  inBody('cv-ai-draft-create')!.click()
  await vi.waitFor(() =>
    expect(inBody('cv-ai-draft-create')!.textContent).toContain('Prompt ready')
  )
}

const loadReply = async () => {
  await type('cv-ai-draft-json', '{ "reply": true }')
  inBody('cv-ai-draft-load')!.click()
}

describe('Draft with AI', () => {
  it('needs a target role, then previews the reply without the role and loads it unsaved', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    expect(inBody('cv-ai-draft-language')!.textContent).toBe('English')
    expect(isDisabled('cv-ai-draft-create')).toBe(true)
    expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(true)

    await type('cv-ai-draft-notes', ' Focus on Vue ')
    await createPrompt('  Frontend developer  ')
    expect(calls.find((c) => c.query.includes('query BaseCvExternalPrompt'))!.variables).toEqual({
      language: 'ENGLISH',
      targetRole: 'Frontend developer',
      notes: 'Focus on Vue',
      template: 'DETAILED'
    })
    expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(false)

    await loadReply()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('AI summary')
    )
    expect(calls.find((c) => c.query.includes('mutation PreviewBaseCv'))!.variables.input).toEqual({
      language: 'ENGLISH',
      json: '{ "reply": true }',
      template: 'DETAILED'
    })
    expect(wrapper.get('[data-testid="cv-template-ai-draft"]').text()).toContain(
      'Check your bullets before saving'
    )
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'AI draft: check bullets before saving'
    )
    expect(calls.some((c) => c.query.includes('mutation SaveBaseCvVersion'))).toBe(false)

    // Contact fields stay as the preview filled them; the layout stays the owner's; style is the one chosen.
    active = [template(4)]
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as English v4'))
    const save = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!
    expect(save.variables.input!.content).toMatchObject({
      summary: 'AI summary',
      email: 'from-profile@example.com',
      sectionOrder: content().sectionOrder,
      template: 'DETAILED'
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-ai-draft"]').exists()).toBe(false)
    )
    wrapper.unmount()
  })

  it('shows a rejected target role from the prompt query, and retries', async () => {
    promptReply = () => ({ data: null, errors: [{ message: 'Target role is too long.' }] })
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await type('cv-ai-draft-role', 'Frontend developer')
    inBody('cv-ai-draft-create')!.click()

    await vi.waitFor(() =>
      expect(inBody('cv-ai-draft-prompt-error')?.textContent).toContain('Target role is too long.')
    )
    expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(true)

    promptReply = () => ({ data: { baseCvExternalPrompt: { instructions: 'The prompt' } } })
    const retry = [...inBody('cv-ai-draft-prompt-error')!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Retry')
    )!
    retry.click()
    await vi.waitFor(() => expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(false))
    wrapper.unmount()
  })

  it('keeps the reply and the editor when the API rejects the reply', async () => {
    previewReply = () => ({
      candidate: null,
      errors: [{ __typename: 'InvalidTailoredCvDraftError', message: 'A bullet has no source.' }]
    })
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    await loadReply()

    await vi.waitFor(() => expect(document.body.textContent).toContain('A bullet has no source.'))
    expect((inBody('cv-ai-draft-json') as HTMLTextAreaElement).value).toBe('{ "reply": true }')
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Frontend summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as English v3'
    )
    wrapper.unmount()
  })

  it('makes a changed detail wait for a new prompt, keeping the pasted reply', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    await type('cv-ai-draft-json', '{ "reply": true }')
    expect(isDisabled('cv-ai-draft-load')).toBe(false)

    await type('cv-ai-draft-role', 'Backend developer')
    expect(inBody('cv-ai-draft-outdated')).not.toBeNull()
    expect(inBody('cv-ai-draft-create')!.textContent).toContain('Update prompt')
    expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(true)
    expect(isDisabled('cv-ai-draft-load')).toBe(true)
    expect((inBody('cv-ai-draft-json') as HTMLTextAreaElement).value).toBe('{ "reply": true }')

    inBody('cv-ai-draft-create')!.click()
    await vi.waitFor(() => expect(isDisabled('cv-ai-draft-load')).toBe(false))
    const prompts = calls.filter((c) => c.query.includes('query BaseCvExternalPrompt'))
    expect(prompts).toHaveLength(2)
    expect(prompts[1]!.variables).toMatchObject({ targetRole: 'Backend developer' })
    wrapper.unmount()
  })

  it('warns before replacing unsaved edits', async () => {
    const wrapper = await mountPage()
    await editSummary(wrapper, 'My own edit')
    await openDraftModal(wrapper)
    await createPrompt()

    expect(inBody('cv-ai-draft-replaces')).not.toBeNull()
    expect(inBody('cv-ai-draft-load')!.textContent).toContain('Replace my edits')
    await loadReply()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('AI summary')
    )
    wrapper.unmount()
  })

  it('discards a loaded draft back to the saved version', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    await loadReply()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-ai-draft"]').exists()).toBe(true)
    )

    await wrapper
      .get('[data-testid="cv-template-ai-draft"]')
      .findAll('button')
      .find((b) => b.text() === 'Discard')!
      .trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Frontend summary')
    expect(wrapper.find('[data-testid="cv-template-ai-draft"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as English v3'
    )
    wrapper.unmount()
  })

  it('replaces the translation notice on a language not saved yet, and saves it as v1', async () => {
    translation = {
      fromLanguage: 'ENGLISH',
      untranslatedFields: ['summary'],
      content: content('Still English summary')
    }
    saveReply = (input) => ({
      baseCvVersion: { id: 90, number: 1, content: input.content },
      errors: null
    })
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="cv-template-add-no"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-draft"]').exists()).toBe(true)
    )

    await openDraftModal(wrapper)
    expect(inBody('cv-ai-draft-language')!.textContent).toBe('Norwegian')
    await createPrompt()
    await loadReply()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-ai-draft"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="cv-template-draft"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tailored-cv-summary-warning"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cv-template-save"]').text()).toBe('Save Norwegian v1')
    wrapper.unmount()
  })
})

describe('CV template page', () => {
  it('shows the template’s latest version in the editor, without per-section AI', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="cv-template-title"]').text()).toBe('Frontend')
    expect(wrapper.get('[data-testid="cv-template-languages"]').text()).toContain('English v3')
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Frontend summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as English v3'
    )
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
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as English v4'))

    const save = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!
    expect(save.variables.input).toMatchObject({
      baseCvId: 7,
      language: 'ENGLISH',
      note: 'Sharper summary'
    })
    expect((save.variables.input!.content as { summary: string }).summary).toBe('A sharper summary')
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="cv-template-languages"]').text()).toContain('English v4')
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

    await vi.waitFor(() => expect(toastTitles()).toContain('No changes. Still English v3'))
    expect(toastTitles()).not.toContain('Saved as English v4')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as English v3'
    )
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

  it('opens the language from the URL with its own versions', async () => {
    active = [template(3, true)]
    const wrapper = await mountPage('/cv-templates/7?lang=no')

    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Norsk sammendrag')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as Norwegian v1'
    )
    // Both languages exist, so there's nothing to add.
    expect(wrapper.find('[data-testid="cv-template-add-en"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cv-template-add-no"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('adds a language as an unsaved translation, flags what’s left, then saves it as v1', async () => {
    translation = {
      fromLanguage: 'ENGLISH',
      untranslatedFields: ['summary', 'experiences[0].bullets[0]', 'experiences[0].title'],
      content: content('Still English summary')
    }
    saveReply = (input) => ({
      baseCvVersion: { id: 90, number: 1, content: input.content },
      errors: null
    })
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="cv-template-add-no"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-draft"]').exists()).toBe(true)
    )

    expect(calls.find((c) => c.query.includes('query BaseCvTranslation'))!.variables).toEqual({
      baseCvId: 7,
      language: 'NORWEGIAN'
    })
    expect(wrapper.get('[data-testid="cv-template-languages"]').text()).toContain(
      'Norwegian · not saved'
    )
    expect(wrapper.get('[data-testid="tailored-cv-summary-warning"]').text()).toBe(
      'Still in English'
    )
    expect(wrapper.get('[data-testid="tailored-cv-entry-warning"]').text()).toBe(
      '2 parts still in English'
    )
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      '3 parts are still in English'
    )

    // Editing the summary clears its flag; the entry's stay.
    await editSummary(wrapper, 'Norsk sammendrag')
    expect(wrapper.find('[data-testid="tailored-cv-summary-warning"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      '2 parts are still in English'
    )

    // Flags never block saving: names and tech terms may stay as they are.
    active = [template(3, true)]
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as Norwegian v1'))
    const save = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!
    expect(save.variables.input).toMatchObject({ baseCvId: 7, language: 'NORWEGIAN' })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="cv-template-draft"]').exists()).toBe(false)
    )
    expect(wrapper.find('[data-testid="tailored-cv-entry-warning"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('asks before switching language with unsaved edits, then saves in the new language', async () => {
    active = [template(3, true)]
    const wrapper = await mountPage()
    await editSummary(wrapper, 'Changed')
    const norwegian = wrapper
      .get('[data-testid="cv-template-languages"]')
      .findAll('button')
      .find((b) => b.text().includes('Norwegian'))!
    await norwegian.trigger('mousedown', { button: 0 })
    await norwegian.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Changed')

    inBody('confirm-modal-confirm')!.click()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe(
        'Norsk sammendrag'
      )
    )
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as Norwegian v1'
    )

    // Edits on the Norwegian tab are saved as a Norwegian version, not the first language's.
    saveReply = (input) => ({
      baseCvVersion: { id: 91, number: 2, content: input.content },
      errors: null
    })
    await editSummary(wrapper, 'Ny norsk tekst')
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as Norwegian v2'))
    const save = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!
    expect(save.variables.input).toMatchObject({ baseCvId: 7, language: 'NORWEGIAN' })
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
