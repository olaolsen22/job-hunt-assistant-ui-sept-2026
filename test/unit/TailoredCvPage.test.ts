import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { USelect } from '#components'
import CvPage from '~/pages/listings/[id]/cv.vue'
import { toTailoredCvInput } from '~/utils/tailoredCv'
import { tailoredCvFromProfile } from '../fixtures/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'
import { llmModels } from '../fixtures/llmModels'

type Body = {
  query: string
  variables: { input?: Record<string, unknown>; language?: 'ENGLISH' | 'NORWEGIAN' }
}

let prefillFails = false
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
let groupsReply: unknown

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
              headline: input.section === 'SUMMARY' ? 'Tailored headline' : null,
              error: input.section === 'SKILLS' ? 'Model timed out' : null
            },
            errors: null
          }
        }
      }
    }
    if (query.includes('query TailoredCvSkillGroupPrompt'))
      return { data: { tailoredCvSkillGroupPrompt: { instructions: 'Group these skills' } } }
    if (query.includes('mutation SuggestTailoredCvSkillGroups'))
      return { data: { suggestTailoredCvSkillGroups: groupsReply } }
    if (query.includes('mutation PreviewTailoredCvDraft'))
      return { data: { previewTailoredCvDraft: previewReply } }
    if (query.includes('query TailoredCvDraftFromProfile') && prefillFails)
      return { data: null, errors: [{ message: 'Prefill failed' }] }
    if (query.includes('query TailoredCvDraftFromProfile'))
      return {
        data: {
          tailoredCvDraftFromProfile:
            fromProfileReply === undefined
              ? toTailoredCvInput(
                  tailoredCvFromProfile(cvProfile(), body.variables?.language ?? 'ENGLISH')
                )
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
// A radio group option, found by its label.
const radio = (group: string, label: string) => {
  const match = [...el(group)!.querySelectorAll('label')].find(
    (l) => l.textContent?.trim() === label
  )!
  return document.getElementById(match.htmlFor) as HTMLButtonElement
}
const checkedRadio = (group: string) => {
  const checked = el(group)!.querySelector('[role="radio"][aria-checked="true"]')!
  return el(group)!.querySelector(`label[for="${checked.id}"]`)?.textContent?.trim()
}
const summaryValue = () => el('tailored-cv-summary-text')?.textContent?.trim() ?? ''
const click = async (id: string) => {
  el(id)!.click()
  await flushPromises()
}
const type = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}
const buttonNamed = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!
// Edits go through the section's modal and land in the draft on Apply.
const editSummary = async (text: string) => {
  await click('tailored-cv-summary-edit')
  await vi.waitFor(() => expect(el('tailored-cv-summary-input')).not.toBeNull())
  await type(el('tailored-cv-summary-input') as HTMLTextAreaElement, text)
  await click('form-modal-save')
  await vi.waitFor(() => expect(summaryValue()).toBe(text))
}

const ops = (name: string) => calls.filter((c) => c.query.includes(`mutation ${name}`))
const within = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const reviewStatus = () => el('tailored-cv-review-status')?.textContent?.trim()
// The style and layout radios live in the settings panel.
const openSettings = async () => {
  await click('tailored-cv-settings-open')
  await vi.waitFor(() => expect(el('tailored-cv-template')).not.toBeNull())
}
// The tailored CV lists skills read-only; their groups are only visible in the Edit skills modal.
const groupsInModal = async () => {
  await click('tailored-cv-skills-edit')
  await vi.waitFor(() => expect(el('tailored-cv-skills-modal')).not.toBeNull())
  const groups = [
    ...document.body.querySelectorAll<HTMLInputElement>(
      '[data-testid="tailored-cv-skills-modal"] input[data-testid="tailored-cv-skill-group"], [data-testid="tailored-cv-skills-modal"] [data-testid="tailored-cv-skill-group"] input'
    )
  ].map((input) => input.value)
  await click('form-modal-cancel')
  await vi.waitFor(() => expect(el('tailored-cv-skills-modal')).toBeNull())
  return groups
}
const cardSkills = () =>
  [...el('tailored-cv-skills')!.querySelectorAll('[data-testid="tailored-cv-skill"]')].map((s) =>
    s.textContent?.trim()
  )
// Runs the whole-CV built-in analysis on the mounted page and waits until it is done.
const runWholeCvNow = async () => {
  releaseAnalysis()
  await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
  await click('tailored-cv-optimize')
  await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
  await click('tailored-cv-ai-run')
  await vi.waitFor(() => expect(el('tailored-cv-review-bar')).not.toBeNull())
  await vi.waitFor(() => expect(el('tailored-cv-progress')).toBeNull())
  await flushPromises()
}
// Pastes a reply in the own-AI tab of the whole-CV dialog.
const pasteOwnAiReply = async () => {
  await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
  await click('tailored-cv-optimize')
  const external = [...document.body.querySelectorAll<HTMLElement>('button[role="tab"]')].find(
    (b) => b.textContent?.includes('Your own AI')
  )!
  external.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  await flushPromises()
  await vi.waitFor(() =>
    expect((el('tailored-cv-copy-prompt') as HTMLButtonElement).disabled).toBe(false)
  )
  await click('tailored-cv-copy-prompt')
  const json = el('tailored-cv-json') as HTMLTextAreaElement
  json.value = '{"content":{}}'
  json.dispatchEvent(new Event('input'))
  await flushPromises()
  await click('tailored-cv-preview')
}

// Opens a menu from the keyboard (Reka opens it on pointerdown, not click) and finds an item.
const menuItem = async (trigger: HTMLElement, label: string) => {
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await flushPromises()
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent?.trim() === label
  )!
}
const chooseMenuItem = async (trigger: HTMLElement, label: string) => {
  ;(await menuItem(trigger, label)).click()
  await flushPromises()
}
const confirmReset = () =>
  [...document.body.querySelectorAll('button')]
    .find((b) => b.textContent?.trim() === 'Reset to profile')!
    .click()

beforeEach(() => {
  clearNuxtData()
  calls = []
  savedDraft = null
  prefillFails = false
  previewReply = null
  fromProfileReply = undefined
  appliedInput = undefined
  analysisOverride = () => undefined
  groupsReply = null
  listing = {
    id: 5,
    title: 'Frontend Developer',
    status: 'SAVED',
    company: { id: 3, name: 'Acme' },
    documents: []
  }
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  // A successful own-AI run writes the method through the shared cookie ref, which outlives the DOM cookie.
  useAiMethod().value = null
  let nextId = 70
  generateReply = () => ({
    document: { id: nextId++, fileName: 'cv.pdf', createdAt: new Date().toISOString() },
    errors: null
  })
  analysisGate = new Promise((resolve) => (releaseAnalysis = resolve))
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.restoreAllMocks()
})

