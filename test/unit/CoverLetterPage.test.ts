import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
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

let calls: Body[]
let savedDraft: unknown
let generateReply: () => unknown
let listing: Record<string, unknown> & { documents: Record<string, unknown>[] }

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
    if (query.includes('query CoverLetterDraftFromProfile'))
      return { data: { coverLetterDraftFromProfile: content() } }
    if (query.includes('query CoverLetterExternalPrompt'))
      return { data: { coverLetterExternalPrompt: { instructions: 'Write the letter.' } } }
    if (query.includes('mutation SaveCoverLetterDraft')) {
      savedDraft = {
        id: 1,
        brief: input.brief,
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
            candidate: content({ paragraphs: String(input.text).split(/\n\s*\n/) }),
            errors: null
          }
        }
      }
    if (query.includes('mutation GenerateCoverLetterDocument')) {
      const document = {
        id: 90,
        fileName: 'cover-letter.pdf',
        createdAt: new Date().toISOString(),
        sentAt: null
      }
      listing.documents.push({ ...document, kind: 'COVER_LETTER' })
      return { data: { generateCoverLetterDocument: { document, errors: null } } }
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
const mounted: { unmount: () => void }[] = []
const ops = (name: string) => calls.filter((c) => c.query.includes(`mutation ${name}(`))
const paragraphs = () =>
  [
    ...document.body.querySelectorAll<HTMLTextAreaElement>(
      '[data-testid="cover-letter-paragraph"] textarea'
    )
  ].map((t) => t.value)

const mountPage = async () => {
  const wrapper = await mountSuspended(CoverLetterPage, {
    route: '/listings/5/cover-letter',
    attachTo: document.body
  })
  mounted.push(wrapper)
  await vi.waitFor(() => expect(el('cover-letter-save-status')).not.toBeNull())
  return wrapper
}

const click = async (id: string) => {
  el(id)!.click()
  await flushPromises()
}

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

// Reka opens the menu on keydown/pointerdown, not click.
const chooseSource = async (label: string) => {
  el('cover-letter-source')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await flushPromises()
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (i) => i.textContent?.trim() === label
  )!
  item.click()
  await flushPromises()
}

beforeEach(() => {
  clearNuxtData()
  calls = []
  savedDraft = null
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
      content: content({ paragraphs: ['AI opening', 'AI middle'] })
    },
    errors: null
  })
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
})

