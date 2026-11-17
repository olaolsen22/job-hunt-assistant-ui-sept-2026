import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import CoverLetterPage from '~/pages/listings/[id]/cover-letter.vue'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

const content = (over: Record<string, unknown> = {}) => ({
  language: 'NORWEGIAN',
  fullName: 'Ada Lovelace',
  address: 'Storgata 1\n0155 Oslo',
  phone: null,
  email: 'ada@example.com',
  date: '2026-10-15',
  organization: 'Acme',
  recipientName: null,
  recipientAddress: null,
  subject: 'Søknad på stilling som utvikler',
  greeting: null,
  paragraphs: [] as string[],
  closing: 'Med vennlig hilsen',
  ...over
})

// A draft as the API returns it, saved at 10:00.
const draft = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: 1,
  brief: null,
  relocationLeadWeeks: null,
  updatedAt: '2026-10-15T10:00:00Z',
  content: content({ paragraphs: ['Mine'], ...over }),
  ...extra
})

const pdfDoc = (createdAt: string, over: Record<string, unknown> = {}) => ({
  id: 80,
  kind: 'COVER_LETTER',
  fileName: 'letter.pdf',
  createdAt,
  sentAt: null,
  origin: 'GENERATED',
  ...over
})

let calls: Body[]
let savedDraft: unknown
let savedCv: unknown
let generateReply: () => unknown
let documentReply: (() => unknown) | undefined
let appliedInput: Record<string, unknown> | undefined
let listing: Record<string, unknown> & { documents: Record<string, unknown>[] }
let promptInstructions: string
let pasteContent: ((text: string) => Record<string, unknown>) | undefined
let saveErrors: unknown[] | null
// Holds the save mutation open until released, to look at the page mid-save.
let saveGate: Promise<void> | undefined

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query } = body
    const input = body.variables?.input ?? {}
    if (query.includes('query LlmModels'))
      return { data: { llmModels: { models: [], defaultModel: null } } }
    if (query.includes('query ListingById')) return { data: { listingById: listing } }
    if (query.includes('query CoverLetterDraft(')) return { data: { coverLetterDraft: savedDraft } }
    if (query.includes('query TailoredCvDraft(')) return { data: { tailoredCvDraft: savedCv } }
    if (query.includes('query CoverLetterDraftFromProfile'))
      return { data: { coverLetterDraftFromProfile: content() } }
    if (query.includes('query CoverLetterExternalPrompt'))
      return { data: { coverLetterExternalPrompt: { instructions: promptInstructions } } }
    if (query.includes('mutation SaveCoverLetterDraft')) {
      await saveGate
      if (saveErrors)
        return { data: { saveCoverLetterDraft: { coverLetterDraft: null, errors: saveErrors } } }
      savedDraft = {
        id: 1,
        brief: input.brief,
        relocationLeadWeeks: input.relocationLeadWeeks,
        updatedAt: new Date().toISOString(),
        content: { ...content(), ...(input.content as object) }
      }
      return { data: { saveCoverLetterDraft: { coverLetterDraft: savedDraft, errors: null } } }
    }
    if (query.includes('mutation GenerateCoverLetter('))
      return { data: { generateCoverLetter: generateReply() } }
    if (query.includes('mutation PreviewCoverLetterText'))
      return {
        data: {
          previewCoverLetterText: {
            candidate: pasteContent
              ? pasteContent(String(input.text))
              : content({ paragraphs: String(input.text).split(/\n\s*\n/) }),
            errors: null
          }
        }
      }
    if (query.includes('mutation GenerateCoverLetterDocument')) {
      if (documentReply) return { data: { generateCoverLetterDocument: documentReply() } }
      const document = {
        id: 90,
        fileName: 'cover-letter.pdf',
        createdAt: new Date(Date.now() + 1000).toISOString(),
        sentAt: null
      }
      listing.documents.push({ ...document, kind: 'COVER_LETTER', origin: 'GENERATED' })
      return { data: { generateCoverLetterDocument: { document, errors: null } } }
    }
    if (query.includes('mutation ApplyToListing')) {
      appliedInput = input
      return { data: { applyToListing: { listing: { id: 5 }, errors: null } } }
    }
    return {
      data: {
        llmUsageToday: {
          model: 'fast',
          requests: 3,
          inputTokens: 100,
          outputTokens: 20,
          requestsLimit: 50,
          remainingRequests: 47,
          resetsAt: '2026-10-16T00:00:00Z'
        }
      }
    }
  }
})

const el = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const text = (id: string) => el(id)?.textContent?.trim()
const mounted: { unmount: () => void }[] = []
const ops = (name: string) => calls.filter((c) => c.query.includes(`mutation ${name}(`))
const paragraphs = () =>
  [
    ...document.body.querySelectorAll<HTMLTextAreaElement>(
      '[data-testid="cover-letter-paragraph"] textarea'
    )
  ].map((t) => t.value)
const toastTitles = () => useToast().toasts.value.map((t) => t.title)

const mountPage = async () => {
  const wrapper = await mountSuspended(CoverLetterPage, {
    route: '/listings/5/cover-letter',
    attachTo: document.body
  })
  mounted.push(wrapper)
  // The details strip shows once the letter is built (the save bar waits for something to save).
  await vi.waitFor(() => expect(el('cover-letter-details-summary')).not.toBeNull())
  return wrapper
}

const click = async (id: string) => {
  el(id)!.click()
  await flushPromises()
}
const isDisabled = (id: string) => (el(id) as HTMLButtonElement).disabled

