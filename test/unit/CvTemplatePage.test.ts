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
    if (query.includes('mutation UpdateBaseCv'))
      return {
        data: {
          updateBaseCv: { baseCv: { id: 7, ...body.variables.input }, errors: null }
        }
      }
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

// Opens a dropdown from the keyboard (Reka opens on pointerdown, not click) and picks an item.
const pickMenuItem = async (triggerTestid: string, label: string) => {
  inBody(triggerTestid)!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  )
  await vi.waitFor(() =>
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0)
  )
  ;[...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .find((el) => el.textContent?.includes(label))!
    .click()
  await flushPromises()
}

const buttonIn = (testid: string, label: string) =>
  [...inBody(testid)!.querySelectorAll<HTMLElement>('button')].find(
    (b) => b.textContent?.trim() === label
  )!

// Three companies, so a reply can be reviewed one experience at a time.
const threeJobs = (summary = 'Frontend summary') => {
  const cv = { ...tailoredCvFromProfile(cvProfile()), summary }
  const job = cv.experiences[0]!
  cv.experiences = [10, 11, 12].map((sourceEntryId) => ({
    ...structuredClone(job),
    sourceEntryId,
    employer: `Co ${sourceEntryId}`
  }))
  return cv
}

// An entry card's own content, without the suggestion shown on it.
const entryText = (card: HTMLElement) => {
  const copy = card.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[data-testid="tailored-cv-suggestion"]').forEach((el) => el.remove())
  return copy.textContent ?? ''
}

const experienceCards = () => [
  ...inBody('tailored-cv-experience')!.querySelectorAll<HTMLElement>(
    '[data-testid="tailored-cv-entry"]'
  )
]