describe('Cover letter page', () => {
  it('appends the current notes, saved or not, to the external prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await mountPage()
    await type('[data-testid="cover-letter-brief"]', 'Mention the meetup')
    await chooseSource('Use an external chat')
    await vi.waitFor(() =>
      expect(el('cover-letter-copy-prompt')!.hasAttribute('disabled')).toBe(false)
    )
    await click('cover-letter-copy-prompt')
    expect(writeText.mock.calls[0]![0]).toMatch(/^Write the letter\.[\s\S]*Mention the meetup$/)
    vi.unstubAllGlobals()
  })

  it('copies the letter as text, live with unsaved edits and without the header on request', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await mountPage()
    await click('cover-letter-add-paragraph')
    await type('[data-testid="cover-letter-paragraph"] textarea', 'I build things.')
    const previewTab = [...document.body.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (t) => t.textContent?.trim() === 'Preview'
    )!
    previewTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    previewTab.click()
    await flushPromises()
    expect(el('cover-letter-text-preview')!.textContent).toContain('Ada Lovelace')
    expect(el('cover-letter-text-preview')!.textContent).toContain('I build things.')

    await click('cover-letter-copy-text')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('I build things.'))
    expect(writeText.mock.calls[0]![0]).toContain('Storgata 1')

    document.body.querySelector<HTMLElement>('[role="switch"]')!.click()
    await flushPromises()
    expect(el('cover-letter-text-preview')!.textContent).not.toContain('Storgata 1')
    vi.unstubAllGlobals()
  })

  it('prefills the header from the profile without saving, then saves the whole letter', async () => {
    await mountPage()
    expect(el('cover-letter-save-status')!.textContent).toBe('Not saved yet')
    const values = [...document.body.querySelectorAll('input')].map((i) => i.value)
    expect(values).toContain('Ada Lovelace')
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)

    await click('cover-letter-add-paragraph')
    await type('[data-testid="cover-letter-paragraph"] textarea', 'I build things.')
    await type('[data-testid="cover-letter-brief"]', 'Stress accessibility')
    await click('cover-letter-save')

    await vi.waitFor(() => expect(ops('SaveCoverLetterDraft')).toHaveLength(1))
    const input = ops('SaveCoverLetterDraft')[0]!.variables.input!
    expect(input.brief).toBe('Stress accessibility')
    expect(input.content).toMatchObject({
      fullName: 'Ada Lovelace',
      address: 'Storgata 1\n0155 Oslo',
      phone: null,
      greeting: null,
      paragraphs: ['I build things.']
    })
    await vi.waitFor(() => expect(el('cover-letter-save-status')!.textContent).toBe('Saved'))
  })

  it('saves unsaved notes before generating, then loads the letter unsaved', async () => {
    await mountPage()
    await type('[data-testid="cover-letter-brief"]', 'Mention the meetup')
    await chooseSource('Generate with AI')
    expect(el('cover-letter-source-run')!.textContent).toContain('Save and generate')
    await click('cover-letter-source-run')

    await vi.waitFor(() => expect(paragraphs()).toEqual(['AI opening', 'AI middle']))
    expect(ops('SaveCoverLetterDraft')[0]!.variables.input!.brief).toBe('Mention the meetup')
    const generate = ops('GenerateCoverLetter')
    expect(generate).toHaveLength(1)
    expect(generate[0]!.variables.input!.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(
      calls.findIndex((c) => c.query.includes('mutation SaveCoverLetterDraft(')) <
        calls.findIndex((c) => c.query.includes('mutation GenerateCoverLetter('))
    ).toBe(true)
    expect(el('cover-letter-loaded')).not.toBeNull()
    expect(el('cover-letter-save-status')!.textContent).toBe('Unsaved changes')
  })

  it('shows a failed generation in the modal and keeps the editor', async () => {
    savedDraft = {
      id: 1,
      brief: null,
      updatedAt: '2026-10-15T10:00:00Z',
      content: content({ paragraphs: ['Mine'] })
    }
    generateReply = () => ({
      result: { status: 'FAILED', error: 'The model gave up', errorCode: 'timeout', content: null },
      errors: null
    })
    await mountPage()
    await chooseSource('Generate with AI')
    await click('cover-letter-source-run')

    await vi.waitFor(() =>
      expect(el('cover-letter-source-error')?.textContent).toContain('The model gave up (timeout)')
    )
    expect(paragraphs()).toEqual(['Mine'])
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
  })

  it('warns before a pasted letter replaces unsaved edits, and Discard brings them back after several loads', async () => {
    savedDraft = {
      id: 1,
      brief: null,
      updatedAt: '2026-10-15T10:00:00Z',
      content: content({ paragraphs: ['Mine'] })
    }
    await mountPage()
    await type('[data-testid="cover-letter-paragraph"] textarea', 'Mine, edited')

    await chooseSource('Paste my own letter')
    await type('[data-testid="cover-letter-paste"]', 'First\n\nSecond')
    expect(el('cover-letter-replaces')).not.toBeNull()
    expect(el('cover-letter-source-run')!.textContent).toContain('Replace my edits')
    await click('cover-letter-source-run')

    await vi.waitFor(() => expect(paragraphs()).toEqual(['First', 'Second']))
    // A second letter on top of the first: Discard still returns to the owner's own text.
    await chooseSource('Paste my own letter')
    await type('[data-testid="cover-letter-paste"]', 'Third')
    await click('cover-letter-source-run')
    await vi.waitFor(() => expect(paragraphs()).toEqual(['Third']))
    const discard = [...el('cover-letter-loaded')!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Discard'
    )!
    discard.click()
    await flushPromises()
    expect(paragraphs()).toEqual(['Mine, edited'])
    expect(ops('SaveCoverLetterDraft')).toHaveLength(0)
  })

  it('saves unsaved edits before generating the PDF', async () => {
    await mountPage()
    await click('cover-letter-add-paragraph')
    await type('[data-testid="cover-letter-paragraph"] textarea', 'Body')
    expect(el('cover-letter-generate-pdf')!.textContent).toContain('Save and generate PDF')
    await click('cover-letter-generate-pdf')

    await vi.waitFor(() => expect(ops('GenerateCoverLetterDocument')).toHaveLength(1))
    expect(ops('SaveCoverLetterDraft')).toHaveLength(1)
    await vi.waitFor(() =>
      expect(el('cover-letter-latest-pdf')?.textContent).toContain('cover-letter.pdf')
    )
  })

  it('asks before leaving with unsaved changes', async () => {
    savedDraft = {
      id: 1,
      brief: null,
      updatedAt: '2026-10-15T10:00:00Z',
      content: content({ paragraphs: ['Mine'] })
    }
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
  })
})