// A test id can sit on the field or its wrapper, depending on the Nuxt UI component.
const type = async (selector: string, value: string) => {
  const found = document.body.querySelector<HTMLElement>(selector)!
  const field = (
    found.matches('input, textarea') ? found : found.querySelector('textarea, input')!
  ) as HTMLTextAreaElement
  field.value = value
  field.dispatchEvent(new Event('input'))
  await flushPromises()
}

const clickTab = async (label: string) => {
  const tab = [...document.body.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (t) => t.textContent?.trim() === label
  )!
  tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  tab.click()
  await flushPromises()
}

// "Write with AI" opens the dialog; the way to get a letter is a tab in it.
const chooseSource = async (tab: 'Built-in AI' | 'Your own AI' | 'Paste a letter') => {
  await click('cover-letter-source')
  await vi.waitFor(() => expect(el('cover-letter-source-run')).not.toBeNull())
  await clickTab(tab)
}

// The built-in AI writes a letter that then waits for review.
const writeWithAi = async () => {
  await chooseSource('Built-in AI')
  await click('cover-letter-source-run')
  await vi.waitFor(() => expect(el('cover-letter-review')).not.toBeNull())
}

// Reka opens a dropdown on pointerdown or Enter, not on click.
const openMore = async () => {
  el('cover-letter-more')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  )
  await vi.waitFor(() =>
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0)
  )
}
const menuItem = (label: string) =>
  [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (i) => i.textContent?.trim() === label
  )!