describe('Tailored CV page', () => {
  it('puts Back to the listing in the navbar', async () => {
    await mountPage()
    expect(useBackLinkState().value).toEqual({
      path: '/listings/5/cv',
      to: '/listings/5',
      label: 'Listing'
    })
  })

  it('opens prefilled from the profile without running AI', async () => {
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-edit')).not.toBeNull())
    expect(el('tailored-cv-contact')!.textContent).toContain('Existing owner')
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
    expect(el('tailored-cv-summary-edit')!.closest('fieldset')!.disabled).toBe(true)

    releaseAnalysis()
    await vi.waitFor(() => expect(el('tailored-cv-progress')).toBeNull())
    await flushPromises()

    // Even a new, unedited CV keeps the profile content: each change waits as a suggestion.
    expect(summaryValue()).toBe('')
    expect(el('tailored-cv-summary')!.textContent).toContain('Tailored summary')
    expect(el('tailored-cv-summary')!.textContent).toContain('AI change')
    // The summary step's headline is offered with it, on the contact card.
    expect(el('tailored-cv-contact')!.textContent).toContain('Tailored headline')
    expect(el('tailored-cv-contact')!.textContent).toContain('Engineer')
    expect(el('tailored-cv-skills-error')!.textContent).toContain('Model timed out')
    expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
    // The review bar replaces Save draft and the PDF action until every change is reviewed.
    // Headline, summary, and the experience and project bullets the reply leaves out.
    expect(reviewStatus()).toBe('4 AI changes to review')
    expect(el('tailored-cv-save')).toBeNull()
    expect(el('tailored-cv-generate')).toBeNull()
  })

  it('runs the whole CV without a per-run model and links to Settings', async () => {
    releaseAnalysis()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-optimize')).not.toBeNull())
    await click('tailored-cv-optimize')
    await vi.waitFor(() => expect(el('tailored-cv-ai-usage')?.textContent).toContain('Fast'))
    expect(el('tailored-cv-ai-usage')!.querySelector('a')?.getAttribute('href')).toBe(
      '/settings#model'
    )
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
      expect(el('tailored-cv-summary')!.textContent).toContain('Tailored summary')
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
      expect(el('tailored-cv-ai-error')!.querySelector('a')?.getAttribute('href')).toBe(
        '/settings#keys'
      )
      expect(el('tailored-cv-entry-error')).toBeNull()
    })

    it('asks before repeating an interrupted run, with new request ids', async () => {
      analysisOverride = (input) =>
        input.section === 'EXPERIENCE' && ops('AnalyzeTailoredCvSection').length === 1
          ? safetyError('operation-interrupted')
          : undefined
      await runWholeCv()

      expect(ops('AnalyzeTailoredCvSection')).toHaveLength(1)
      // The modal reopens where the run started, with the confirm instead of a plain run.
      await vi.waitFor(() => expect(el('ai-retry-confirm')).not.toBeNull())
      expect(el('ai-retry-confirm')!.textContent).toContain('Stopped: operation-interrupted')
      expect((el('tailored-cv-ai-run') as HTMLButtonElement).disabled).toBe(true)

      // Another section's AI button still offers the retry of the run that failed.
      await click('ai-modal-cancel')
      await click('tailored-cv-summary-analyze')
      await vi.waitFor(() => expect(el('ai-retry-confirm')).not.toBeNull())
      expect(document.body.textContent).toContain('Tailor your CV with AI')

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
    // The suggestion stands in for the summary text, current and suggested side by side.
    const summary = el('tailored-cv-summary')!
    expect(summaryValue()).toBe('')
    expect(summary.textContent).toContain('Mine')
    expect(summary.textContent).toContain('Tailored summary')
    expect(within(summary, 'tailored-cv-dismiss')!.textContent?.trim()).toBe('Keep current')
    expect(within(summary, 'tailored-cv-accept')!.textContent?.trim()).toBe('Accept')
    // The summary step also suggests a headline.
    expect(reviewStatus()).toBe('2 AI changes to review')
    expect(el('tailored-cv-generate')).toBeNull()
    await click('tailored-cv-accept')
    await click('tailored-cv-accept')
    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-contact')!.textContent).toContain('Tailored headline')
    expect(el('tailored-cv-review-bar')).toBeNull()
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
    // Wider than a phone: Tailor is a visible button beside Edit.
    within(projects(), 'tailored-cv-entry-analyze')!.click()
    await flushPromises()
    await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
    await click('tailored-cv-ai-run')

    await vi.waitFor(() =>
      expect(projects().querySelector('[data-testid="tailored-cv-suggestion"]')).not.toBeNull()
    )
    expect(ops('AnalyzeTailoredCvSection').map((c) => c.variables.input)).toMatchObject([
      { section: 'PROJECT', sourceEntryId: 20 }
    ])
    const chips = [
      ...projects().querySelectorAll<HTMLElement>('[data-testid="tailored-cv-diff-chip"]')
    ]
    expect(chips.map((c) => c.dataset.kind)).toEqual(['added'])
    expect(chips[0]!.textContent).toMatch(/Nuxt\s*· Added/)
    projects().querySelector<HTMLElement>('[data-testid="tailored-cv-accept"]')!.click()
    await flushPromises()
    expect(
      projects().querySelector('[data-testid="tailored-cv-entry-technologies"]')!.textContent
    ).toContain('Nuxt')
  })

  it('accepts every pending suggestion at once from the review bar', async () => {
    savedDraft = savedSummary()
    releaseAnalysis()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-summary-analyze')).not.toBeNull())
    await click('tailored-cv-summary-analyze')
    await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
    await click('tailored-cv-ai-run')
    await vi.waitFor(() => expect(el('tailored-cv-review-bar')).not.toBeNull())

    expect(el('tailored-cv-review-accept')!.textContent?.trim()).toBe('Accept remaining (2)')
    await click('tailored-cv-review-accept')
    expect(summaryValue()).toBe('Tailored summary')
    expect(el('tailored-cv-contact')!.textContent).toContain('Tailored headline')
    expect(el('tailored-cv-review-bar')).toBeNull()
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
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))
    expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')

    await editSummary('Edited summary')
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
    await vi.waitFor(() =>
      expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')
    )
  })

  it('saves the chosen PDF layout with the draft', async () => {
    savedDraft = savedSummary()
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-settings-open')).not.toBeNull())
    await openSettings()
    expect(checkedRadio('tailored-cv-section-order')).toBe('Standard')

    radio('tailored-cv-section-order', 'Developer').click()
    await flushPromises()
    expect(el('tailored-cv-settings-summary')!.textContent?.trim()).toBe(
      'English · Detailed · Bullets · Developer layout'
    )
    expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))

    expect(ops('SaveTailoredCvDraft')[0]!.variables.input).toMatchObject({
      content: { sectionOrder: 'DEVELOPER', summary: 'Mine' }
    })
  })

  it('restores a Concise paragraph draft, and asks for a new run after switching', async () => {
    savedDraft = savedSummary()
    savedDraft.content.template = 'CONCISE'
    savedDraft.content.contentStyle = 'PARAGRAPH'
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-settings-summary')).not.toBeNull())
    expect(el('tailored-cv-settings-summary')!.textContent?.trim()).toBe(
      'English · Concise · Paragraphs · Standard layout'
    )
    await openSettings()
    expect(checkedRadio('tailored-cv-template')).toBe('Concise')
    // Concise prints paragraphs too, so the choice shows and stays editable.
    expect(checkedRadio('tailored-cv-content-style')).toBe('Paragraphs')
    expect(radio('tailored-cv-content-style', 'Bullets').disabled).toBe(false)
    expect(el('tailored-cv-template-changed')).toBeNull()

    radio('tailored-cv-template', 'Detailed').click()
    await flushPromises()
    // The style applies at once; the format is kept, and the entries wait for a new run.
    expect(checkedRadio('tailored-cv-content-style')).toBe('Paragraphs')
    expect(el('tailored-cv-settings-summary')!.textContent?.trim()).toBe(
      'English · Detailed · Paragraphs · Standard layout'
    )
    expect(el('tailored-cv-template-changed')!.textContent).toContain('Tailor CV with AI')
    expect(ops('AnalyzeTailoredCvSection')).toHaveLength(0)
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
    expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')
    vi.unstubAllGlobals()
  })

  it('offers an external reply per company, with a removal for a left-out one', async () => {
    // Three experiences (companies) in the saved draft; the reply rewords two and drops the third.
    const cv = tailoredCvFromProfile(cvProfile())
    const job = cv.experiences[0]!
    cv.experiences = [10, 11, 12].map((id) => ({
      ...structuredClone(job),
      sourceEntryId: id,
      employer: `Co ${id}`
    }))
    savedDraft = { id: 1, updatedAt: '2026-10-12T10:00:00Z', content: toTailoredCvInput(cv) }
    const reply = structuredClone(cv)
    reply.experiences = reply.experiences.slice(0, 2)
    reply.experiences[0]!.bullets[0]!.text = 'Reworded at Co 10'
    reply.experiences[1]!.bullets[0]!.text = 'Reworded at Co 11'
    previewReply = {
      candidate: { schemaVersion: 1, content: toTailoredCvInput(reply) },
      errors: null
    }
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } })
    await mountPage()
    await pasteOwnAiReply()

    const entries = () => [
      ...el('tailored-cv-experience')!.querySelectorAll<HTMLElement>(
        '[data-testid="tailored-cv-entry"]'
      )
    ]
    await vi.waitFor(() =>
      expect(
        entries().filter((e) => e.querySelector('[data-testid="tailored-cv-suggestion"]'))
      ).toHaveLength(3)
    )
    expect(el('tailored-cv-experience')!.textContent).not.toContain('All experience')
    expect(entries()[0]!.textContent).toContain('Reworded at Co 10')
    // The left-out company is dimmed, with Keep in CV and Remove.
    expect(entries()[2]!.textContent).toContain('The AI suggests leaving this out')
    expect(within(entries()[2]!, 'tailored-cv-dismiss')!.textContent?.trim()).toBe('Keep in CV')
    expect(within(entries()[2]!, 'tailored-cv-accept')!.textContent?.trim()).toBe('Remove')
    const dimmed = [...entries()[2]!.querySelectorAll('.opacity-50')].map((d) => d.textContent)
    expect(dimmed.join(' ')).toContain('Co 12')
    expect(dimmed.join(' ')).toContain('Existing bullet')
    expect(reviewStatus()).toBe('3 AI changes to review')

    // Accepting the first company changes only it; removing the third drops only that one.
    entries()[0]!.querySelector<HTMLElement>('[data-testid="tailored-cv-accept"]')!.click()
    await flushPromises()
    entries()[2]!.querySelector<HTMLElement>('[data-testid="tailored-cv-accept"]')!.click()
    await flushPromises()
    expect(entries()).toHaveLength(2)
    expect(entries()[0]!.querySelector('[data-testid="tailored-cv-suggestion"]')).toBeNull()
    expect(entries()[1]!.querySelector('[data-testid="tailored-cv-suggestion"]')).not.toBeNull()
    vi.unstubAllGlobals()
  })

  it('splits a reordered own-AI reply per company, with the new order as its own small change', async () => {
    const cv = tailoredCvFromProfile(cvProfile())
    const job = cv.experiences[0]!
    cv.experiences = [10, 11].map((id) => ({
      ...structuredClone(job),
      sourceEntryId: id,
      employer: `Co ${id}`
    }))
    savedDraft = { id: 1, updatedAt: '2026-10-12T10:00:00Z', content: toTailoredCvInput(cv) }
    const reply = structuredClone(cv)
    reply.experiences.reverse()
    reply.experiences[0]!.bullets[0]!.text = 'Reworded at Co 11'
    previewReply = {
      candidate: { schemaVersion: 1, content: toTailoredCvInput(reply) },
      errors: null
    }
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } })
    await mountPage()
    await pasteOwnAiReply()

    const experience = () => el('tailored-cv-experience')!
    await vi.waitFor(() => expect(reviewStatus()).toBe('2 AI changes to review'))
    expect(experience().textContent).not.toContain('All experience')
    // The reworded company is reviewed on its own entry; the order is a numbered list of names.
    const entries = [...experience().querySelectorAll('[data-testid="tailored-cv-entry"]')]
    expect(entries[1]!.textContent).toContain('Reworded at Co 11')
    expect(experience().textContent).toContain('New order')
    expect(experience().textContent).toContain(`1. ${job.title} at Co 11`)

    // Accept the company, then the order: Co 11 comes first and keeps its new bullet.
    within(entries[1] as HTMLElement, 'tailored-cv-accept')!.click()
    await flushPromises()
    within(experience(), 'tailored-cv-accept')!.click()
    await flushPromises()
    const after = [...experience().querySelectorAll('[data-testid="tailored-cv-entry"]')]
    expect(after[0]!.textContent).toContain('Co 11')
    expect(after[0]!.textContent).toContain('Reworded at Co 11')
    expect(el('tailored-cv-save-bar')).not.toBeNull()
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
    expect(el('tailored-cv-summary-edit')).not.toBeNull()
  })

  it('resets a saved draft to the profile after confirming, without saving', async () => {
    savedDraft = savedSummary()
    savedDraft.content.contentStyle = 'PARAGRAPH'
    savedDraft.content.sectionOrder = 'DEVELOPER'
    savedDraft.content.template = 'CONCISE'
    savedDraft.content.referencesOnRequest = true
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))
    const reset = await menuItem(el('tailored-cv-more')!, 'Reset to profile…')
    expect(reset.hasAttribute('data-disabled')).toBe(false)

    reset.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Reset to your profile?')
    expect(summaryValue()).toBe('Mine')
    confirmReset()
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
      template: 'CONCISE',
      referencesOnRequest: true
    })
  })

  it('starts a new CV from the API prefill, and needs it only when there is no saved draft', async () => {
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-save-status')).not.toBeNull())
    expect(calls.some((c) => c.query.includes('query Profile '))).toBe(false)
    for (const wrapper of mounted.splice(0)) wrapper.unmount()

    clearNuxtData()
    prefillFails = true
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-load-error')).not.toBeNull())
    for (const wrapper of mounted.splice(0)) wrapper.unmount()

    clearNuxtData()
    savedDraft = savedSummary()
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))
    expect(el('tailored-cv-load-error')).toBeNull()
  })

  it('rebuilds an edited CV in another language only after Rebuild and a confirm, and saves that language', async () => {
    savedDraft = savedSummary()
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))
    const fromProfile = () =>
      calls.filter((c) => c.query.includes('query TailoredCvDraftFromProfile'))
    // The page's own prefill, for the Add menus.
    await vi.waitFor(() => expect(fromProfile()).toHaveLength(1))
    await openSettings()
    expect(checkedRadio('tailored-cv-language')).toBe('English')

    // Picking a language only warns; the CV stays in English.
    radio('tailored-cv-language', 'Norwegian').click()
    await flushPromises()
    const warning = el('tailored-cv-language-warning')!
    expect(warning.textContent).toContain('rebuilds this CV from your Norwegian profile')
    expect(fromProfile()).toHaveLength(1)
    expect(summaryValue()).toBe('Mine')
    expect(el('tailored-cv-settings-summary')!.textContent).toContain('English')

    // A saved draft has something to lose, so Rebuild asks; Cancel keeps it as it was.
    const rebuildButton = () =>
      [...el('tailored-cv-language-warning')!.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Rebuild in Norwegian'
      )!
    rebuildButton().click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Rebuild in Norwegian?'))
    expect(el('confirm-modal-confirm')!.textContent?.trim()).toBe('Rebuild in Norwegian')
    buttonNamed('Cancel').click()
    await flushPromises()
    expect(fromProfile()).toHaveLength(1)
    expect(summaryValue()).toBe('Mine')

    // Rebuild closed the panel so the confirm modal isn't stuck underneath it; reopen to try again.
    expect(el('tailored-cv-language-warning')).toBeNull()
    await openSettings()
    radio('tailored-cv-language', 'Norwegian').click()
    await flushPromises()
    rebuildButton().click()
    await vi.waitFor(() => expect(el('confirm-modal-confirm')).not.toBeNull())
    await click('confirm-modal-confirm')
    await vi.waitFor(() =>
      expect(el('tailored-cv-settings-summary')!.textContent).toContain('Norwegian')
    )
    expect(fromProfile().at(-1)!.variables).toEqual({ listingId: 5, language: 'NORWEGIAN' })
    expect(summaryValue()).not.toBe('Mine')
    await openSettings()
    expect(checkedRadio('tailored-cv-language')).toBe('Norwegian')
    expect(el('tailored-cv-language-warning')).toBeNull()
    expect(ops('SaveTailoredCvDraft')).toHaveLength(0)

    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))
    expect(ops('SaveTailoredCvDraft')[0]!.variables.input.content).toMatchObject({
      language: 'NORWEGIAN'
    })
  })

  it('rebuilds an untouched new CV in another language without asking', async () => {
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-settings-summary')).not.toBeNull())
    expect(el('tailored-cv-settings-summary')!.textContent?.trim()).toBe(
      'English · Detailed · Bullets · Standard layout'
    )
    await openSettings()
    radio('tailored-cv-language', 'Norwegian').click()
    await flushPromises()
    ;[...el('tailored-cv-language-warning')!.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Rebuild in Norwegian')!
      .click()
    await vi.waitFor(() =>
      expect(el('tailored-cv-settings-summary')!.textContent?.trim()).toBe(
        'Norwegian · Detailed · Bullets · Standard layout'
      )
    )
    expect(document.body.textContent).not.toContain('Rebuild in Norwegian?')
    expect(
      calls.filter((c) => c.query.includes('query TailoredCvDraftFromProfile')).at(-1)!.variables
    ).toEqual({ listingId: 5, language: 'NORWEGIAN' })
    expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
  })

  describe('skill groups', () => {
    // A Developer-order draft: Vue without a group, Nuxt already grouped.
    const developerDraft = () => {
      savedDraft = savedSummary()
      savedDraft.content.sectionOrder = 'DEVELOPER'
      savedDraft.content.skills = [
        { name: 'Vue', level: 4, sourceSkillId: 1, categoryId: null, group: null },
        { name: 'Nuxt', level: null, sourceSkillId: null, categoryId: null, group: 'Frameworks' }
      ]
    }

    it('fills in suggested groups for review, keeping skills the AI left out, and saves them', async () => {
      developerDraft()
      groupsReply = {
        result: { status: 'SUCCEEDED', error: null, groups: [{ name: 'Vue', group: 'Frontend' }] },
        errors: null
      }
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-suggest-groups')).not.toBeNull())
      expect(await groupsInModal()).toEqual(['', 'Frameworks'])

      await click('tailored-cv-suggest-groups')
      await vi.waitFor(() => expect(el('skill-groups-run')).not.toBeNull())
      await click('skill-groups-run')
      await vi.waitFor(() =>
        expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
      )
      expect(await groupsInModal()).toEqual(['Frontend', 'Frameworks'])
      expect(ops('SuggestTailoredCvSkillGroups')[0]!.variables).toMatchObject({
        skillNames: ['Vue', 'Nuxt'],
        language: 'ENGLISH'
      })
      expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
      expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')

      await click('tailored-cv-save')
      await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))
      expect(ops('SaveTailoredCvDraft')[0]!.variables.input.content).toMatchObject({
        skills: [
          { name: 'Vue', group: 'Frontend' },
          { name: 'Nuxt', group: 'Frameworks' }
        ]
      })
    })

    it('shows why a suggestion failed and leaves the groups alone', async () => {
      developerDraft()
      groupsReply = {
        result: { status: 'FAILED', error: 'Model timed out', groups: null },
        errors: null
      }
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-suggest-groups')).not.toBeNull())

      await click('tailored-cv-suggest-groups')
      await vi.waitFor(() => expect(el('skill-groups-run')).not.toBeNull())
      await click('skill-groups-run')
      await vi.waitFor(() =>
        expect(el('skill-groups-error')!.textContent).toContain('Model timed out')
      )
      await click('ai-modal-cancel')
      await flushPromises()
      expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')
      expect(await groupsInModal()).toEqual(['', 'Frameworks'])
    })

    it('fills in groups from a pasted own-AI reply in a code fence, ignoring unknown names', async () => {
      developerDraft()
      document.cookie = 'ai-method=own; path=/'
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-suggest-groups')).not.toBeNull())

      await click('tailored-cv-suggest-groups')
      await vi.waitFor(() => expect(el('skill-groups-json')).not.toBeNull())
      const prompt = calls.find((c) => c.query.includes('query TailoredCvSkillGroupPrompt'))!
      expect(prompt.variables).toEqual({ skillNames: ['Vue', 'Nuxt'], language: 'ENGLISH' })

      await type(
        el('skill-groups-json') as HTMLTextAreaElement,
        '```json\n{"groups":[{"name":"Vue","group":"Frontend"},{"name":"Go","group":"Backend"}]}\n```'
      )
      await click('skill-groups-apply')
      await vi.waitFor(() =>
        expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
      )
      expect(await groupsInModal()).toEqual(['Frontend', 'Frameworks'])
      expect(ops('SuggestTailoredCvSkillGroups')).toHaveLength(0)
    })

    it('says what is wrong with a pasted reply without a groups list', async () => {
      developerDraft()
      document.cookie = 'ai-method=own; path=/'
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-suggest-groups')).not.toBeNull())

      await click('tailored-cv-suggest-groups')
      await vi.waitFor(() => expect(el('skill-groups-json')).not.toBeNull())
      await type(el('skill-groups-json') as HTMLTextAreaElement, 'Sorry, I cannot help.')
      await click('skill-groups-apply')
      await vi.waitFor(() => expect(document.body.textContent).toContain('"groups" list'))
      await click('ai-modal-cancel')
      await flushPromises()
      expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')
      expect(await groupsInModal()).toEqual(['', 'Frameworks'])
    })
  })

  it('keeps the edits when the API has no profile CV for the listing', async () => {
    savedDraft = savedSummary()
    fromProfileReply = null
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))

    await chooseMenuItem(el('tailored-cv-more')!, 'Reset to profile…')
    confirmReset()
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('Reset to your profile?')
    )
    expect(summaryValue()).toBe('Mine')
    expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')
  })

  it('removes an entry with Undo, and brings it back from the profile later', async () => {
    await mountPage()
    const experience = () => el('tailored-cv-experience')!
    const entries = () => experience().querySelectorAll('[data-testid="tailored-cv-entry"]')
    const actions = () =>
      experience().querySelector<HTMLElement>('[data-testid="tailored-cv-entry-actions"]')!
    await vi.waitFor(() => expect(entries()).toHaveLength(1))

    await chooseMenuItem(actions(), 'Remove from this CV')
    expect(entries()).toHaveLength(0)
    expect(el('tailored-cv-experience-empty')!.textContent).toContain('Use Add to bring it back')
    const toast = useToast().toasts.value.at(-1)!
    expect(toast.title).toBe('Removed Developer from this CV')
    toast.actions![0]!.onClick!(new MouseEvent('click'))
    await flushPromises()
    expect(entries()).toHaveLength(1)

    await chooseMenuItem(actions(), 'Remove from this CV')
    await chooseMenuItem(el('tailored-cv-experience-add')!, 'Developer at Acme')
    expect(entries()).toHaveLength(1)
    expect(experience().textContent).toContain('Developer')
    const none = await menuItem(
      el('tailored-cv-experience-add')!,
      'Everything from your profile is already here'
    )
    expect(none.hasAttribute('data-disabled')).toBe(true)
  })

  it('edits one entry in a modal and applies it to the draft', async () => {
    savedDraft = savedSummary()
    await mountPage()
    const experience = () => el('tailored-cv-experience')!
    await vi.waitFor(() => expect(experience().textContent).toContain('Developer'))
    const readBullets = experience().querySelectorAll('ul.list-disc li').length
    expect(readBullets).toBeGreaterThan(0)

    experience().querySelector<HTMLElement>('[data-testid="tailored-cv-entry-edit"]')!.click()
    await vi.waitFor(() => expect(el('tailored-cv-entry-modal')).not.toBeNull())
    const modal = el('tailored-cv-entry-modal')!
    expect(document.body.textContent).toContain('Edit experience')
    expect(modal.textContent).not.toContain('School')
    expect(modal.querySelectorAll('textarea[aria-label^="Bullet"]')).toHaveLength(readBullets)
    const title = [...modal.querySelectorAll('input')].find((i) => i.value === 'Developer')!

    await type(title, 'Lead developer')
    // Nothing reaches the page before Apply.
    expect(experience().textContent).not.toContain('Lead developer')
    await click('form-modal-save')
    await vi.waitFor(() => expect(experience().textContent).toContain('Lead developer'))
    expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')

    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))
    const content = ops('SaveTailoredCvDraft')[0]!.variables.input!.content as {
      experiences: { title: string; location: string | null }[]
    }
    expect(content.experiences[0]).toMatchObject({ title: 'Lead developer' })
  })

  it('asks before discarding modal changes, and an unchanged Apply keeps the draft saved', async () => {
    savedDraft = savedSummary()
    await mountPage()
    await vi.waitFor(() => expect(summaryValue()).toBe('Mine'))

    await click('tailored-cv-summary-edit')
    await vi.waitFor(() => expect(el('tailored-cv-summary-input')).not.toBeNull())
    await type(el('tailored-cv-summary-input') as HTMLTextAreaElement, 'Not kept')
    await click('form-modal-cancel')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Discard changes?'))
    buttonNamed('Discard').click()
    await flushPromises()
    expect(summaryValue()).toBe('Mine')

    el('tailored-cv-experience')!
      .querySelector<HTMLElement>('[data-testid="tailored-cv-entry-edit"]')!
      .click()
    await vi.waitFor(() => expect(el('tailored-cv-entry-modal')).not.toBeNull())
    await click('form-modal-save')
    expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')
  })

  it('edits the headline and languages in their modals', async () => {
    savedDraft = savedSummary()
    const wrapper = await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-contact-edit')).not.toBeNull())

    await click('tailored-cv-contact-edit')
    await vi.waitFor(() => expect(el('tailored-cv-headline')).not.toBeNull())
    await type(el('tailored-cv-headline') as HTMLInputElement, 'Frontend engineer')
    await click('form-modal-save')
    await vi.waitFor(() =>
      expect(el('tailored-cv-contact')!.textContent).toContain('Frontend engineer')
    )

    expect(el('tailored-cv-language-line')!.textContent).toContain('Norwegian · Spoken: Native')
    await click('tailored-cv-languages-edit')
    await vi.waitFor(() => expect(buttonNamed('Add language')).toBeDefined())
    buttonNamed('Add language').click()
    await flushPromises()
    const rows = document.body.querySelectorAll('[data-testid="tailored-cv-language-row"]')
    expect(rows).toHaveLength(2)
    await type(rows[1]!.querySelector('input')!, 'English')
    wrapper
      .findAllComponents(USelect)
      .filter((select) => select.element.closest?.('[data-testid="tailored-cv-language-row"]'))
      .at(2)!
      .vm.$emit('update:modelValue', 'GOOD')
    await flushPromises()
    await click('form-modal-save')
    await vi.waitFor(() =>
      expect(
        document.body.querySelectorAll('[data-testid="tailored-cv-language-line"]')
      ).toHaveLength(2)
    )
    expect(
      document.body.querySelectorAll('[data-testid="tailored-cv-language-line"]')[1]!.textContent
    ).toContain('English · Spoken: Good')

    await click('tailored-cv-save')
    await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))
    expect(ops('SaveTailoredCvDraft')[0]!.variables.input).toMatchObject({
      content: {
        headline: 'Frontend engineer',
        languages: [{ name: 'Norwegian' }, { name: 'English', spoken: 'GOOD', written: null }]
      }
    })
  })

  it('brings back profile links, languages and cleared contact fields', async () => {
    const profileCv = { ...tailoredCvFromProfile(cvProfile()), email: 'owner@example.com' }
    fromProfileReply = toTailoredCvInput(profileCv)
    savedDraft = {
      ...savedSummary(),
      content: toTailoredCvInput({ ...profileCv, email: '', links: [], languages: [] })
    }
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-contact-edit')).not.toBeNull())

    await click('tailored-cv-contact-edit')
    await vi.waitFor(() => expect(el('cv-from-profile-email')).not.toBeNull())
    expect(el('cv-from-profile-email')!.textContent).toContain(
      'Use from profile: owner@example.com'
    )
    // Fields the profile has nothing for, or the draft already fills, offer nothing.
    expect(el('cv-from-profile-phone')).toBeNull()
    expect(el('cv-from-profile-fullName')).toBeNull()
    await click('cv-from-profile-email')
    expect(el('cv-from-profile-email')).toBeNull()

    await chooseMenuItem(el('cv-links-from-profile')!, 'GitHub')
    expect(
      await menuItem(el('cv-links-from-profile')!, 'Everything from your profile is already here')
    ).toBeDefined()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await click('form-modal-save')
    await vi.waitFor(() =>
      expect(el('tailored-cv-contact')!.textContent).toContain('owner@example.com')
    )
    expect(el('tailored-cv-contact')!.textContent).toContain('GitHub')

    await click('tailored-cv-languages-edit')
    await vi.waitFor(() => expect(el('cv-languages-from-profile')).not.toBeNull())
    expect(document.body.textContent).toContain('Use Add from profile to bring them back.')
    await chooseMenuItem(el('cv-languages-from-profile')!, 'Norwegian')
    await click('form-modal-save')
    await vi.waitFor(() =>
      expect(el('tailored-cv-language-line')!.textContent).toContain('Norwegian · Spoken: Native')
    )
  })

  describe('review', () => {
    beforeEach(() => {
      // happy-dom has no layout; the review bar scrolls each change into view.
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: vi.fn()
      })
    })
    const suggestionEls = () => [
      ...document.body.querySelectorAll<HTMLElement>('[data-testid="tailored-cv-suggestion"]')
    ]

    it('steps through the changes in page order with Previous and Next, wrapping around', async () => {
      await mountPage()
      await runWholeCvNow()
      expect(suggestionEls()).toHaveLength(4)
      expect(reviewStatus()).toBe('4 AI changes to review')
      expect(el('tailored-cv-review-next')!.getAttribute('aria-label')).toBe('Next AI change')
      expect(el('tailored-cv-review-previous')!.getAttribute('aria-label')).toBe(
        'Previous AI change'
      )

      await click('tailored-cv-review-next')
      expect(reviewStatus()).toBe('AI change 1 of 4')
      await click('tailored-cv-review-next')
      expect(reviewStatus()).toBe('AI change 2 of 4')
      // The second change (the summary) is scrolled to and focused.
      expect(suggestionEls()[1]!.scrollIntoView).toHaveBeenCalled()
      expect(suggestionEls()[1]!.contains(document.activeElement)).toBe(true)
      expect(el('tailored-cv-summary')!.contains(document.activeElement)).toBe(true)

      await click('tailored-cv-review-previous')
      expect(reviewStatus()).toBe('AI change 1 of 4')
      await click('tailored-cv-review-previous')
      expect(reviewStatus()).toBe('AI change 4 of 4')
      await click('tailored-cv-review-next')
      expect(reviewStatus()).toBe('AI change 1 of 4')
    })

    it('blocks saving while changes are pending, and Accept remaining restores the save bar', async () => {
      await mountPage()
      await runWholeCvNow()
      expect(el('tailored-cv-save-bar')).toBeNull()
      expect(el('tailored-cv-save')).toBeNull()
      expect(el('tailored-cv-generate')).toBeNull()
      // Still reachable while reviewing, to run the AI again.
      expect((el('tailored-cv-optimize') as HTMLButtonElement).disabled).toBe(false)

      // Keep the current (empty) summary, then accept the other three.
      within(el('tailored-cv-summary')!, 'tailored-cv-dismiss')!.click()
      await flushPromises()
      expect(reviewStatus()).toBe('3 AI changes to review')
      expect(el('tailored-cv-review-accept')!.textContent?.trim()).toBe('Accept remaining (3)')
      await click('tailored-cv-review-accept')

      expect(el('tailored-cv-review-bar')).toBeNull()
      expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
      expect((el('tailored-cv-save') as HTMLButtonElement).disabled).toBe(false)
      expect(el('tailored-cv-generate')!.textContent?.trim()).toBe('Save and create PDF')
      expect(summaryValue()).toBe('')
      expect(el('tailored-cv-contact')!.textContent).toContain('Tailored headline')
      expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
    })

    it('discards every remaining change, leaving the content as it was, with Undo', async () => {
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-contact')).not.toBeNull())
      const before = el('tailored-cv-experience')!.textContent
      await runWholeCvNow()

      await click('tailored-cv-review-discard')
      expect(el('tailored-cv-review-bar')).toBeNull()
      expect(suggestionEls()).toHaveLength(0)
      expect(el('tailored-cv-save-status')!.textContent).toBe('Not saved yet')
      expect(el('tailored-cv-experience')!.textContent).toBe(before)
      expect(el('tailored-cv-contact')!.textContent).not.toContain('Tailored headline')

      const toast = useToast().toasts.value.at(-1)!
      expect(toast.title).toBe('4 AI changes discarded')
      toast.actions![0]!.onClick!(new MouseEvent('click'))
      await flushPromises()
      expect(reviewStatus()).toBe('4 AI changes to review')
    })

    it('shows reworded and dropped bullets, removed skills and the summary compare', async () => {
      const cv = tailoredCvFromProfile(cvProfile())
      cv.summary = 'Mine'
      cv.experiences[0]!.bullets = [
        { text: 'Existing bullet', sourceBulletId: 100 },
        { text: 'Dropped bullet', sourceBulletId: 101 }
      ]
      const skill = cv.skills[0]!
      cv.skills = [
        skill,
        { ...skill, name: 'Figma', sourceSkillId: null },
        { ...skill, name: 'Node.js', sourceSkillId: null }
      ]
      savedDraft = { id: 1, updatedAt: '2026-10-12T10:00:00Z', content: toTailoredCvInput(cv) }
      const reply = structuredClone(cv)
      reply.summary = 'External summary'
      reply.experiences[0]!.bullets = [{ text: 'Existing bullet, reworded', sourceBulletId: 100 }]
      reply.skills = [skill]
      previewReply = {
        candidate: { schemaVersion: 1, content: toTailoredCvInput(reply) },
        errors: null
      }
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } })
      await mountPage()
      await pasteOwnAiReply()
      await vi.waitFor(() => expect(reviewStatus()).toBe('3 AI changes to review'))

      // The entry's title shows once and its bullets become the diff.
      const experience = el('tailored-cv-experience')!
      expect(experience.textContent!.split('Developer').length - 1).toBe(1)
      expect(experience.querySelector('ul.list-disc')).toBeNull()
      const bullets = [
        ...experience.querySelectorAll<HTMLElement>('[data-testid="tailored-cv-diff-bullet"]')
      ]
      expect(bullets.map((b) => b.dataset.kind)).toEqual(['reworded', 'removed'])
      expect(bullets[0]!.textContent).toContain('Existing bullet, reworded')
      expect(bullets[0]!.textContent).toContain('Reworded')
      expect(bullets[0]!.querySelector('.line-through')!.textContent).toBe('Existing bullet')
      expect(bullets[1]!.textContent).toContain('Removed')
      expect(bullets[1]!.querySelector('.line-through')!.textContent).toContain('Dropped bullet')

      // Kept skills are unmarked; the left-out ones are struck through and labelled.
      const chips = [
        ...el('tailored-cv-skills')!.querySelectorAll<HTMLElement>(
          '[data-testid="tailored-cv-diff-chip"]'
        )
      ]
      expect(chips.map((c) => [c.dataset.kind, c.textContent?.replace(/\s+/g, '')])).toEqual([
        ['kept', 'Vue'],
        ['removed', 'Figma·Removed'],
        ['removed', 'Node.js·Removed']
      ])
      expect(chips[0]!.querySelector('.line-through')).toBeNull()
      expect(chips[1]!.querySelector('.line-through')!.textContent).toBe('Figma')
      expect(chips[2]!.querySelector('.line-through')!.textContent).toBe('Node.js')
      // The read-only skill list gives way to the diff.
      expect(cardSkills()).toEqual([])

      const summary = el('tailored-cv-summary')!
      expect(summaryValue()).toBe('')
      expect(summary.textContent).toContain('Mine')
      expect(summary.textContent).toContain('External summary')
      expect(within(summary, 'tailored-cv-dismiss')!.textContent?.trim()).toBe('Keep current')
      vi.unstubAllGlobals()
    })

    it('asks before leaving with pending changes, naming them, and Cancel keeps them', async () => {
      savedDraft = savedSummary()
      releaseAnalysis()
      const wrapper = await mountSuspended(defineComponent({ render: () => h(RouterView) }), {
        route: '/listings/5/cv',
        attachTo: document.body
      })
      mounted.push(wrapper)
      await vi.waitFor(() => expect(el('tailored-cv-summary-analyze')).not.toBeNull())
      await click('tailored-cv-summary-analyze')
      await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
      await click('tailored-cv-ai-run')
      await vi.waitFor(() => expect(reviewStatus()).toBe('2 AI changes to review'))

      const router = useRouter()
      await router.push('/listings')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/listings/5/cv')
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain(
          '2 AI changes not yet reviewed will be discarded.'
        )
      )
      buttonNamed('Cancel').click()
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/listings/5/cv')
      expect(reviewStatus()).toBe('2 AI changes to review')
    })
  })

  describe('skills modal', () => {
    const twoSkills = () => {
      savedDraft = savedSummary()
      savedDraft.content.skills = [
        { name: 'Vue', level: 4, sourceSkillId: 1, categoryId: null, group: null },
        { name: 'TypeScript', level: null, sourceSkillId: null, categoryId: null, group: null }
      ]
    }
    const modalButton = (label: string) =>
      el('tailored-cv-skills-modal')!.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!

    it('reorders on a copy and puts it into the CV on Apply', async () => {
      twoSkills()
      await mountPage()
      await vi.waitFor(() => expect(cardSkills()).toEqual(['Vue', 'TypeScript']))
      await click('tailored-cv-skills-edit')
      await vi.waitFor(() => expect(el('tailored-cv-skills-modal')).not.toBeNull())

      modalButton('Move TypeScript earlier').click()
      await flushPromises()
      // Nothing reaches the card before Apply.
      expect(cardSkills()).toEqual(['Vue', 'TypeScript'])
      await click('form-modal-save')
      await vi.waitFor(() => expect(cardSkills()).toEqual(['TypeScript', 'Vue']))
      expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')

      await click('tailored-cv-save')
      await vi.waitFor(() => expect(ops('SaveTailoredCvDraft')).toHaveLength(1))
      expect(ops('SaveTailoredCvDraft')[0]!.variables.input.content).toMatchObject({
        skills: [{ name: 'TypeScript' }, { name: 'Vue' }]
      })
    })

    it('discards the copy on Cancel', async () => {
      twoSkills()
      await mountPage()
      await vi.waitFor(() => expect(cardSkills()).toEqual(['Vue', 'TypeScript']))
      await click('tailored-cv-skills-edit')
      await vi.waitFor(() => expect(el('tailored-cv-skills-modal')).not.toBeNull())

      modalButton('Remove Vue').click()
      await flushPromises()
      await click('form-modal-cancel')
      // The modal asks before dropping a changed copy.
      await vi.waitFor(() => expect(document.body.textContent).toContain('Discard changes?'))
      buttonNamed('Discard').click()
      await vi.waitFor(() => expect(el('tailored-cv-skills-modal')).toBeNull())
      expect(cardSkills()).toEqual(['Vue', 'TypeScript'])
      expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · no PDF yet')

      // Reopening starts from the CV again, not from the discarded copy.
      await click('tailored-cv-skills-edit')
      await vi.waitFor(() => expect(el('tailored-cv-skills-modal')).not.toBeNull())
      expect(modalButton('Remove Vue')).not.toBeNull()
    })
  })

  describe('entry actions', () => {
    it('shows Edit and Tailor beside an entry on wide screens, with Remove in its menu', async () => {
      await mountPage()
      const experience = () => el('tailored-cv-experience')!
      await vi.waitFor(() => expect(within(experience(), 'tailored-cv-entry')).not.toBeNull())
      expect(within(experience(), 'tailored-cv-entry-edit')!.textContent?.trim()).toBe('Edit')
      expect(within(experience(), 'tailored-cv-entry-analyze')!.textContent?.trim()).toBe('Tailor')
      expect(el('tailored-cv-summary-analyze')!.textContent?.trim()).toBe('Tailor')

      within(experience(), 'tailored-cv-entry-actions')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
      await flushPromises()
      expect(
        [...document.body.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent?.trim())
      ).toEqual(['Remove from this CV'])
    })

    it('puts Edit, Tailor and Remove in the entry menu on phones', async () => {
      const happyDOM = (window as unknown as { happyDOM: { setViewport: (v: object) => void } })
        .happyDOM
      happyDOM.setViewport({ width: 375, height: 800 })
      try {
        await mountPage()
        const experience = () => el('tailored-cv-experience')!
        await vi.waitFor(() => expect(within(experience(), 'tailored-cv-entry')).not.toBeNull())
        expect(within(experience(), 'tailored-cv-entry-edit')).toBeNull()
        expect(within(experience(), 'tailored-cv-entry-analyze')).toBeNull()

        await chooseMenuItem(within(experience(), 'tailored-cv-entry-actions')!, 'Tailor with AI')
        await vi.waitFor(() => expect(el('tailored-cv-ai-run')).not.toBeNull())
        expect(
          [...document.body.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent?.trim())
        ).toEqual([])
      } finally {
        happyDOM.setViewport({ width: 1024, height: 768 })
      }
    })
  })

  it('splits the cards into two columns on wide screens, with the settings atop the side one', async () => {
    const happyDOM = (window as unknown as { happyDOM: { setViewport: (v: object) => void } })
      .happyDOM
    const titles = (column: Element) =>
      [...column.querySelectorAll('[data-testid^="tailored-cv-"]')]
        .map((card) => card.getAttribute('data-testid'))
        .filter((id) =>
          [
            'tailored-cv-settings',
            'tailored-cv-contact',
            'tailored-cv-summary',
            'tailored-cv-experience',
            'tailored-cv-skills',
            'tailored-cv-education',
            'tailored-cv-certifications',
            'tailored-cv-projects',
            'tailored-cv-languages'
          ].includes(id!)
        )
    // The default width keeps one column, with the settings first.
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-contact')).not.toBeNull())
    expect(el('cv-editor-columns')).toBeNull()

    happyDOM.setViewport({ width: 1920, height: 1080 })
    try {
      await vi.waitFor(() => expect(el('cv-editor-columns')).not.toBeNull())
      expect(titles(el('cv-editor-main')!)).toEqual([
        'tailored-cv-contact',
        'tailored-cv-summary',
        'tailored-cv-experience',
        'tailored-cv-projects'
      ])
      expect(titles(el('cv-editor-aside')!)).toEqual([
        'tailored-cv-settings',
        'tailored-cv-skills',
        'tailored-cv-education',
        'tailored-cv-certifications',
        'tailored-cv-languages'
      ])
      // The bar acts on both columns, so it sits below them.
      expect(el('cv-editor-columns')!.contains(el('tailored-cv-save-bar'))).toBe(false)
    } finally {
      happyDOM.setViewport({ width: 1024, height: 768 })
    }
  })

  it('copies the CV as text from the header menu and confirms with a toast', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await mountPage()
    await vi.waitFor(() => expect(el('tailored-cv-more')).not.toBeNull())
    await chooseMenuItem(el('tailored-cv-more')!, 'Copy as text')
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0]![0]).toContain('Existing owner')
    expect(useToast().toasts.value.at(-1)!.title).toBe('CV copied as text')
    vi.unstubAllGlobals()
  })

  describe('Generate PDF', () => {
    const generate = () => ops('GenerateCvDocument')
    const edit = () => editSummary('Edited summary')
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
      expect(el('tailored-cv-generate')!.textContent?.trim()).toBe('Save and create PDF')
      // Nothing to save yet on a new CV beyond the candidate itself: Save draft is still offered.
      expect((el('tailored-cv-save') as HTMLButtonElement).disabled).toBe(false)
      const listingFetches = () => calls.filter((c) => c.query.includes('query ListingById')).length
      const before = listingFetches()

      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(ops('SaveTailoredCvDraft')).toHaveLength(1)
      expect(generate()).toHaveLength(1)
      expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/70')
      await vi.waitFor(() => expect(listingFetches()).toBe(before + 1))

      // The PDF now matches the draft: the action opens it instead of making another.
      await vi.waitFor(() =>
        expect(el('tailored-cv-generate')!.textContent?.trim()).toBe('Open PDF')
      )
      expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · PDF is up to date')
      expect((el('tailored-cv-save') as HTMLButtonElement).disabled).toBe(true)
      expect(el('tailored-cv-latest-pdf')!.textContent).toContain('cv.pdf')
      // The bar has no apply action; applying starts from the PDF preview.
      expect(el('tailored-cv-apply')).toBeNull()
    })

    it('shows a current PDF after a reload, opens it without generating, and offers Save and create once edited', async () => {
      currentPdf()
      await mountPage()
      await vi.waitFor(() =>
        expect(el('tailored-cv-generate')?.textContent?.trim()).toBe('Open PDF')
      )
      expect(el('tailored-cv-save-status')!.textContent).toBe('Saved · PDF is up to date')
      expect((el('tailored-cv-save') as HTMLButtonElement).disabled).toBe(true)
      expect(el('tailored-cv-latest-pdf')!.textContent).toContain('tailored.pdf')
      expect(el('tailored-cv-latest-pdf')!.textContent).not.toContain('Older than the draft')

      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/60')
      expect(generate()).toHaveLength(0)
      expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await vi.waitFor(() => expect(el('cv-pdf-download')).toBeNull())

      await edit()
      expect(el('tailored-cv-generate')!.textContent?.trim()).toBe('Save and create PDF')
      expect(el('tailored-cv-save-status')!.textContent).toBe('Unsaved changes')
      expect((el('tailored-cv-save') as HTMLButtonElement).disabled).toBe(false)
      expect(el('tailored-cv-latest-pdf')!.textContent).toContain('Older than the draft')
    })

    it('offers Create PDF when the latest PDF is older than the saved draft, without saving again', async () => {
      savedDraft = savedSummary()
      listing.documents = [
        { id: 60, kind: 'CV', fileName: 'old.pdf', createdAt: '2026-10-12T09:00:00Z', sentAt: null }
      ]
      await mountPage()
      await vi.waitFor(() =>
        expect(el('tailored-cv-generate')?.textContent?.trim()).toBe('Create PDF')
      )
      expect(el('tailored-cv-save-status')!.textContent).toBe(
        'Saved · PDF is older than this draft'
      )
      await click('tailored-cv-generate')
      await vi.waitFor(() => expect(el('cv-pdf-download')).not.toBeNull())
      expect(generate()).toHaveLength(1)
      expect(ops('SaveTailoredCvDraft')).toHaveLength(0)
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

    it('applies with the PDF selected from the preview', async () => {
      currentPdf()
      await mountPage()
      await vi.waitFor(() => expect(el('tailored-cv-latest-pdf-preview')).not.toBeNull())
      expect(el('tailored-cv-apply')).toBeNull()
      await click('tailored-cv-latest-pdf-preview')
      await vi.waitFor(() => expect(el('cv-pdf-apply')).not.toBeNull())
      expect(el('cv-pdf-apply')!.textContent?.trim()).toBe('Mark as applied with this PDF')
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
      await vi.waitFor(() => expect(el('tailored-cv-latest-pdf-preview')).not.toBeNull())
      await click('tailored-cv-latest-pdf-preview')
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
      expect(el('tailored-cv-generate-error')!.textContent).toContain(
        'Creating the PDF saves it again'
      )
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
