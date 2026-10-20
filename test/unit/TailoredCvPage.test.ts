import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { USelect } from '#components'
import CvPage from '~/pages/listings/[id]/cv.vue'
import { tailoredCvFromProfile, toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'
import { llmModels } from '../fixtures/llmModels'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

let savedDraft: unknown
let calls: Body[]
let releaseAnalysis: () => void
let analysisGate: Promise<void>
let fromProfileReply: unknown = undefined
let previewReply: unknown
let generateReply: () => unknown
let listing: Record<string, unknown> & { documents: Record<string, unknown>[] }
let appliedInput: Record<string, unknown> | undefined
// Replaces the default answer for a section request; undefined keeps the default.
let analysisOverride: (input: Record<string, unknown>) => unknown

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const { query } = body
    const input = body.variables?.input ?? {}
    if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    if (query.includes('query ListingById')) return { data: { listingById: listing } }
    if (query.includes('query Profile')) return { data: { profile: cvProfile() } }
    if (query.includes('query TailoredCvDraft(')) return { data: { tailoredCvDraft: savedDraft } }
    if (query.includes('mutation AnalyzeTailoredCvSection')) {
      await analysisGate
      const override = analysisOverride(input)
      if (override) return { data: { analyzeTailoredCvSection: override } }
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
    if (query.includes('query TailoredCvDraftFromProfile'))
      return {
        data: {
          tailoredCvDraftFromProfile:
            fromProfileReply === undefined
              ? toTailoredCvInput(tailoredCvFromProfile(cvProfile()))
              : fromProfileReply
        }
      }
    if (query.includes('mutation SaveTailoredCvDraft'))
      return {
        data: {
          saveTailoredCvDraft: {
            tailoredCvDraft: { id: 1, updatedAt: new Date().toISOString(), content: input.content },
            errors: null
          }
        }
      }
    if (query.includes('mutation GenerateCvDocument')) {
      const reply = generateReply() as { document: Record<string, unknown> | null }
      // Like the API: the new PDF is one of the listing's documents on the next fetch.
      if (reply.document) listing.documents.push({ ...reply.document, kind: 'CV', sentAt: null })
      return { data: { generateCvDocument: reply } }
    }
    if (query.includes('mutation DeleteDocument')) {
      const documentId = input.id
      listing.documents = listing.documents.filter((doc) => doc.id !== documentId)
      return { data: { deleteDocument: { id: documentId, errors: null } } }
    }
    if (query.includes('mutation ApplyToListing')) {
      appliedInput = input
      return { data: { applyToListing: { listing: { id: 5 }, errors: null } } }
    }
    if (query.includes('query TailoredCvExternalPrompt'))
      return { data: { tailoredCvExternalPrompt: { instructions: 'Tailor this CV' } } }
    return {
      data: {
        llmUsageToday: {
          model: 'fast',
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
  fromProfileReply = undefined
  appliedInput = undefined
  analysisOverride = () => undefined
  listing = {
    id: 5,
    title: 'Frontend Developer',
    status: 'SAVED',
    company: { id: 3, name: 'Acme' },
    documents: []
  }
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  let nextId = 70
  generateReply = () => ({
    document: { id: nextId++, fileName: 'cv.pdf', createdAt: new Date().toISOString() },
    errors: null
  })
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
    expect(el('tailored-cv-save-status')!.textContent).toBe('Not saved yet')
    expect(ops('AnalyzeTailoredCvSection')).toHaveLength(0)
    expect(el('tailored-cv-progress')).toBeNull()
  })

  it('optimizes the whole CV with built-in AI after showing usage, keeping the page readable', async () => {
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
    await click('tailored-cv-optimize')

    await vi.waitFor(() => expect(el('ai-usage-requests')?.textContent).toContain('3 of 50'))
    expect(el('tailored-cv-ai-requests')!.textContent).toContain('Makes 4 AI requests')
    expect(ops('AnalyzeTailoredCvSection')).toHaveLength(0)

    await click('tailored-cv-ai-run')
    await vi.waitFor(() => expect(el('tailored-cv-progress')).not.toBeNull())
    expect(el('tailored-cv-progress')!.textContent).toContain('Analyzing experience 1 of 1')
    expect(el('tailored-cv-overlay')).toBeNull()
    expect(
      (el('tailored-cv-summary-input') as HTMLTextAreaElement).closest('fieldset')!.disabled
    ).toBe(true)

    releaseAnalysis()
    await vi.waitFor(() => expect(el('tailored-cv-progress')).toBeNull())
    await flushPromises()

    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-skills-error')!.textContent).toContain('Model timed out')
    expect(ops('SaveTailoredCvDraft')).toHaveLength(0)

    // Closing or reloading the tab now gets the browser's leave warning.
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })

  it('runs the whole CV without a per-run model and links to Settings', async () => {
    releaseAnalysis()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
    await click('tailored-cv-optimize')
    await vi.waitFor(() => expect(el('tailored-cv-ai-usage')?.textContent).toContain('Fast'))
    expect(el('tailored-cv-ai-usage')!.querySelector('a')?.getAttribute('href')).toBe('/settings')
    await click('tailored-cv-ai-run')
    await vi.waitFor(() => expect(el('tailored-cv-progress')).toBeNull())

    expect(
      ops('AnalyzeTailoredCvSection').map((c) => (c.variables.input as { model?: string }).model)
    ).toEqual([undefined, undefined, undefined, undefined])
  })

  describe('analysis errors', () => {
    const safetyError = (code: string) => ({
      result: null,
      errors: [{ __typename: 'AiSafetyError', message: `Stopped: ${code}`, code }]
    })
    const runWholeCv = async () => {
      releaseAnalysis()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
      await click('tailored-cv-optimize')
      await click('tailored-cv-ai-run')
      await vi.waitFor(() => expect(el('tailored-cv-progress')).toBeNull())
      await flushPromises()
    }

    it('shows a skipped section with its code and still analyzes the rest', async () => {
      analysisOverride = (input) =>
        input.section === 'SKILLS'
          ? {
              result: {
                status: 'SKIPPED',
                section: 'SKILLS',
                sourceEntryId: null,
                selectedBulletIds: [],
                selectedSkillIds: [],
                summary: null,
                error: 'No skills to match',
                errorCode: 'no-input'
              },
              errors: null
            }
          : undefined
      await runWholeCv()

      expect(el('tailored-cv-skills-error')!.textContent).toContain('No skills to match (no-input)')
      expect(summaryValue()).toBe('Tailored summary')
    })

    it('stops at a reached daily limit, keeps earlier results and links to Settings', async () => {
      analysisOverride = (input) =>
        input.section === 'SKILLS' ? safetyError('daily-limit-reached') : undefined
      await runWholeCv()

      expect(ops('AnalyzeTailoredCvSection').map((c) => c.variables.input!.section)).toEqual([
        'EXPERIENCE',
        'PROJECT',
        'SKILLS'
      ])
      expect(el('tailored-cv-skills-error')!.textContent).toContain('Stopped: daily-limit-reached')
      expect(el('tailored-cv-ai-error')!.querySelector('a')?.getAttribute('href')).toBe('/settings')
      expect(el('tailored-cv-entry-error')).toBeNull()
    })

    it('asks before repeating an interrupted run, with new request ids', async () => {
      analysisOverride = (input) =>
        input.section === 'EXPERIENCE' && ops('AnalyzeTailoredCvSection').length === 1
          ? safetyError('operation-interrupted')
          : undefined
      await runWholeCv()

      expect(ops('AnalyzeTailoredCvSection')).toHaveLength(1)
      expect(el('ai-retry-confirm')!.textContent).toContain('Stopped: operation-interrupted')
      await click('tailored-cv-optimize')
      await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
      expect((el('tailored-cv-ai-run') as HTMLButtonElement).disabled).toBe(true)
      document.body.querySelector<HTMLElement>('[role="dialog"] button')?.click()
      await flushPromises()

      await click('ai-retry-confirm-run')
      await vi.waitFor(() => expect(ops('AnalyzeTailoredCvSection')).toHaveLength(5))
      const ids = ops('AnalyzeTailoredCvSection').map((c) => c.variables.input!.requestId)
      expect(new Set(ids).size).toBe(5)
      await vi.waitFor(() => expect(el('ai-retry-confirm')).toBeNull())
    })
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
    expect(el('tailored-cv-suggestions')!.textContent).toContain('1 suggestion to review')
    expect(el('tailored-cv-pending')!.textContent).toContain('1 suggestion to review')
    expect((el('tailored-cv-generate') as HTMLButtonElement).disabled).toBe(false)
    await click('tailored-cv-accept')
    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-suggestions')).toBeNull()
    expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
  })

  it('optimizes one project with AI and offers its technologies as a suggestion', async () => {
    savedDraft = savedSummary()
    releaseAnalysis()
    analysisOverride = (input) =>
      input.section === 'PROJECT'
        ? {
            result: {
              status: 'SUCCEEDED',
              section: 'PROJECT',
              sourceEntryId: input.sourceEntryId,
              selectedBulletIds: [200],
              selectedSkillIds: [],
              summary: null,
              technologies: ['Nuxt'],
              error: null
            },
            errors: null
          }
        : undefined
    await mountPage()
    const projects = () => el('tailored-cv-projects')!
    await vi.waitFor(() => expect(el('tailored-cv-projects')).not.toBeNull())
    projects().querySelector<HTMLElement>('[data-testid="tailored-cv-entry-analyze"]')!.click()
    await flushPromises()
    await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
    await click('tailored-cv-ai-run')

    await vi.waitFor(() =>
      expect(projects().querySelector('[data-testid="tailored-cv-suggestion"]')).not.toBeNull()
    )
    expect(ops('AnalyzeTailoredCvSection').map((c) => c.variables.input)).toMatchObject([
      { section: 'PROJECT', sourceEntryId: 20 }
    ])
    expect(projects().textContent).toContain('Technologies: Nuxt')
    projects().querySelector<HTMLElement>('[data-testid="tailored-cv-accept"]')!.click()
    await flushPromises()
    expect(
      projects().querySelector('[data-testid="tailored-cv-entry-technologies"]')!.textContent
    ).toContain('Nuxt')
  })

  it('accepts every pending suggestion at once', async () => {
    savedDraft = savedSummary()
    releaseAnalysis()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-analyze')).not.toBeNull())
    await click('tailored-cv-summary-analyze')
    await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
    await click('tailored-cv-ai-run')
    await vi.waitFor(() => expect(el('tailored-cv-suggestions')).not.toBeNull())

    const acceptAll = [...el('tailored-cv-suggestions')!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Accept all')
    )!
    acceptAll.click()
    await flushPromises()
    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-suggestions')).toBeNull()
  })

  it('reopens on the AI used last, with both choices still offered', async () => {
    savedDraft = savedSummary()
    releaseAnalysis()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-analyze')).not.toBeNull())
    await click('tailored-cv-summary-analyze')
    await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
    await click('tailored-cv-ai-run')
    await vi.waitFor(() => expect(el('tailored-cv-suggestion')).not.toBeNull())

    await click('tailored-cv-optimize')
    await vi.waitFor(() => expect(el('tailored-cv-ai-usage')).not.toBeNull())
    const tabs = [...document.body.querySelectorAll('button[role="tab"]')]
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Built-in AI', 'Your own AI'])
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(el('tailored-cv-ai-requests')!.textContent).toContain('Makes 4 AI requests')
  })

  it('opens a saved draft and saves the complete edited candidate', async () => {
    savedDraft = savedSummary()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-input')).not.toBeNull())
    expect(el('tailored-cv-save-status')!.textContent).toBe('Draft saved')

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
    await vi.waitFor(() => expect(el('tailored-cv-save-status')!.textContent).toBe('Draft saved'))
  })

  it('saves the chosen PDF layout with the draft', async () => {
    savedDraft = savedSummary()
    const wrapper = await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-section-order')).not.toBeNull())
    expect(el('tailored-cv-section-order')!.textContent).toContain('Standard')

    wrapper
      .findAllComponents(USelect)
      .find((s) => s.vm.$attrs['data-testid'] === 'tailored-cv-section-order')!
      .vm.$emit('update:modelValue', 'DEVELOPER')
    await flushPromises()
    expect(el('tailored-cv-save-status')!.textContent).not.toBe('Draft saved')
    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))

    expect(ops('SaveTailoredCvDraft')[0]!.variables.input).toMatchObject({
      content: { sectionOrder: 'DEVELOPER', summary: 'Mine' }
    })
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
      (b) => b.textContent?.includes('Your own AI')
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
    expect(el('tailored-cv-save-status')!.textContent).toBe('Draft saved')
    vi.unstubAllGlobals()
  })

  it('asks before leaving with unsaved changes, and Cancel keeps the page and edits', async () => {
    // Rendered through RouterView, so the page's route-leave guard is registered like in the app.
    const wrapper = await mountSuspended(defineComponent({ render: () => h(RouterView) }), {
      route: '/listings/5/cv',
      attachTo: document.body
    })
    mounted.push(wrapper)
    await vi.waitFor(() => expect(el('tailored-cv-save-status')?.textContent).toBe('Not saved yet'))

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

  it('resets a saved draft to the profile after confirming, without saving', async () => {
    savedDraft = savedSummary()
    savedDraft.content.contentStyle = 'PARAGRAPH'
    savedDraft.content.sectionOrder = 'DEVELOPER'
    savedDraft.content.referencesOnRequest = true
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))
    expect((el('tailored-cv-reset') as HTMLButtonElement).disabled).toBe(false)

    await click('tailored-cv-reset')
    expect(document.body.textContent).toContain('Reset to your profile?')
    expect(summaryValue()).toBe('Mine')
    const confirm = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Reset'
    )!
    confirm.click()
    await vi.waitFor(() => expect(summaryValue()).not.toBe('Mine'))

    expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
    expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
    expect(calls.some((c) => c.query.includes('query TailoredCvDraftFromProfile'))).toBe(true)

    // The owner's toggles survive the reset and go out unchanged on Save.
    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))
    expect(ops('SaveTailoredCvDraft')[0]!.variables.input.content).toMatchObject({
      contentStyle: 'PARAGRAPH',
      sectionOrder: 'DEVELOPER',
      referencesOnRequest: true
    })
  })

  it('keeps the edits when the API has no profile CV for the listing', async () => {
    savedDraft = savedSummary()
    fromProfileReply = null
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))

    await click('tailored-cv-reset')
    ;[...document.body.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Reset')!
      .click()
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('Reset to your profile?')
    )
    expect(summaryValue()).toBe('Mine')
    expect(el('tailored-cv-save-status')!.textContent).toBe('Draft saved')
  })

  describe('Generate PDF', () => {
    const generate = () => ops('GenerateCvDocument')
    const edit = async () => {
      const summary = el('tailored-cv-summary-input') as HTMLTextAreaElement
      summary.value = 'Edited summary'
      summary.dispatchEvent(new Event('input'))
      await flushPromises()
    }
    // A saved draft with a PDF made after it, as after a reload.
    const currentPdf = () => {
      savedDraft = savedSummary()
      listing.documents = [
        {
          id: 60,
          kind: 'CV',
          fileName: 'tailored.pdf',
          createdAt: '2026-10-12T11:00:00Z',
          sentAt: null
        }
      ]
    }

    it('saves unsaved work first, then generates and opens the preview', async () => {
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      expect((el('tailored-cv-generate') as HTMLButtonElement).disabled).toBe(false)
      const listingFetches = () => calls.filter((c) => c.query.includes('query ListingById')).length
      const before = listingFetches()

      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(ops('SaveTailoredCvDraft')).toHaveLength(1)
      expect(generate()).toHaveLength(1)
      expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/70')
      await vi.waitFor(() => expect(listingFetches()).toBe(before + 1))

      // The PDF now matches the draft: the next step is applying, not another PDF.
      expect(el('tailored-cv-generate')).toBeNull()
      expect(el('tailored-cv-preview-pdf')).not.toBeNull()
      expect(el('tailored-cv-apply')).not.toBeNull()
      expect(el('tailored-cv-latest-pdf')!.textContent).toContain('cv.pdf')
    })

    it('shows a current PDF after a reload, and offers Generate again once edited', async () => {
      currentPdf()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-apply')).not.toBeNull())
      expect(el('tailored-cv-generate')).toBeNull()
      expect(el('tailored-cv-latest-pdf')!.textContent).toContain('tailored.pdf')
      expect(el('tailored-cv-latest-pdf')!.textContent).not.toContain('older than the draft')

      await edit()
      expect(el('tailored-cv-apply')).toBeNull()
      expect((el('tailored-cv-generate') as HTMLButtonElement).disabled).toBe(false)
      expect(el('tailored-cv-latest-pdf')!.textContent).toContain('older than the draft')
    })

    it('deletes an unsent PDF after confirmation and refreshes the listing', async () => {
      currentPdf()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-delete-pdf')).not.toBeNull())

      await click('tailored-cv-delete-pdf')
      await vi.waitFor(() =>
        expect(el('confirm-modal-confirm')?.textContent).toContain('Delete PDF')
      )
      await click('confirm-modal-confirm')
      await vi.waitFor(() => expect(el('tailored-cv-latest-pdf')).toBeNull())

      expect(ops('DeleteDocument')).toHaveLength(1)
      expect(ops('DeleteDocument')[0]!.variables.input).toEqual({ id: 60 })
    })

    it('does not show the delete action for a sent PDF', async () => {
      savedDraft = savedSummary()
      listing.documents = [
        {
          id: 60,
          kind: 'CV',
          fileName: 'sent.pdf',
          createdAt: '2026-10-12T11:00:00Z',
          sentAt: '2026-10-12T12:00:00Z'
        }
      ]
      await mountPage()
      await flushPromises()

      expect(el('tailored-cv-delete-pdf')).toBeNull()
    })

    it('applies with the PDF selected, from the bar or the preview', async () => {
      currentPdf()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-preview-pdf')).not.toBeNull())
      await click('tailored-cv-preview-pdf')
      await vi.waitFor(() => expect(el('cv-pdf-apply')).not.toBeNull())
      await click('cv-pdf-apply')

      await vi.waitFor(() => expect(el('confirm-modal-confirm')).not.toBeNull())
      expect(el('cv-pdf-download')).toBeNull()
      await click('confirm-modal-confirm')
      await vi.waitFor(() => expect(appliedInput).toMatchObject({ cvDocumentId: 60 }))
    })

    it('offers no Apply once the listing is past Saved', async () => {
      currentPdf()
      listing.status = 'APPLIED'
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-preview-pdf')).not.toBeNull())
      expect(el('tailored-cv-apply')).toBeNull()
      await click('tailored-cv-preview-pdf')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(el('cv-pdf-apply')).toBeNull()
    })

    it('treats a missing draft as unsaved, and offers Back to listings when the listing is gone', async () => {
      savedDraft = savedSummary()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-generate')).not.toBeNull())
      generateReply = () => ({
        document: null,
        errors: [{ __typename: 'TailoredCvDraftNotFoundError', message: 'No draft' }]
      })
      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('tailored-cv-generate-error')).not.toBeNull())
      expect(el('tailored-cv-generate-error')!.textContent).toContain('Generate PDF saves it again')
      expect(el('tailored-cv-save-status')!.textContent).toBe('Not saved yet')

      generateReply = () => ({
        document: null,
        errors: [{ __typename: 'ListingNotFoundError', message: 'Gone' }]
      })
      await click('tailored-cv-generate')
      await vi.waitFor(() =>
        expect(el('tailored-cv-generate-error')!.textContent).toContain('no longer available')
      )
      expect(el('tailored-cv-generate-error')!.querySelector('a')!.getAttribute('href')).toBe(
        '/listings'
      )
    })
  })
})