beforeEach(() => {
  clearNuxtData()
  useToast().clear()
  savedCv = null
  calls = []
  savedDraft = null
  documentReply = undefined
  appliedInput = undefined
  promptInstructions = 'Write the letter.'
  pasteContent = undefined
  saveErrors = null
  saveGate = undefined
  listing = {
    id: 5,
    title: 'Frontend Developer',
    status: 'SAVED',
    company: { id: 3, name: 'Acme' },
    documents: []
  }
  generateReply = () => ({
    result: {
      status: 'SUCCEEDED',
      error: null,
      errorCode: null,
      content: content({
        language: 'ENGLISH',
        fullName: 'Someone Else',
        organization: 'Other AS',
        subject: 'AI subject',
        greeting: 'Dear team,',
        paragraphs: ['AI opening', 'AI middle'],
        closing: 'Best,'
      })
    },
    errors: null
  })
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Cover letter page', () => {
  it('puts Back to the listing in the navbar', async () => {
    await mountPage()
    expect(useBackLinkState().value).toEqual({
      path: '/listings/5/cover-letter',
      to: '/listings/5',
      label: 'Listing'
    })
  })

  it('prefills from the profile without saving, then saves the letter with notes and weeks', async () => {
    await mountPage()
    // Nothing to save or print yet, so the bar stays out of the empty state's way.
    expect(el('cover-letter-save-bar')).toBeNull()
    expect(text('cover-letter-listing')).toBe('Frontend Developer · Acme')
    expect((el('cover-letter-subject') as HTMLInputElement).value).toBe(
      'Søknad på stilling som utvikler'
    )
    expect(text('cover-letter-signed')).toBe('Signed Ada Lovelace')
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)

    await click('cover-letter-start')
    await type('[data-testid="cover-letter-paragraph"] textarea', 'I build things.')
    // Notes and weeks live in the AI dialog now.
    await click('cover-letter-source')
    await type('[data-testid="cover-letter-brief"]', 'Stress accessibility')
    await type('[data-testid="cover-letter-relocation-weeks"]', '6')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(el('cover-letter-source-run')).toBeNull())
    await click('cover-letter-save')

    await vi.waitFor(() => expect(ops('SaveCoverLetterDraft')).toHaveLength(1))
    const input = ops('SaveCoverLetterDraft')[0]!.variables.input!
    expect(input.brief).toBe('Stress accessibility')
    expect(input.relocationLeadWeeks).toBe(6)
    expect(input.content).toMatchObject({
      fullName: 'Ada Lovelace',
      address: 'Storgata 1\n0155 Oslo',
      phone: null,
      greeting: null,
      paragraphs: ['I build things.']
    })
    await vi.waitFor(() => expect(text('cover-letter-save-status')).toBe('Saved · no PDF yet'))
    expect(toastTitles()).toContain('Cover letter saved')
  })

  it('keeps the saved weeks when saving other edits', async () => {
    savedDraft = draft({}, { brief: 'Old notes', relocationLeadWeeks: 4 })
    await mountPage()
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await type('[data-testid="cover-letter-paragraph"] textarea', 'Mine, edited')
    expect(text('cover-letter-save-status')).toBe('Unsaved changes')
    await click('cover-letter-save')

    await vi.waitFor(() => expect(ops('SaveCoverLetterDraft')).toHaveLength(1))
    expect(ops('SaveCoverLetterDraft')[0]!.variables.input).toMatchObject({
      brief: 'Old notes',
      relocationLeadWeeks: 4
    })
  })

  it('shows the empty state, starts a paragraph, and offers no PDF without text', async () => {
    await mountPage()
    expect(el('cover-letter-no-paragraphs')!.textContent).toContain('No letter text yet')
    expect(el('cover-letter-save-bar')).toBeNull()
    expect(el('cover-letter-add-paragraph')).toBeNull()

    await click('cover-letter-start')
    expect(paragraphs()).toEqual([''])
    expect(el('cover-letter-no-paragraphs')).toBeNull()
    expect(el('cover-letter-add-paragraph')).not.toBeNull()
    // Started, so the bar is back, but there's no text to print yet.
    expect(isDisabled('cover-letter-generate-pdf')).toBe(true)
    expect(el('cover-letter-generate-pdf')!.getAttribute('title')).toBe(
      'Add some letter text first'
    )
  })

  it('offers Tailor a CV first in the dialog when no tailored CV is saved, without blocking', async () => {
    savedCv = null
    const without = await mountPage()
    // The page itself no longer shows the notice.
    expect(el('cover-letter-no-cv')).toBeNull()
    await chooseSource('Built-in AI')
    await vi.waitFor(() => expect(el('cover-letter-source-no-cv')).not.toBeNull())
    expect(el('cover-letter-source-no-cv')!.querySelector('a')!.getAttribute('href')).toBe(
      '/listings/5/cv'
    )
    expect(isDisabled('cover-letter-source-run')).toBe(false)
    without.unmount()
    document.body.innerHTML = ''

    clearNuxtData()
    savedCv = { id: 1, updatedAt: '2026-10-12T10:00:00Z', content: {} }
    await mountPage()
    await chooseSource('Built-in AI')
    await flushPromises()
    expect(el('cover-letter-source-no-cv')).toBeNull()
  })

  it('appends the current notes and weeks, saved or not, to the external prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await mountPage()
    await chooseSource('Your own AI')
    await type('[data-testid="cover-letter-brief"]', 'Mention the meetup')
    await type('[data-testid="cover-letter-relocation-weeks"]', '3')
    await vi.waitFor(() => expect(isDisabled('cover-letter-copy-prompt')).toBe(false))
    await click('cover-letter-copy-prompt')
    expect(writeText.mock.calls[0]![0]).toMatch(
      /^Write the letter\.[\s\S]*Mention the meetup[\s\S]*needs 3 weeks to relocate before starting\.$/
    )
  })

  it('saves unsaved notes and weeks before writing, then holds the new letter for review', async () => {
    await mountPage()
    await chooseSource('Built-in AI')
    await type('[data-testid="cover-letter-brief"]', 'Mention the meetup')
    await type('[data-testid="cover-letter-relocation-weeks"]', '8')
    expect(text('cover-letter-source-run')).toBe('Save and write letter')
    await click('cover-letter-source-run')

    await vi.waitFor(() => expect(el('cover-letter-review')).not.toBeNull())
    const save = ops('SaveCoverLetterDraft')
    expect(save).toHaveLength(1)
    expect(save[0]!.variables.input).toMatchObject({
      brief: 'Mention the meetup',
      relocationLeadWeeks: 8
    })
    const generate = ops('GenerateCoverLetter')
    expect(generate).toHaveLength(1)
    expect(generate[0]!.variables.input!.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(
      calls.findIndex((c) => c.query.includes('mutation SaveCoverLetterDraft(')) <
        calls.findIndex((c) => c.query.includes('mutation GenerateCoverLetter('))
    ).toBe(true)
    // The current body is empty, so there is nothing to compare: no tabs.
    expect(el('cover-letter-review-tabs')).toBeNull()
    expect(el('cover-letter-text')!.textContent).toContain('AI opening')
  })

  it('says Write letter when nothing changed, and keeps the editor while the new letter waits', async () => {
    savedDraft = draft({}, { brief: 'Keep this', relocationLeadWeeks: 4 })
    await mountPage()
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await chooseSource('Built-in AI')
    expect(text('cover-letter-source-run')).toBe('Write letter')
    await click('cover-letter-source-run')
    await vi.waitFor(() => expect(el('cover-letter-review')).not.toBeNull())

    // Nothing was saved, and the editor, save and PDF are out of the way while it waits.
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
    expect(el('cover-letter-body')).toBeNull()
    expect(el('cover-letter-save')).toBeNull()
    expect(el('cover-letter-generate-pdf')).toBeNull()
    expect(text('cover-letter-review-source')).toBe('Built-in AI')
    expect(text('cover-letter-review-status')).toBe('Not used yet · your letter is unchanged')
    expect(el('cover-letter-source')!.className).not.toContain('bg-primary')

    // New letter first; Current letter shows the owner's own.
    expect(el('cover-letter-text')!.textContent).toContain('AI opening')
    await clickTab('Current letter')
    expect(el('cover-letter-text')!.textContent).toContain('Mine')
    expect(el('cover-letter-text')!.textContent).not.toContain('AI opening')
  })

  it('Use new letter copies only the text; details, language, notes and weeks stay', async () => {
    savedDraft = draft({}, { brief: 'Keep this', relocationLeadWeeks: 4 })
    await mountPage()
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await writeWithAi()
    await click('cover-letter-review-use')

    expect(el('cover-letter-review')).toBeNull()
    expect(paragraphs()).toEqual(['AI opening', 'AI middle'])
    expect((el('cover-letter-subject') as HTMLInputElement).value).toBe('AI subject')
    expect((el('cover-letter-greeting') as HTMLInputElement).value).toBe('Dear team,')
    expect((el('cover-letter-closing') as HTMLInputElement).value).toBe('Best,')
    expect(text('cover-letter-signed')).toBe('Signed Ada Lovelace')
    expect(text('cover-letter-details-summary')).toMatch(/^Norwegian · To Acme · /)
    expect(text('cover-letter-save-status')).toBe('Unsaved changes')

    await click('cover-letter-save')
    await vi.waitFor(() => expect(ops('SaveCoverLetterDraft')).toHaveLength(1))
    expect(ops('SaveCoverLetterDraft')[0]!.variables.input).toMatchObject({
      brief: 'Keep this',
      relocationLeadWeeks: 4,
      content: {
        language: 'NORWEGIAN',
        fullName: 'Ada Lovelace',
        organization: 'Acme',
        subject: 'AI subject',
        paragraphs: ['AI opening', 'AI middle']
      }
    })
  })

  it('discards the new letter with Undo to bring it back', async () => {
    savedDraft = draft()
    await mountPage()
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await writeWithAi()
    await click('cover-letter-review-discard')

    expect(el('cover-letter-review')).toBeNull()
    expect(paragraphs()).toEqual(['Mine'])
    expect(text('cover-letter-save-status')).toBe('Saved · no PDF yet')
    const toast = useToast().toasts.value.find((t) => t.title === 'New letter discarded')!
    expect(toast.actions?.map((a) => a.label)).toEqual(['Undo'])
    toast.actions![0]!.onClick!(new MouseEvent('click'))
    await flushPromises()
    expect(el('cover-letter-review')).not.toBeNull()
    expect(el('cover-letter-text')!.textContent).toContain('AI opening')
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
  })

  it('shows a failed generation in the dialog and keeps the editor', async () => {
    savedDraft = draft()
    generateReply = () => ({
      result: { status: 'FAILED', error: 'The model gave up', errorCode: 'timeout', content: null },
      errors: null
    })
    await mountPage()
    await chooseSource('Built-in AI')
    await click('cover-letter-source-run')

    await vi.waitFor(() =>
      expect(el('cover-letter-source-error')?.textContent).toContain('The model gave up (timeout)')
    )
    expect(el('cover-letter-review')).toBeNull()
    expect(paragraphs()).toEqual(['Mine'])
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
  })

  it('still loads a pasted letter while an interrupted AI run waits for its retry', async () => {
    generateReply = () => ({
      result: null,
      errors: [
        {
          __typename: 'AiSafetyError',
          message: 'Stopped: operation-interrupted',
          code: 'operation-interrupted'
        }
      ]
    })
    await mountPage()
    await chooseSource('Built-in AI')
    await click('cover-letter-source-run')
    await vi.waitFor(() => expect(el('ai-retry-confirm')).not.toBeNull())
    expect(isDisabled('cover-letter-source-run')).toBe(true)

    await clickTab('Paste a letter')
    await type('[data-testid="cover-letter-paste"]', 'Pasted')
    expect(isDisabled('cover-letter-source-run')).toBe(false)
    await click('cover-letter-source-run')
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Pasted']))
  })

  it('loads a pasted letter straight into an empty body, with a toast', async () => {
    await mountPage()
    await click('cover-letter-start-paste')
    await vi.waitFor(() => expect(el('cover-letter-paste')).not.toBeNull())
    // The notes are for the AI; the paste tab hides them.
    expect(el('cover-letter-brief')).toBeNull()
    await type('[data-testid="cover-letter-paste"]', 'One\n\nTwo')
    expect(text('cover-letter-source-run')).toBe('Load letter')
    await click('cover-letter-source-run')

    await vi.waitFor(() => expect(paragraphs()).toEqual(['One', 'Two']))
    expect(el('cover-letter-review')).toBeNull()
    expect(toastTitles()).toContain('Split into 2 paragraphs')
    expect(text('cover-letter-save-status')).toBe('Unsaved changes')
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
  })

  it('holds a pasted letter for review when the body has text, without a Replace warning', async () => {
    savedDraft = draft()
    await mountPage()
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await type('[data-testid="cover-letter-paragraph"] textarea', 'Mine, edited')

    await openMore()
    menuItem('Paste a letter…').click()
    await vi.waitFor(() => expect(el('cover-letter-paste')).not.toBeNull())
    await type('[data-testid="cover-letter-paste"]', 'First\n\nSecond')
    expect(el('cover-letter-replaces')).toBeNull()
    expect(text('cover-letter-source-run')).toBe('Load letter')
    await click('cover-letter-source-run')

    await vi.waitFor(() => expect(el('cover-letter-review')).not.toBeNull())
    expect(text('cover-letter-review-source')).toBe('Pasted')
    expect(text('cover-letter-review-status')).toBe('Not used yet · your letter is unchanged')
    // Discard returns to the owner's unsaved edits.
    await click('cover-letter-review-discard')
    expect(paragraphs()).toEqual(['Mine, edited'])
    expect(text('cover-letter-save-status')).toBe('Unsaved changes')
  })

  it('asks before leaving with unsaved changes', async () => {
    savedDraft = draft()
    // Rendered through RouterView, so the page's route-leave guard is registered like in the app.
    const wrapper = await mountSuspended(defineComponent({ render: () => h(RouterView) }), {
      route: '/listings/5/cover-letter',
      attachTo: document.body
    })
    mounted.push(wrapper)
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await type('[data-testid="cover-letter-paragraph"] textarea', 'Changed')

    const router = useRouter()
    await router.push('/listings')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/listings/5/cover-letter')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Leave without saving?'))
    expect(document.body.textContent).toContain('Your cover letter has unsaved changes.')
  })

  it('asks before leaving while a new letter waits, even with nothing unsaved', async () => {
    savedDraft = draft()
    const wrapper = await mountSuspended(defineComponent({ render: () => h(RouterView) }), {
      route: '/listings/5/cover-letter',
      attachTo: document.body
    })
    mounted.push(wrapper)
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
    await writeWithAi()

    const router = useRouter()
    await router.push('/listings')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/listings/5/cover-letter')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Leave without saving?'))
    expect(document.body.textContent).toContain('The new letter will be discarded.')
  })

  describe('PDF', () => {
    it('saves unsaved edits first, opens the preview, then offers Open PDF', async () => {
      await mountPage()
      await click('cover-letter-start')
      await type('[data-testid="cover-letter-paragraph"] textarea', 'Body')
      expect(text('cover-letter-generate-pdf')).toBe('Save and create PDF')
      await click('cover-letter-generate-pdf')

      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(ops('SaveCoverLetterDraft')).toHaveLength(1)
      expect(ops('GenerateCoverLetterDocument')).toHaveLength(1)
      expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/90')
      await vi.waitFor(() =>
        expect(el('cover-letter-latest-pdf')?.textContent).toContain('cover-letter.pdf')
      )
      await vi.waitFor(() => expect(text('cover-letter-generate-pdf')).toBe('Open PDF'))
      expect(text('cover-letter-save-status')).toBe('Saved · PDF is up to date')
      expect(isDisabled('cover-letter-save')).toBe(true)
    })

    it('says Create PDF for a saved letter without a PDF, and makes one without saving', async () => {
      savedDraft = draft()
      await mountPage()
      await vi.waitFor(() => expect(text('cover-letter-save-status')).toBe('Saved · no PDF yet'))
      expect(text('cover-letter-generate-pdf')).toBe('Create PDF')
      expect(isDisabled('cover-letter-save')).toBe(true)
      expect(el('cover-letter-latest-pdf')).toBeNull()

      await click('cover-letter-generate-pdf')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(ops('GenerateCoverLetterDocument')).toHaveLength(1)
      expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
    })

    it('says the PDF is older than a letter saved after it', async () => {
      savedDraft = draft()
      listing.documents = [pdfDoc('2026-10-15T09:00:00Z')]
      await mountPage()
      await vi.waitFor(() =>
        expect(text('cover-letter-save-status')).toBe('Saved · PDF is older than this letter')
      )
      expect(text('cover-letter-generate-pdf')).toBe('Create PDF')
      expect(el('cover-letter-latest-pdf')!.textContent).toContain('Older than the letter')
    })

    it('opens a current PDF without making another, and Save and create once edited', async () => {
      savedDraft = draft()
      listing.documents = [pdfDoc('2026-10-15T11:00:00Z')]
      await mountPage()
      await vi.waitFor(() =>
        expect(text('cover-letter-save-status')).toBe('Saved · PDF is up to date')
      )
      expect(text('cover-letter-generate-pdf')).toBe('Open PDF')
      await click('cover-letter-generate-pdf')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/80')
      expect(ops('GenerateCoverLetterDocument')).toHaveLength(0)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await vi.waitFor(() => expect(el('cv-pdf-download')).toBeNull())

      await type('[data-testid="cover-letter-paragraph"] textarea', 'Edited')
      expect(text('cover-letter-generate-pdf')).toBe('Save and create PDF')
      expect(text('cover-letter-save-status')).toBe('Unsaved changes')
    })

    it('shows a missing draft inline and treats the letter as unsaved again', async () => {
      savedDraft = draft()
      documentReply = () => ({
        document: null,
        errors: [{ __typename: 'CoverLetterDraftNotFoundError', message: 'Draft not found' }]
      })
      await mountPage()
      await vi.waitFor(() => expect(text('cover-letter-generate-pdf')).toBe('Create PDF'))
      await click('cover-letter-generate-pdf')

      await vi.waitFor(() =>
        expect(text('cover-letter-pdf-error')).toContain(
          'The saved letter was missing. Creating the PDF saves it again.'
        )
      )
      expect(text('cover-letter-generate-pdf')).toBe('Save and create PDF')
      expect(el('cv-pdf-download')).toBeNull()
    })

    it('shows another PDF error inline, without a toast', async () => {
      savedDraft = draft()
      documentReply = () => ({
        document: null,
        errors: [{ __typename: 'ValidationError', message: 'The letter is too long' }]
      })
      await mountPage()
      await vi.waitFor(() => expect(text('cover-letter-generate-pdf')).toBe('Create PDF'))
      await click('cover-letter-generate-pdf')
      await vi.waitFor(() => expect(text('cover-letter-pdf-error')).toBe('The letter is too long'))
      expect(toastTitles()).not.toContain('The letter is too long')
    })

    it('marks the listing applied from the PDF preview with this letter and the newest CV', async () => {
      savedDraft = draft()
      listing.documents = [
        pdfDoc('2026-10-15T11:00:00Z'),
        pdfDoc('2026-10-14T11:00:00Z', { id: 60, kind: 'CV', fileName: 'cv.pdf' })
      ]
      await mountPage()
      await vi.waitFor(() => expect(el('cover-letter-latest-pdf-preview')).not.toBeNull())
      await click('cover-letter-latest-pdf-preview')
      await vi.waitFor(() => expect(el('cv-pdf-apply')).not.toBeNull())
      expect(text('cv-pdf-apply')).toBe('Mark as applied with this PDF')
      await click('cv-pdf-apply')

      await vi.waitFor(() => expect(el('confirm-modal-confirm')).not.toBeNull())
      expect(el('cv-pdf-download')).toBeNull()
      await click('confirm-modal-confirm')
      await vi.waitFor(() =>
        expect(appliedInput).toMatchObject({ cvDocumentId: 60, coverLetterDocumentId: 80 })
      )
    })

    it('offers no Apply once the listing is past Saved', async () => {
      savedDraft = draft()
      listing.status = 'APPLIED'
      listing.documents = [pdfDoc('2026-10-15T11:00:00Z')]
      await mountPage()
      await vi.waitFor(() => expect(el('cover-letter-latest-pdf-preview')).not.toBeNull())
      await click('cover-letter-latest-pdf-preview')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(el('cv-pdf-apply')).toBeNull()
    })
  })

  describe('More menu', () => {
    it('copies the letter text or the whole letter, live with unsaved edits', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      savedDraft = draft()
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await type('[data-testid="cover-letter-paragraph"] textarea', 'I build things.')

      await openMore()
      menuItem('Copy letter text').click()
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
      expect(writeText.mock.calls[0]![0]).toContain('I build things.')
      expect(writeText.mock.calls[0]![0]).not.toContain('Storgata 1')
      await vi.waitFor(() => expect(toastTitles()).toContain('Letter text copied'))

      await openMore()
      menuItem('Copy with header').click()
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
      expect(writeText.mock.calls[1]![0]).toContain('Storgata 1')
      expect(writeText.mock.calls[1]![0]).toContain('I build things.')
      await vi.waitFor(() => expect(toastTitles()).toContain('Letter copied with header'))
    })

    it('disables the copy actions while the letter has no text', async () => {
      await mountPage()
      await openMore()
      expect(menuItem('Copy letter text').hasAttribute('data-disabled')).toBe(true)
      expect(menuItem('Copy with header').hasAttribute('data-disabled')).toBe(true)
      expect(menuItem('Paste a letter…').hasAttribute('data-disabled')).toBe(false)
    })
  })

  describe('Letter details', () => {
    const openDetails = async () => {
      await click('cover-letter-details-open')
      await vi.waitFor(() => expect(el('cover-letter-language')).not.toBeNull())
    }
    const pickLanguage = async (value: 'ENGLISH' | 'NORWEGIAN') => {
      const radio = [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
        (r) => r.closest('[data-testid="cover-letter-language"]') && r.id.endsWith(value)
      )!
      radio.click()
      await flushPromises()
    }

    it('summarizes language, recipient and date, with gaps named', async () => {
      savedDraft = draft({ organization: null, recipientName: null, date: null })
      await mountPage()
      await vi.waitFor(() =>
        expect(text('cover-letter-details-summary')).toBe('Norwegian · No recipient · No date')
      )
    })

    it('notes that changing the language keeps the text as written', async () => {
      savedDraft = draft()
      await mountPage()
      await openDetails()
      expect(el('cover-letter-language-note')).toBeNull()
      await pickLanguage('ENGLISH')

      await vi.waitFor(() =>
        expect(text('cover-letter-language-note')).toBe(
          'The letter text stays as written. Write with AI again to get it in English.'
        )
      )
      expect(text('cover-letter-details-summary')).toMatch(/^English · /)
      expect(text('cover-letter-save-status')).toBe('Unsaved changes')
      // Back to the language it opened with: nothing to say.
      await pickLanguage('NORWEGIAN')
      expect(el('cover-letter-language-note')).toBeNull()
    })

    it('says nothing about the language while the letter has no text', async () => {
      await mountPage()
      await openDetails()
      await pickLanguage('ENGLISH')
      expect(el('cover-letter-language-note')).toBeNull()
    })

    it('resets the details from the profile but keeps the subject', async () => {
      savedDraft = draft({ organization: 'Old AS', subject: 'My subject' })
      await mountPage()
      await vi.waitFor(() => expect(text('cover-letter-details-summary')).toContain('To Old AS'))
      await openDetails()
      await click('cover-letter-reset-header')

      await vi.waitFor(() => expect(text('cover-letter-details-summary')).toContain('To Acme'))
      expect((el('cover-letter-subject') as HTMLInputElement).value).toBe('My subject')
      expect(paragraphs()).toEqual(['Mine'])
    })
  })
  describe('Review fixes', () => {
    const requestIds = () => ops('GenerateCoverLetter').map((c) => c.variables.input!.requestId)
    const hasSpinner = (id: string) => !!el(id)?.querySelector('.animate-spin')

    it('repeats the requestId only while the notes, weeks and language are unchanged', async () => {
      savedDraft = draft({}, { brief: 'Keep this', relocationLeadWeeks: 4 })
      // No answer reached the page, so the next try may be answered from the first attempt.
      generateReply = () => {
        throw createError({ statusCode: 502 })
      }
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await chooseSource('Built-in AI')
      await click('cover-letter-source-run')
      await vi.waitFor(() => expect(el('cover-letter-source-error')).not.toBeNull())
      await click('cover-letter-source-run')
      await vi.waitFor(() => expect(requestIds()).toHaveLength(2))
      expect(requestIds()[1]).toBe(requestIds()[0])

      await type('[data-testid="cover-letter-brief"]', 'Other notes')
      await click('cover-letter-source-run')
      await vi.waitFor(() => expect(requestIds()).toHaveLength(3))
      expect(requestIds()[2]).not.toBe(requestIds()[1])

      await type('[data-testid="cover-letter-relocation-weeks"]', '9')
      await click('cover-letter-source-run')
      await vi.waitFor(() => expect(requestIds()).toHaveLength(4))
      expect(requestIds()[3]).not.toBe(requestIds()[2])
    })

    it('uses a new requestId after the retry confirm of an interrupted run', async () => {
      savedDraft = draft()
      generateReply = () => ({
        result: null,
        errors: [
          {
            __typename: 'AiSafetyError',
            message: 'Stopped: operation-interrupted',
            code: 'operation-interrupted'
          }
        ]
      })
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await chooseSource('Built-in AI')
      await click('cover-letter-source-run')
      await vi.waitFor(() => expect(el('ai-retry-confirm')).not.toBeNull())
      const retry = [...el('ai-retry-confirm')!.querySelectorAll('button')].at(-1)!
      retry.click()
      await vi.waitFor(() => expect(requestIds()).toHaveLength(2))
      expect(requestIds()[1]).not.toBe(requestIds()[0])
    })

    it('keeps the subject, greeting and closing when a letter pasted into an empty body has none', async () => {
      savedDraft = draft({
        paragraphs: [],
        subject: 'My subject',
        greeting: 'Hei,',
        closing: 'Hilsen'
      })
      pasteContent = (text) =>
        content({ subject: '', greeting: null, closing: '', paragraphs: text.split(/\n\s*\n/) })
      await mountPage()
      await click('cover-letter-start-paste')
      await vi.waitFor(() => expect(el('cover-letter-paste')).not.toBeNull())
      await type('[data-testid="cover-letter-paste"]', 'One\n\nTwo')
      await click('cover-letter-source-run')

      await vi.waitFor(() => expect(paragraphs()).toEqual(['One', 'Two']))
      expect((el('cover-letter-subject') as HTMLInputElement).value).toBe('My subject')
      expect((el('cover-letter-greeting') as HTMLInputElement).value).toBe('Hei,')
      expect((el('cover-letter-closing') as HTMLInputElement).value).toBe('Hilsen')
    })

    it('takes the pasted subject, greeting and closing into an empty body when it has them', async () => {
      savedDraft = draft({
        paragraphs: [],
        subject: 'My subject',
        greeting: 'Hei,',
        closing: 'Hilsen'
      })
      pasteContent = (text) =>
        content({
          subject: 'Pasted subject',
          greeting: 'Dear Acme,',
          closing: 'Yours,',
          paragraphs: [text]
        })
      await mountPage()
      await click('cover-letter-start-paste')
      await vi.waitFor(() => expect(el('cover-letter-paste')).not.toBeNull())
      await type('[data-testid="cover-letter-paste"]', 'One')
      await click('cover-letter-source-run')

      await vi.waitFor(() => expect(paragraphs()).toEqual(['One']))
      expect((el('cover-letter-subject') as HTMLInputElement).value).toBe('Pasted subject')
      expect((el('cover-letter-greeting') as HTMLInputElement).value).toBe('Dear Acme,')
      expect((el('cover-letter-closing') as HTMLInputElement).value).toBe('Yours,')
    })

    const discardToastUndo = () => {
      const toast = useToast().toasts.value.find((t) => t.title === 'New letter discarded')!
      const onClick = toast.actions![0]!.onClick!
      return async () => {
        onClick(new MouseEvent('click'))
        await flushPromises()
      }
    }

    it('Undo of a discard does nothing once a newer letter was used', async () => {
      savedDraft = draft()
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await writeWithAi()
      await click('cover-letter-review-discard')
      const undo = discardToastUndo()

      generateReply = () => ({
        result: {
          status: 'SUCCEEDED',
          error: null,
          errorCode: null,
          content: content({ paragraphs: ['Second run'] })
        },
        errors: null
      })
      await writeWithAi()
      await click('cover-letter-review-use')
      expect(paragraphs()).toEqual(['Second run'])

      await undo()
      expect(el('cover-letter-review')).toBeNull()
      expect(paragraphs()).toEqual(['Second run'])
    })

    it('Undo of a discard never replaces a newer letter still waiting', async () => {
      savedDraft = draft()
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await writeWithAi()
      await click('cover-letter-review-discard')
      const undo = discardToastUndo()

      generateReply = () => ({
        result: {
          status: 'SUCCEEDED',
          error: null,
          errorCode: null,
          content: content({ paragraphs: ['Second run'] })
        },
        errors: null
      })
      await writeWithAi()
      await undo()
      expect(el('cover-letter-text')!.textContent).toContain('Second run')
      expect(el('cover-letter-text')!.textContent).not.toContain('AI opening')
    })

    it('clamps and truncates the relocation weeks, and saves an empty field as none', async () => {
      savedDraft = draft({}, { relocationLeadWeeks: 4 })
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await chooseSource('Built-in AI')
      const field = () =>
        el('cover-letter-relocation-weeks')!.matches('input')
          ? (el('cover-letter-relocation-weeks') as HTMLInputElement)
          : el('cover-letter-relocation-weeks')!.querySelector('input')!
      const weeksSaved = async (value: string) => {
        await type('[data-testid="cover-letter-relocation-weeks"]', value)
        const shown = field().value
        await chooseSaveDraft()
        return {
          shown,
          saved: ops('SaveCoverLetterDraft').at(-1)!.variables.input!.relocationLeadWeeks
        }
      }
      const chooseSaveDraft = async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await vi.waitFor(() => expect(el('cover-letter-source-run')).toBeNull())
        await click('cover-letter-save')
        await vi.waitFor(() => expect(text('cover-letter-save-status')).toBe('Saved · no PDF yet'))
        await chooseSource('Built-in AI')
      }

      expect(await weeksSaved('100')).toEqual({ shown: '52', saved: 52 })
      expect(await weeksSaved('2.7')).toEqual({ shown: '2', saved: 2 })
      expect(await weeksSaved('-3')).toEqual({ shown: '0', saved: 0 })
      expect(await weeksSaved('')).toEqual({ shown: '', saved: null })
    })

    it('leaves the weeks out of the copied prompt when the prompt already says them', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      promptInstructions = 'Write the letter. The applicant needs 3 weeks before starting.'
      await mountPage()
      await chooseSource('Your own AI')
      await type('[data-testid="cover-letter-relocation-weeks"]', '3')
      await vi.waitFor(() => expect(isDisabled('cover-letter-copy-prompt')).toBe(false))
      await click('cover-letter-copy-prompt')
      expect(writeText.mock.calls[0]![0]).toBe(promptInstructions)

      // A different number than the prompt's still gets its line, singular for one.
      await type('[data-testid="cover-letter-relocation-weeks"]', '1')
      await click('cover-letter-copy-prompt')
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
      expect(writeText.mock.calls[1]![0]).toBe(
        `${promptInstructions}\n\nThe applicant needs 1 week to relocate before starting.`
      )
    })

    it('says no new letter was written when the save before it fails', async () => {
      saveErrors = [{ __typename: 'ValidationError', message: 'The subject is too long' }]
      await mountPage()
      await chooseSource('Built-in AI')
      await type('[data-testid="cover-letter-brief"]', 'Mention the meetup')
      await click('cover-letter-source-run')

      await vi.waitFor(() =>
        expect(text('cover-letter-source-error')).toContain(
          'The letter couldn’t be saved, so no new letter was written.'
        )
      )
      expect(toastTitles()).toContain('The subject is too long')
      expect(ops('GenerateCoverLetter')).toHaveLength(0)
      expect(el('cover-letter-review')).toBeNull()
    })

    it('removes a paragraph with text behind an Undo that puts it back in place', async () => {
      savedDraft = draft({ paragraphs: ['First', 'Second', 'Third'] })
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['First', 'Second', 'Third']))
      const remove = (n: number) =>
        document.body.querySelector<HTMLButtonElement>(`[aria-label="Remove paragraph ${n}"]`)!
      remove(2).click()
      await flushPromises()
      expect(paragraphs()).toEqual(['First', 'Third'])
      const toast = useToast().toasts.value.find((t) => t.title === 'Paragraph removed')!
      expect(toast.actions?.map((a) => a.label)).toEqual(['Undo'])
      toast.actions![0]!.onClick!(new MouseEvent('click'))
      await flushPromises()
      expect(paragraphs()).toEqual(['First', 'Second', 'Third'])
    })

    it('removes an empty paragraph without a toast', async () => {
      savedDraft = draft()
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await click('cover-letter-add-paragraph')
      expect(paragraphs()).toEqual(['Mine', ''])
      document.body.querySelector<HTMLButtonElement>('[aria-label="Remove paragraph 2"]')!.click()
      await flushPromises()
      expect(paragraphs()).toEqual(['Mine'])
      expect(toastTitles()).not.toContain('Paragraph removed')
    })

    it('shows Write with AI loading, not Save draft, while writing saves first', async () => {
      let release!: () => void
      saveGate = new Promise((r) => (release = r))
      await mountPage()
      await chooseSource('Built-in AI')
      await type('[data-testid="cover-letter-brief"]', 'Mention the meetup')
      el('cover-letter-source-run')!.click()
      await vi.waitFor(() => expect(ops('SaveCoverLetterDraft')).toHaveLength(1))
      await flushPromises()

      expect(hasSpinner('cover-letter-source')).toBe(true)
      expect(el('cover-letter-save')).not.toBeNull()
      expect(hasSpinner('cover-letter-save')).toBe(false)
      release()
      await vi.waitFor(() => expect(el('cover-letter-review')).not.toBeNull())
    })

    it('signs the new letter with the editor’s name, not the one the AI wrote', async () => {
      savedDraft = draft()
      await mountPage()
      await vi.waitFor(() => expect(paragraphs()).toEqual(['Mine']))
      await writeWithAi()
      expect(text('cover-letter-review')).toContain('Review new letter')
      expect(el('cover-letter-text')!.textContent).toContain('Ada Lovelace')
      expect(el('cover-letter-text')!.textContent).not.toContain('Someone Else')
      expect(text('cover-letter-review-discard')).toBe('Discard')
    })

    it('clears the reply box when switching tabs in the dialog', async () => {
      await mountPage()
      await chooseSource('Your own AI')
      await type('[data-testid="cover-letter-json"]', '{"paragraphs":["x"]}')
      await clickTab('Paste a letter')
      expect(
        (el('cover-letter-paste')!.querySelector('textarea') ??
          el('cover-letter-paste')) as HTMLTextAreaElement
      ).toHaveProperty('value', '')
      await type('[data-testid="cover-letter-paste"]', 'My letter')
      await clickTab('Your own AI')
      const json = el('cover-letter-json')!
      expect(
        ((json.matches('textarea') ? json : json.querySelector('textarea')) as HTMLTextAreaElement)
          .value
      ).toBe('')
      expect(isDisabled('cover-letter-source-run')).toBe(true)
    })

    it('shows the latest PDF name and date on separate lines, badged only when stale', async () => {
      savedDraft = draft()
      listing.documents = [
        pdfDoc('2026-10-15T09:00:00Z', { fileName: 'a-very-long-cover-letter-name.pdf' })
      ]
      await mountPage()
      await vi.waitFor(() => expect(el('cover-letter-latest-pdf')).not.toBeNull())
      const lines = el('cover-letter-latest-pdf')!.querySelectorAll('p')
      expect(lines).toHaveLength(2)
      expect(lines[0]!.textContent).toContain('a-very-long-cover-letter-name.pdf')
      expect(lines[0]!.querySelector('[title]')!.getAttribute('title')).toBe(
        'a-very-long-cover-letter-name.pdf'
      )
      expect(lines[1]!.textContent).not.toContain('.pdf')
      expect(lines[1]!.textContent).toContain('Older than the letter')
    })

    it('shows no stale badge on a PDF made after the last save', async () => {
      savedDraft = draft()
      listing.documents = [pdfDoc('2026-10-15T11:00:00Z')]
      await mountPage()
      await vi.waitFor(() => expect(el('cover-letter-latest-pdf')).not.toBeNull())
      expect(el('cover-letter-latest-pdf')!.textContent).toContain('letter.pdf')
      expect(el('cover-letter-latest-pdf')!.textContent).not.toContain('Older than')
    })
  })
})
