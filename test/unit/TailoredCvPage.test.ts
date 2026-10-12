import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import CvPage from '~/pages/listings/[id]/cv.vue'
import { tailoredCvFromProfile, toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

let savedDraft: unknown
let calls: Body[]
let releaseAnalysis: () => void
let analysisGate: Promise<void>
let previewReply: unknown
let generateReply: () => unknown

const listing = { id: 5, title: 'Frontend Developer', company: { id: 3, name: 'Acme' } }

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query } = body
    const input = body.variables?.input ?? {}
    if (query.includes('query ListingById')) return { data: { listingById: listing } }
    if (query.includes('query Profile')) return { data: { profile: cvProfile() } }
    if (query.includes('query TailoredCvDraft')) return { data: { tailoredCvDraft: savedDraft } }
    if (query.includes('mutation AnalyzeTailoredCvSection')) {
      await analysisGate
      return {
        data: {
          analyzeTailoredCvSection: {
            result: {
              status: input.section === 'SKILLS' ? 'FAILED' : 'SUCCEEDED',
              section: input.section,
              sourceEntryId: input.sourceEntryId,
              selectedBulletIds: [100],
              selectedSkillIds: [],
              summary: input.section === 'SUMMARY' ? 'Tailored summary' : null,
              error: input.section === 'SKILLS' ? 'Model timed out' : null
            },
            errors: null
          }
        }
      }
    }
    if (query.includes('mutation PreviewTailoredCvDraft'))
      return { data: { previewTailoredCvDraft: previewReply } }
    if (query.includes('mutation SaveTailoredCvDraft'))
      return {
        data: {
          saveTailoredCvDraft: {
            tailoredCvDraft: { id: 1, updatedAt: '2026-10-12T10:00:00Z', content: input.content },
            errors: null
          }
        }
      }
    if (query.includes('mutation GenerateCvDocument'))
      return { data: { generateCvDocument: generateReply() } }
    if (query.includes('query TailoredCvExternalPrompt'))
      return { data: { tailoredCvExternalPrompt: { instructions: 'Tailor this CV' } } }
    return {
      data: {
        llmUsageToday: {
          requests: 3,
          inputTokens: 100,
          outputTokens: 20,
          requestsLimit: 50,
          remainingRequests: 47,
          resetsAt: '2026-10-12T00:00:00Z'
        }
      }
    }
  }
})

const el = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const mounted: { unmount: () => void }[] = []

const mountPage = async () => {
  const wrapper = await mountSuspended(CvPage, { route: '/listings/5/cv', attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

const savedSummary = () => ({
  id: 1,
  updatedAt: '2026-10-12T10:00:00Z',
  content: toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), summary: 'Mine' })
})
const summaryValue = () => (el('tailored-cv-summary-input') as HTMLTextAreaElement).value
const click = async (id: string) => {
  el(id)!.click()
  await flushPromises()
}

const ops = (name: string) => calls.filter((c) => c.query.includes(`mutation ${name}`))

beforeEach(() => {
  clearNuxtData()
  calls = []
  savedDraft = null
  previewReply = null
  let nextId = 70
  generateReply = () => ({ document: { id: nextId++, fileName: 'cv.pdf' }, errors: null })
  analysisGate = new Promise((resolve) => (releaseAnalysis = resolve))
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
})