describe('Draft with AI', () => {
  it('needs a target role, then offers the reply as suggestions to accept before saving', async () => {
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
      template: 'DETAILED',
      rewrite: false,
      purpose: 'ROLE'
    })
    expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(false)

    await loadReply()
    await vi.waitFor(() => expect(inBody('cv-template-suggestions')).not.toBeNull())
    expect(calls.find((c) => c.query.includes('mutation PreviewBaseCv'))!.variables.input).toEqual({
      language: 'ENGLISH',
      json: '{ "reply": true }',
      template: 'DETAILED',
      rewrite: false
    })
    // Only the summary differs: contact details and layout stay the template's.
    expect(inBody('cv-template-suggestions')!.textContent).toContain('1 suggestion to review')
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Frontend summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      '1 suggestion not applied'
    )

    inBody('tailored-cv-accept')!.click()
    await flushPromises()
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('AI summary')
    expect(inBody('cv-template-suggestions')).toBeNull()
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe('Unsaved changes')

    active = [template(4)]
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as English v4'))
    const save = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!
    expect(save.variables.input!.content).toMatchObject({
      summary: 'AI summary',
      email: content().email,
      sectionOrder: content().sectionOrder,
      template: 'DETAILED'
    })
    wrapper.unmount()
  })

  it('reviews a reply one company at a time, keeping a left-out one on Keep', async () => {
    active = [{ ...template(), english: { id: 73, content: toTailoredCvInput(threeJobs()) } }]
    const reply = threeJobs()
    reply.experiences[0]!.bullets[0]!.text = 'Reworded at Co 10'
    reply.experiences[1]!.bullets[0]!.text = 'Reworded at Co 11'
    reply.experiences.splice(2, 1)
    previewReply = () => ({ candidate: { content: toTailoredCvInput(reply) }, errors: null })
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    await loadReply()
    await vi.waitFor(() => expect(inBody('cv-template-suggestions')).not.toBeNull())
    expect(inBody('cv-template-suggestions')!.textContent).toContain('3 suggestions to review')
    const suggestionOn = (card: HTMLElement) =>
      card.querySelector<HTMLElement>('[data-testid="tailored-cv-suggestion"]')
    expect(experienceCards().every((card) => suggestionOn(card))).toBe(true)
    expect(suggestionOn(experienceCards()[2]!)!.textContent).toContain('Not in the AI draft')

    // Accepting the first company changes only it.
    suggestionOn(experienceCards()[0]!)!
      .querySelector<HTMLElement>('[data-testid="tailored-cv-accept"]')!
      .click()
    await flushPromises()
    expect(entryText(experienceCards()[0]!)).toContain('Reworded at Co 10')
    expect(entryText(experienceCards()[1]!)).not.toContain('Reworded at Co 11')
    expect(suggestionOn(experienceCards()[1]!)).not.toBeNull()

    // Keep leaves the company the AI dropped.
    suggestionOn(experienceCards()[2]!)!
      .querySelector<HTMLElement>('[data-testid="tailored-cv-dismiss"]')!
      .click()
    await flushPromises()
    expect(experienceCards()).toHaveLength(3)

    // Saving isn't blocked by the suggestion still open; it saves only what was accepted.
    active = [template(4)]
    await wrapper.get('[data-testid="cv-template-save"]').trigger('click')
    await vi.waitFor(() => expect(toastTitles()).toContain('Saved as English v4'))
    const saved = calls.find((c) => c.query.includes('mutation SaveBaseCvVersion'))!.variables
      .input!.content as { experiences: { bullets: { text: string }[] }[] }
    expect(saved.experiences).toHaveLength(3)
    expect(saved.experiences[0]!.bullets[0]!.text).toBe('Reworded at Co 10')
    expect(saved.experiences[1]!.bullets[0]!.text).not.toBe('Reworded at Co 11')
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
        '1 suggestion not applied'
      )
    )
    expect(wrapper.find('[data-testid="cv-template-note"]').exists()).toBe(false)
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

  const rejectChangedBullet = () => {
    previewReply = () => ({
      candidate: null,
      errors: [
        {
          __typename: 'InvalidTailoredCvDraftError',
          message: 'Bullet 2 text must match the source bullet.'
        }
      ]
    })
  }

  it('keeps the reply and the editor when the API rejects the reply, and says how to recover', async () => {
    rejectChangedBullet()
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    await loadReply()

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Bullet 2 text must match the source bullet.')
    )
    // Detailed without rewriting: the API needs bullets verbatim, so point at the ways out.
    expect(document.body.textContent).toContain('run it again')
    expect(document.body.textContent).toContain('choose Concise')
    expect((inBody('cv-ai-draft-json') as HTMLTextAreaElement).value).toBe('{ "reply": true }')
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('Frontend summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as English v3'
    )
    wrapper.unmount()
  })

  it('shows only the API’s message for a rejected reply when rewriting', async () => {
    rejectChangedBullet()
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    inBody('cv-ai-draft-rewrite')!.click()
    await flushPromises()
    await createPrompt()
    await loadReply()

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Bullet 2 text must match the source bullet.')
    )
    expect(document.body.textContent).not.toContain('pick Concise')
    wrapper.unmount()
  })

  it('picks the entry format in the dialog, as the template’s own, without outdating the prompt', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    inBody('cv-ai-draft-content-style')!.querySelector<HTMLElement>('[value="PARAGRAPH"]')!.click()
    await flushPromises()
    expect(
      inBody('tailored-cv-content-style')!
        .querySelector('[value="PARAGRAPH"]')!
        .getAttribute('aria-checked')
    ).toBe('true')
    expect(inBody('cv-ai-draft-outdated')).toBeNull()
    wrapper.unmount()
  })

  it('picks the CV style in the dialog, as the template’s own, and sends it to the prompt', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    inBody('cv-ai-draft-style')!.querySelector<HTMLElement>('[value="CONCISE"]')!.click()
    await flushPromises()
    // A changed style changes the prompt, and the Layout card shows the same choice.
    expect(inBody('cv-ai-draft-outdated')).not.toBeNull()
    expect(
      inBody('tailored-cv-template')!
        .querySelector('[value="CONCISE"]')!
        .getAttribute('aria-checked')
    ).toBe('true')

    inBody('cv-ai-draft-create')!.click()
    await vi.waitFor(() => expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(false))
    const prompts = calls.filter((c) => c.query.includes('query BaseCvExternalPrompt'))
    expect(prompts.at(-1)!.variables).toMatchObject({ template: 'CONCISE' })
    wrapper.unmount()
  })

  it('drafts for a market or field, sending the purpose to the prompt but not the preview', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    inBody('cv-ai-draft-purpose')!.querySelector<HTMLElement>('[value="OPEN_APPLICATION"]')!.click()
    await flushPromises()
    expect(inBody('cv-ai-draft-outdated')).not.toBeNull()
    expect(document.body.textContent).toContain('Market / field')
    expect(document.body.textContent).toContain('For markets outside IT, turn this on')

    await createPrompt('Customer-facing roles')
    const prompts = calls.filter((c) => c.query.includes('query BaseCvExternalPrompt'))
    expect(prompts.at(-1)!.variables).toMatchObject({
      targetRole: 'Customer-facing roles',
      purpose: 'OPEN_APPLICATION'
    })

    await loadReply()
    await vi.waitFor(() => expect(inBody('cv-template-suggestions')).not.toBeNull())
    const preview = calls.find((c) => c.query.includes('mutation PreviewBaseCv'))!
    expect(preview.variables.input).not.toHaveProperty('purpose')
    expect(preview.variables).not.toHaveProperty('purpose')
    wrapper.unmount()
  })

  it('words the fields for the purpose, back to a role on One role, keeping the typed text', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    const pick = async (value: string) => {
      inBody('cv-ai-draft-purpose')!.querySelector<HTMLElement>(`[value="${value}"]`)!.click()
      await flushPromises()
    }
    const text = () => document.body.textContent ?? ''
    const placeholder = () => (inBody('cv-ai-draft-role') as HTMLInputElement).placeholder
    const rewriteOn = async () => {
      inBody('cv-ai-draft-rewrite')!.click()
      await flushPromises()
    }
    await type('cv-ai-draft-role', 'Developer')

    expect(text()).toContain('Tailored to one job title.')
    expect(text()).toContain('Target role')
    expect(placeholder()).toBe('Senior frontend developer')
    expect(text()).toContain('Name areas to show, e.g. backend.')
    expect(text()).toContain('Other motivation belongs in the application message.')
    expect(text()).not.toContain('Say how to word it')
    expect(text()).not.toContain('For markets outside IT')

    await pick('OPEN_APPLICATION')
    expect(text()).toContain('A broader CV for a market or field, e.g. unsolicited applications.')
    expect(text()).toContain('Market / field')
    expect(text()).not.toContain('Target role')
    expect(placeholder()).toBe('Frontend-leaning developer')
    // The notes hint is the same for both purposes.
    expect(text()).toContain('Name areas to show, e.g. backend.')
    expect(text()).not.toContain('Say how to word it')
    expect(text()).toContain(
      'For markets outside IT, turn this on, or IT jobs show only title and dates.'
    )

    // Once rewriting is on, the nudge to turn it on is gone and the notes ask how to word it.
    await rewriteOn()
    expect(text()).not.toContain('For markets outside IT')
    expect(text()).toContain(
      'Name areas to show, e.g. backend. Say how to word it, e.g. explain IT work for non-IT readers.'
    )

    await pick('ROLE')
    expect(text()).toContain('Tailored to one job title.')
    expect(text()).toContain('Target role')
    expect(text()).not.toContain('Market / field')
    expect(placeholder()).toBe('Senior frontend developer')
    expect(text()).toContain('Say how to word it, e.g. explain IT work for non-IT readers.')
    expect((inBody('cv-ai-draft-role') as HTMLInputElement).value).toBe('Developer')
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

  it('sends "Rewrite in plain words" to both the prompt and the preview', async () => {
    const wrapper = await mountPage()
    await openDraftModal(wrapper)
    await createPrompt()
    inBody('cv-ai-draft-rewrite')!.click()
    await flushPromises()
    // Turning it on changes the prompt, so the ready one is outdated.
    expect(inBody('cv-ai-draft-outdated')).not.toBeNull()

    inBody('cv-ai-draft-create')!.click()
    await vi.waitFor(() => expect(isDisabled('cv-ai-draft-copy-prompt')).toBe(false))
    const prompts = calls.filter((c) => c.query.includes('query BaseCvExternalPrompt'))
    expect(prompts.at(-1)!.variables).toMatchObject({ rewrite: true })

    await loadReply()
    await vi.waitFor(() =>
      expect(calls.some((c) => c.query.includes('mutation PreviewBaseCv'))).toBe(true)
    )
    expect(
      calls.find((c) => c.query.includes('mutation PreviewBaseCv'))!.variables.input
    ).toMatchObject({ rewrite: true })
    wrapper.unmount()
  })

  it('keeps unsaved edits until a suggestion is accepted, and Dismiss all asks first', async () => {
    const wrapper = await mountPage()
    await editSummary(wrapper, 'My own edit')
    await openDraftModal(wrapper)
    await createPrompt()
    await loadReply()
    await vi.waitFor(() => expect(inBody('cv-template-suggestions')).not.toBeNull())
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('My own edit')

    buttonIn('cv-template-suggestions', 'Dismiss all').click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Dismiss every suggestion?'))
    inBody('confirm-modal-confirm')!.click()
    await vi.waitFor(() => expect(inBody('cv-template-suggestions')).toBeNull())
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('My own edit')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe('Unsaved changes')
    wrapper.unmount()
  })

  it('shows suggestions over the translation notice on a language not saved yet', async () => {
    translation = {
      fromLanguage: 'ENGLISH',
      untranslatedFields: ['summary'],
      content: content('Still English summary')
    }
    const wrapper = await mountPage()
    await pickMenuItem('cv-template-add-language', 'Translate from English')
    await vi.waitFor(() => expect(inBody('cv-template-draft')).not.toBeNull())

    await openDraftModal(wrapper)
    expect(inBody('cv-ai-draft-language')!.textContent).toBe('Norwegian')
    await createPrompt()
    await loadReply()
    await vi.waitFor(() => expect(inBody('cv-template-suggestions')).not.toBeNull())
    expect(inBody('cv-template-draft')).toBeNull()
    expect(wrapper.get('[data-testid="cv-template-save"]').text()).toBe('Save Norwegian v1')
    wrapper.unmount()
  })

  it('drafts a missing language with AI, starting from the profile in that language', async () => {
    const wrapper = await mountPage()
    await pickMenuItem('cv-template-add-language', 'Draft with my AI')
    await vi.waitFor(() => expect(inBody('cv-ai-draft-language')?.textContent).toBe('Norwegian'))
    expect(
      calls.filter((c) => c.query.includes('query BaseCvFromProfile(')).at(-1)!.variables
    ).toMatchObject({ language: 'NORWEGIAN' })
    expect(wrapper.get('[data-testid="cv-template-languages"]').text()).toContain(
      'Norwegian · not saved'
    )
    expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('From profile')
    expect(wrapper.get('[data-testid="cv-template-save"]').text()).toBe('Save Norwegian v1')
    wrapper.unmount()
  })
})