describe('Tailored CV page', () => {
  it('opens prefilled from the profile without running AI', async () => {
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-input')).not.toBeNull())
    const values = [...document.body.querySelectorAll('input')].map((i) => i.value)
    expect(values).toContain('Existing owner')
    expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
    expect(ops('AnalyzeTailoredCvSection')).toHaveLength(0)
    expect(el('tailored-cv-overlay')).toBeNull()
  })

  it('optimizes the whole CV with built-in AI behind an overlay after showing usage', async () => {
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
    await click('tailored-cv-optimize')

    await vi.waitFor(() => expect(el('ai-usage-requests')?.textContent).toContain('3 of 50'))
    expect(el('tailored-cv-ai-requests')!.textContent).toContain('Makes 3 AI requests')
    expect(ops('AnalyzeTailoredCvSection')).toHaveLength(0)

    await click('tailored-cv-ai-run')
    await vi.waitFor(() => expect(el('tailored-cv-overlay')).not.toBeNull())
    expect(el('tailored-cv-overlay')!.textContent).toContain('Analyzing experience 1 of 1')

    releaseAnalysis()
    await vi.waitFor(() => expect(el('tailored-cv-overlay')).toBeNull())
    await flushPromises()

    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-skills-error')!.textContent).toContain('Model timed out')
    expect(ops('SaveTailoredCvDraft')).toHaveLength(0)

    // Closing or reloading the tab now gets the browser's leave warning.
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })

  it('runs one request from a section AI button and offers it as a suggestion over a saved draft', async () => {
    savedDraft = savedSummary()
    releaseAnalysis()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-analyze')).not.toBeNull())
    await click('tailored-cv-summary-analyze')
    await vi.waitFor(() =>
      expect(el('tailored-cv-ai-requests')?.textContent).toContain('Makes 1 AI request.')
    )
    await click('tailored-cv-ai-run')

    await vi.waitFor(() => expect(el('tailored-cv-suggestion')).not.toBeNull())
    expect(ops('AnalyzeTailoredCvSection').map((c) => c.variables.input!.section)).toEqual([
      'SUMMARY'
    ])
    expect(summaryValue()).toBe('Mine')
    await click('tailored-cv-accept')
    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
  })

  it('opens a saved draft and saves the complete edited candidate', async () => {
    savedDraft = savedSummary()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-input')).not.toBeNull())
    expect(el('tailored-cv-save-status')!.textContent).toBe('Saved')

    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(false)

    const summary = el('tailored-cv-summary-input') as HTMLTextAreaElement
    summary.value = 'Edited summary'
    summary.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))

    expect(ops('SaveTailoredCvDraft')[0]!.variables.input).toMatchObject({
      listingId: 5,
      content: {
        fullName: 'Existing owner',
        summary: 'Edited summary',
        languages: expect.any(Array)
      }
    })
    await vi.waitFor(() => expect(el('tailored-cv-save-status')!.textContent).toBe('Saved'))
  })

  it('copies the external prompt and shows a rejected reply inline', async () => {
    savedDraft = savedSummary()
    previewReply = {
      candidate: null,
      errors: [{ __typename: 'InvalidTailoredCvDraftError', message: 'Unknown bullet id 999.' }]
    }
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
    await click('tailored-cv-optimize')

    const external = [...document.body.querySelectorAll<HTMLElement>('button[role="tab"]')].find(
      (b) => b.textContent?.includes('External AI')
    )!
    external.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    await vi.waitFor(() => expect(el('tailored-cv-json')).not.toBeNull())
    await vi.waitFor(() =>
      expect((el('tailored-cv-copy-prompt') as HTMLButtonElement).disabled).toBe(false)
    )
    await click('tailored-cv-copy-prompt')
    expect(writeText).toHaveBeenCalledWith('Tailor this CV')

    const json = el('tailored-cv-json') as HTMLTextAreaElement
    json.value = '{"content":{}}'
    json.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('tailored-cv-preview')

    await vi.waitFor(() => expect(document.body.textContent).toContain('Unknown bullet id 999.'))
    expect(summaryValue()).toBe('Mine')
    expect(el('tailored-cv-save-status')!.textContent).toBe('Saved')
    vi.unstubAllGlobals()
  })

  it('asks before leaving with unsaved changes, and Cancel keeps the page and edits', async () => {
    // Rendered through RouterView, so the page's route-leave guard is registered like in the app.
    const wrapper = await mountSuspended(defineComponent({ render: () => h(RouterView) }), {
      route: '/listings/5/cv',
      attachTo: document.body
    })
    mounted.push(wrapper)
    await vi.waitFor(() =>
      expect(el('tailored-cv-save-status')?.textContent).toBe('Unsaved changes')
    )

    const router = useRouter()
    await router.push('/listings')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/listings/5/cv')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Leave without saving?'))

    const cancel = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel'
    )!
    cancel.click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/listings/5/cv')
    expect(el('tailored-cv-summary-input')).not.toBeNull()
  })

  describe('Generate PDF', () => {
    const generate = () => ops('GenerateCvDocument')
    const edit = async () => {
      const summary = el('tailored-cv-summary-input') as HTMLTextAreaElement
      summary.value = 'Edited summary'
      summary.dispatchEvent(new Event('input'))
      await flushPromises()
    }

    it('is hidden until a draft exists and appears after the first save', async () => {
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-summary-input')).not.toBeNull())
      expect(el('tailored-cv-generate')).toBeNull()
      await click('tailored-cv-save')
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      expect((el('tailored-cv-generate') as HTMLButtonElement).disabled).toBe(false)
    })

    it('is disabled with save-first guidance while edits are unsaved', async () => {
      savedDraft = savedSummary()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      expect((el('tailored-cv-generate') as HTMLButtonElement).disabled).toBe(false)
      await edit()
      expect((el('tailored-cv-generate') as HTMLButtonElement).disabled).toBe(true)
      expect(el('tailored-cv-pdf')!.textContent).toContain('Save your changes')
    })

    it('links each created PDF, refreshes the listing and keeps older ones', async () => {
      savedDraft = savedSummary()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      const listingFetches = () => calls.filter((c) => c.query.includes('query ListingById')).length
      const before = listingFetches()

      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('tailored-cv-generated')).not.toBeNull())
      expect(el('tailored-cv-generated')!.querySelector('a')!.getAttribute('href')).toBe(
        '/api/documents/70'
      )
      expect(listingFetches()).toBe(before + 1)

      await click('tailored-cv-generate')
      await vi.waitFor(() =>
        expect(el('tailored-cv-generated')!.querySelector('a')!.getAttribute('href')).toBe(
          '/api/documents/71'
        )
      )
      expect(generate()).toHaveLength(2)
      expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
    })

    it('previews the created PDF in a dialog and keeps Open PDF', async () => {
      savedDraft = savedSummary()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('tailored-cv-generated')).not.toBeNull())
      expect(el('cv-pdf-frame')).toBeNull()

      const view = [...el('tailored-cv-generated')!.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('View PDF')
      )!
      view.click()
      await vi.waitFor(() => expect(el('cv-pdf-frame')).not.toBeNull())
      expect(el('cv-pdf-frame')!.getAttribute('src')).toBe('/api/documents/70')
      expect(el('cv-pdf-open')!.getAttribute('href')).toBe('/api/documents/70')
    })

    it('asks to save first when the draft is gone and offers Back to listings when the listing is', async () => {
      savedDraft = savedSummary()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      generateReply = () => ({
        document: null,
        errors: [{ __typename: 'TailoredCvDraftNotFoundError', message: 'No draft' }]
      })
      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('tailored-cv-generate-error')).not.toBeNull())
      expect(el('tailored-cv-generate-error')!.textContent).toContain('Save the draft first')
      expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
      expect(el('tailored-cv-generate')).toBeNull()
    })

    it('shows the listing as unavailable', async () => {
      savedDraft = savedSummary()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      generateReply = () => ({
        document: null,
        errors: [{ __typename: 'ListingNotFoundError', message: 'Gone' }]
      })
      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('tailored-cv-generate-error')).not.toBeNull())
      expect(el('tailored-cv-generate-error')!.textContent).toContain('no longer available')
      expect(el('tailored-cv-generate-error')!.querySelector('a')!.getAttribute('href')).toBe(
        '/listings'
      )
    })
  })
})