describe('CV template page', () => {
  it('puts Back to the templates in the navbar', async () => {
    const wrapper = await mountPage()
    expect(useBackLinkState().value).toEqual({
      path: '/cv-templates/7',
      to: '/cv-templates',
      label: 'CV templates'
    })
    wrapper.unmount()
  })

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

  it('saves edits as the next version with its note, and previews the last saved one meanwhile', async () => {
    const wrapper = await mountPage()
    await editSummary(wrapper, 'A sharper summary')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe('Unsaved changes')
    // Only saved versions render, so Preview stays available for the last one and says so.
    const previewButton = wrapper.get('[data-testid="cv-template-preview"]')
    expect(previewButton.attributes('disabled')).toBeUndefined()
    expect(previewButton.text()).toBe('Preview last saved')

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
    expect(wrapper.get('[data-testid="cv-template-preview"]').text()).toBe('Preview PDF')
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

    await vi.waitFor(() => expect(toastTitles()).toContain('No changes, still English v3'))
    expect(toastTitles()).not.toContain('Saved as English v4')
    expect(wrapper.get('[data-testid="cv-template-save-status"]').text()).toBe(
      'Saved as English v3'
    )
    wrapper.unmount()
  })

  it('offers replacing with the profile when the content points at a deleted profile item', async () => {
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

    expect(inBody('cv-template-invalid')!.textContent).toContain('Bullet 100 is gone.')
    buttonIn('cv-template-invalid', 'Replace with my profile').click()
    await flushPromises()
    // Unsaved edits are at stake, so it asks first.
    inBody('confirm-modal-confirm')!.click()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="tailored-cv-summary-text"]').text()).toBe('From profile')
    )
    expect(wrapper.find('[data-testid="cv-template-invalid"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renames the template from Edit details', async () => {
    const wrapper = await mountPage()
    await pickMenuItem('cv-template-more', 'Edit details')
    await vi.waitFor(() => expect(inBody('cv-template-name')).not.toBeNull())
    expect((inBody('cv-template-name') as HTMLInputElement).value).toBe('Frontend')
    await type('cv-template-name', 'Frontend lead')
    active = [{ ...template(), name: 'Frontend lead' }]
    inBody('cv-template-name')!.closest('form')!.dispatchEvent(new Event('submit'))
    await vi.waitFor(() =>
      expect(calls.find((c) => c.query.includes('mutation UpdateBaseCv'))?.variables.input).toEqual(
        { id: 7, name: 'Frontend lead', description: 'For frontend roles' }
      )
    )
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="cv-template-title"]').text()).toBe('Frontend lead')
    )
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
    expect(wrapper.find('[data-testid="cv-template-add-language"]').exists()).toBe(false)
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
    await pickMenuItem('cv-template-add-language', 'Translate from English')
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
