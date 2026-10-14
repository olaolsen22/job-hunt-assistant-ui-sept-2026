import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import { UTabs, UButton } from '#components'
import CvImportModal from '~/components/profile/CvImportModal.vue'
import CvReview from '~/components/profile/CvReview.vue'
import { cvCandidate, cvExperience, cvProfile } from '../fixtures/profileCv'
import type { CvCandidate } from '~/composables/useProfileCvImport'
import { llmModels, unknownModelError } from '../fixtures/llmModels'

let candidate: CvCandidate
let parseError = ''
let parseUnknownModel = false
let parseSafetyCode = ''
let previewError = ''
let saveError = ''
let saveNetworkFails = false
let promptFails = false
let saveWait: Promise<void> | undefined
const requests: { query: string; variables?: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ProfileCvPrompt'))
      return promptFails
        ? { errors: [{ message: 'Unavailable' }] }
        : { data: { profileCvParsePrompt: { version: 1, instructions: 'CV instructions' } } }
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    if (body.query.includes('mutation ParseProfileCv') && parseSafetyCode) {
      const error = {
        __typename: 'AiSafetyError',
        message: `Stopped: ${parseSafetyCode}`,
        code: parseSafetyCode
      }
      return { data: { parseProfileCv: { result: null, errors: [error] } } }
    }
    if (body.query.includes('mutation ParseProfileCv') && parseUnknownModel)
      return { data: { parseProfileCv: { result: null, errors: [unknownModelError] } } }
    if (body.query.includes('mutation ParseProfileCv'))
      return {
        data: {
          parseProfileCv: {
            result: parseError
              ? { status: 'FAILED', error: parseError, candidate: null }
              : { status: 'SUCCEEDED', error: null, candidate },
            errors: null
          }
        }
      }
    if (body.query.includes('mutation PreviewProfileCvImport'))
      return {
        data: {
          previewProfileCvImport: {
            candidate: previewError ? null : candidate,
            errors: previewError
              ? [{ __typename: 'InvalidProfileImportError', message: previewError }]
              : null
          }
        }
      }
    if (body.query.includes('mutation ImportProfileCv')) {
      await saveWait
      if (saveNetworkFails) throw createError({ statusCode: 502 })
      return {
        data: {
          importProfileCv: {
            profile: saveError ? null : { ...cvProfile(), headline: 'Imported headline' },
            errors: saveError
              ? [
                  {
                    __typename:
                      saveError === 'Gone'
                        ? 'ProfileEntryNotFoundError'
                        : 'InvalidProfileImportError',
                    message: saveError
                  }
                ]
              : null
          }
        }
      }
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
          resetsAt: '2026-10-12T00:00:00Z'
        }
      }
    }
  }
})
const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const click = async (id: string) => {
  query(id).click()
  await flushPromises()
}
const setText = async (id: string, text: string) => {
  const el = query(id) as HTMLTextAreaElement
  el.value = text
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
const mountedWrappers: { unmount: () => void }[] = []
afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
const mountOpen = async () => {
  const refreshProfile = vi.fn(async () => {})
  const wrapper = await mountSuspended(CvImportModal, {
    props: { open: true, profile: cvProfile(), refreshProfile },
    attachTo: document.body
  })
  mountedWrappers.push(wrapper)
  await flushPromises()
  return { wrapper, refreshProfile }
}
const saveButton = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  wrapper
    .findAllComponents(UButton)
    .find((button) => button.attributes('data-testid') === 'cv-save')!
const saveRequests = () => requests.filter((r) => r.query.includes('mutation ImportProfileCv'))
const openReview = async () => {
  const mounted = await mountOpen()
  await setText('cv-text', 'English CV text')
  await click('cv-parse')
  await vi.waitFor(() =>
    expect(document.body.querySelector('[data-testid="cv-review"]')).not.toBeNull()
  )
  return mounted
}
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  })
  candidate = cvCandidate()
  parseError = previewError = saveError = parseSafetyCode = ''
  promptFails = saveNetworkFails = parseUnknownModel = false
  saveWait = undefined
  requests.length = 0
  clearNuxtData('llm-models')
})

describe('CV import modal', () => {
  it('parses text into local editable review and only saves the corrected selected values on Save import', async () => {
    const { wrapper, refreshProfile } = await openReview()
    expect(refreshProfile).toHaveBeenCalledOnce()
    expect(requests.some((r) => r.query.includes('mutation ImportProfileCv'))).toBe(false)
    await setText('cv-headline', 'Reviewed headline')
    await click('cv-save')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    expect(requests.find((r) => r.query.includes('mutation ImportProfileCv'))?.variables).toEqual({
      selection: { contentLanguage: 'ENGLISH', basics: { headline: 'Reviewed headline' } }
    })
    expect(wrapper.emitted('saved')![0]![0]).toMatchObject({
      headline: 'Imported headline',
      experiences: [{ bullets: [{ translations: [{ language: 'NORWEGIAN' }] }] }]
    })
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('copies the external prompt without CV input and uses server preview before review', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const { wrapper } = await mountOpen()
    wrapper.getComponent(UTabs).vm.$emit('update:modelValue', 'ai')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="cv-cost-notice"]')).toBeNull()
    await click('cv-copy-prompt')
    expect(writeText).toHaveBeenCalledWith('CV instructions')
    await setText('cv-json', '{"schemaVersion":1}')
    await click('cv-parse')
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="cv-review"]')).not.toBeNull()
    )
    expect(
      requests.find((r) => r.query.includes('mutation PreviewProfileCvImport'))?.variables
    ).toEqual({ json: '{"schemaVersion":1}' })
    expect(requests.some((r) => r.query.includes('mutation ImportProfileCv'))).toBe(false)
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('preserves pasted input after parse failure and across input tabs', async () => {
    parseError = 'Provider failed'
    const { wrapper } = await mountOpen()
    await setText('cv-text', 'Keep this CV')
    await click('cv-parse')
    await vi.waitFor(() => expect(query('cv-error').textContent).toContain('Provider failed'))
    wrapper.getComponent(UTabs).vm.$emit('update:modelValue', 'ai')
    await flushPromises()
    wrapper.getComponent(UTabs).vm.$emit('update:modelValue', 'paste')
    await flushPromises()
    expect((query('cv-text') as HTMLTextAreaElement).value).toBe('Keep this CV')
    expect(wrapper.emitted('saved')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows an unknown default model inline, keeps the text and refetches the models', async () => {
    await mountOpen()
    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query LlmModels'))).toHaveLength(1)
    )
    parseUnknownModel = true
    await setText('cv-text', 'Keep this CV')
    await click('cv-parse')

    await vi.waitFor(() => expect(query('cv-error').textContent).toContain('isn’t available'))
    const parses = requests.filter((r) => r.query.includes('mutation ParseProfileCv'))
    expect(parses.map((r) => r.variables?.model)).toEqual([undefined])
    expect(requests.filter((r) => r.query.includes('query LlmModels'))).toHaveLength(2)
    expect((query('cv-text') as HTMLTextAreaElement).value).toBe('Keep this CV')
  })

  it('links a reached daily limit to Settings', async () => {
    parseSafetyCode = 'daily-limit-reached'
    await mountOpen()
    await setText('cv-text', 'Keep this CV')
    await click('cv-parse')

    await vi.waitFor(() => expect(query('cv-error').textContent).toContain('Stopped'))
    expect(
      query('cv-error').querySelector('[data-testid="ai-limit-settings"]')?.getAttribute('href')
    ).toBe('/settings')
    expect((query('cv-text') as HTMLTextAreaElement).value).toBe('Keep this CV')
  })

  it('asks before another parse after an interrupted one and sends a new request id', async () => {
    parseSafetyCode = 'operation-interrupted'
    await mountOpen()
    await setText('cv-text', 'English CV text')
    await click('cv-parse')

    await vi.waitFor(() => expect(query('ai-retry-confirm')).not.toBeNull())
    expect((query('cv-parse') as HTMLButtonElement).disabled).toBe(true)

    parseSafetyCode = ''
    await click('ai-retry-confirm-run')
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="cv-review"]')).not.toBeNull()
    )
    const ids = requests
      .filter((r) => r.query.includes('mutation ParseProfileCv'))
      .map((r) => r.variables?.requestId)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toEqual(expect.any(String))
    expect(ids[1]).not.toBe(ids[0])
  })

  it('keeps invalid external JSON and shows the API error', async () => {
    previewError = 'Unsupported version'
    const { wrapper } = await mountOpen()
    wrapper.getComponent(UTabs).vm.$emit('update:modelValue', 'ai')
    await flushPromises()
    await setText('cv-json', 'invalid json')
    await click('cv-parse')
    await vi.waitFor(() => expect(query('cv-error').textContent).toContain('Unsupported version'))
    expect((query('cv-json') as HTMLTextAreaElement).value).toBe('invalid json')
    wrapper.unmount()
  })

  it('blocks blank and oversized input without calling parsing APIs', async () => {
    const { wrapper } = await mountOpen()
    expect((query('cv-parse') as HTMLButtonElement).disabled).toBe(true)
    await setText('cv-text', 'a'.repeat(100001))
    expect((query('cv-parse') as HTMLButtonElement).disabled).toBe(true)
    wrapper.getComponent(UTabs).vm.$emit('update:modelValue', 'ai')
    await flushPromises()
    await setText('cv-json', 'a'.repeat(200001))
    expect((query('cv-parse') as HTMLButtonElement).disabled).toBe(true)
    expect(requests.some((r) => r.query.includes('mutation'))).toBe(false)
    wrapper.unmount()
  })

  it('supports prompt load retry and manual copy fallback after clipboard failure', async () => {
    promptFails = true
    const { wrapper } = await mountOpen()
    wrapper.getComponent(UTabs).vm.$emit('update:modelValue', 'ai')
    await flushPromises()
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="cv-prompt-error"]')).not.toBeNull()
    )
    promptFails = false
    query('cv-prompt-error').querySelector('button')!.click()
    await vi.waitFor(() =>
      expect((query('cv-copy-prompt') as HTMLButtonElement).disabled).toBe(false)
    )
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('Denied')
        })
      }
    })
    await click('cv-copy-prompt')
    expect(query('cv-prompt-error').textContent).toContain('Could not copy')
    expect(document.body.textContent).toContain('CV instructions')
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('defaults missing skill levels and removes the resolved warning without blocking Save', async () => {
    candidate = cvCandidate({
      skills: [{ name: 'New skill', level: null }],
      warnings: [{ path: 'skills[0].level', message: 'Skill level is missing from the CV.' }]
    })
    const { wrapper } = await openReview()
    expect(query('cv-review').textContent).toContain('using level 1')
    expect(query('cv-review').textContent).not.toContain('missing from the CV')
    expect((query('cv-save') as HTMLButtonElement).disabled).toBe(false)
    const model = wrapper.getComponent(CvReview).props('modelValue')
    expect(model.skills[0]!.level).toBe(1)
    model.basics.headline.include = false
    model.skills[0]!.include = false
    await flushPromises()
    expect((query('cv-save') as HTMLButtonElement).disabled).toBe(true)
    expect(saveButton(wrapper).props()).toMatchObject({ color: 'neutral', variant: 'subtle' })
    expect(document.body.textContent).toContain('Nothing selected')
    wrapper.unmount()
  })

  it('makes invalid Save actionable, focuses a hidden month field and saves after correction', async () => {
    candidate = cvCandidate({ experiences: [cvExperience()] })
    const { wrapper } = await openReview()
    const model = wrapper.getComponent(CvReview).props('modelValue')
    const card = query('experiences[0]')
    expect(card.querySelector('details')!.open).toBe(false)
    model.entries.experiences[0]!.startMonth = null
    await flushPromises()
    expect((query('cv-save') as HTMLButtonElement).disabled).toBe(false)
    await click('cv-save')
    expect(requests.some((r) => r.query.includes('mutation ImportProfileCv'))).toBe(false)
    expect(card.querySelector('details')!.open).toBe(true)
    const field = document.body.querySelector('[data-cv-field="experiences[0].startMonth"]')!
    expect(field.textContent).toContain('Choose a start month and year')
    expect(field.contains(document.activeElement)).toBe(true)
    expect(query('cv-review').textContent).not.toContain('experiences[0].startMonth')
    expect(query('cv-status').textContent).toContain('1 item needs attention')
    expect(query('cv-status').querySelector('button')!.className).toContain('error')
    model.entries.experiences[0]!.startMonth = '2023-01-01'
    await flushPromises()
    expect(query('cv-status').textContent).toContain('2 changes to save')
    await click('cv-save')
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
  })

  it('focuses missing language proficiency and clears inline feedback after a choice', async () => {
    candidate = cvCandidate({ languages: [{ name: 'English', spoken: 'GOOD', written: null }] })
    const { wrapper } = await openReview()
    await click('cv-save')
    const field = document.body.querySelector('[data-cv-field="languages[0].written"]')!
    expect(field.textContent).toContain('Choose your written proficiency')
    expect(field.contains(document.activeElement)).toBe(true)
    wrapper.getComponent(CvReview).props('modelValue').languages[0]!.written = 'GOOD'
    await flushPromises()
    expect(field.textContent).not.toContain('Choose your written proficiency')
    wrapper.unmount()
  })

  it('preserves edits on Back and canceled discard, and only discards after confirmation', async () => {
    const { wrapper } = await openReview()
    await setText('cv-headline', 'Keep review')
    await click('cv-back')
    await click('cv-resume')
    expect((query('cv-headline') as HTMLInputElement).value).toBe('Keep review')
    await click('cv-cancel')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    const cancelDiscard = wrapper
      .findAllComponents(UButton)
      .filter((button) => button.text() === 'Cancel')
      .at(-1)!
    cancelDiscard.vm.$emit('click')
    await flushPromises()
    expect((query('cv-headline') as HTMLInputElement).value).toBe('Keep review')
    await click('cv-cancel')
    await click('confirm-modal-confirm')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(requests.some((r) => r.query.includes('mutation ImportProfileCv'))).toBe(false)
    wrapper.unmount()
  })

  it('asks before replacing a review and leaves it available after a failed replacement', async () => {
    const { wrapper } = await openReview()
    await setText('cv-headline', 'Keep review')
    await click('cv-back')
    parseError = 'Failed replacement'
    await click('cv-parse')
    expect(requests.filter((r) => r.query.includes('mutation ParseProfileCv'))).toHaveLength(1)
    await click('confirm-modal-confirm')
    await vi.waitFor(() => expect(query('cv-error').textContent).toContain('Failed replacement'))
    await click('cv-resume')
    expect((query('cv-headline') as HTMLInputElement).value).toBe('Keep review')
    wrapper.unmount()
  })

  it('sends explicit entry and bullet IDs, retains edits on atomic rejection and refreshes unknown targets', async () => {
    candidate = cvCandidate({ experiences: [cvExperience()] })
    saveError = 'Gone'
    const { wrapper, refreshProfile } = await openReview()
    const model = wrapper.getComponent(CvReview).props('modelValue')
    const row = model.entries.experiences[0]!
    row.action = 'update'
    row.id = 10
    row.bullets[0]!.action = 'update'
    row.bullets[0]!.id = 100
    await flushPromises()
    await click('cv-save')
    await vi.waitFor(() => expect(query('cv-save-error').textContent).toContain('Choose the entry'))
    expect(refreshProfile).toHaveBeenCalledTimes(2)
    expect(
      requests.find((r) => r.query.includes('mutation ImportProfileCv'))?.variables
    ).toMatchObject({
      selection: { experiences: [{ id: 10, bullets: [{ id: 100, text: 'Incoming bullet' }] }] }
    })
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(query('cv-review').textContent).toContain('Acme')
    wrapper.unmount()
  })

  it('prevents double-submit and dismissal while saving', async () => {
    let resolveSave!: () => void
    saveWait = new Promise((resolve) => {
      resolveSave = resolve
    })
    const { wrapper } = await openReview()
    await click('cv-save')
    await click('cv-save')
    await click('cv-cancel')
    expect(saveRequests()).toHaveLength(1)
    expect(saveButton(wrapper).props()).toMatchObject({
      color: 'primary',
      variant: 'solid',
      loading: true
    })
    expect((query('cv-save') as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    resolveSave()
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
  })

  it('shows guidance before saving and focuses it from the footer without saving', async () => {
    candidate = cvCandidate({ experiences: [cvExperience({ startMonth: null })] })
    const { wrapper } = await openReview()
    expect(query('cv-status').textContent).toContain('1 item needs attention')
    expect(query('cv-status').querySelector('button')!.className).toContain('warning')
    expect(query('cv-section-experiences').textContent).toContain('1 to check')
    query('cv-status').querySelector('button')!.click()
    await flushPromises()
    const field = document.body.querySelector('[data-cv-field="experiences[0].startMonth"]')!
    expect(field.contains(document.activeElement)).toBe(true)
    expect(saveRequests()).toHaveLength(0)
    wrapper.getComponent(CvReview).props('modelValue').entries.experiences[0]!.startMonth =
      '2022-01-01'
    await flushPromises()
    expect(query('cv-section-experiences').textContent).not.toContain('to check')
    wrapper.unmount()
  })

  it('routes a server error past skipped rows and bullets to the actual field and marks its entry', async () => {
    candidate = cvCandidate({
      experiences: [cvExperience(), cvExperience({ bullets: ['Skipped', 'Too long text'] })]
    })
    saveError = 'selection.experiences[0].bullets[0].text: Bullet text is too long.'
    const { wrapper } = await openReview()
    const model = wrapper.getComponent(CvReview).props('modelValue')
    model.entries.experiences[0]!.action = 'skip'
    model.entries.experiences[1]!.bullets[0]!.action = 'skip'
    await flushPromises()
    await click('cv-save')
    const field = document.body.querySelector('[data-cv-field="experiences[1].bullets[1].text"]')!
    await vi.waitFor(() => expect(field.textContent).toContain('Bullet text is too long.'))
    expect(field.textContent).not.toContain('experiences[0]')
    expect(field.contains(document.activeElement)).toBe(true)
    expect(query('experiences[1]').textContent).toContain('Needs attention')
    expect(document.body.querySelector('[data-testid="cv-save-error"]')).toBeNull()
    wrapper.unmount()
  })

  it('shows an item-level server error on its row and keeps unrenderable ones in the footer', async () => {
    candidate = cvCandidate({ skills: [{ name: 'Vue', level: 3 }] })
    saveError = 'selection.skills[0]: Skill name is reserved.'
    const { wrapper } = await openReview()
    await click('cv-save')
    const row = await vi.waitFor(() => {
      const message = query('cv-skill-0').querySelector('[data-cv-field="skills[0]"]')
      expect(message?.textContent).toContain('Skill name is reserved.')
      return message!
    })
    expect(document.activeElement).toBe(row)
    saveError = 'selection.skills[0].years: Unknown field.'
    await click('cv-save')
    await vi.waitFor(() =>
      expect(query('cv-save-error').textContent).toContain('could not be saved')
    )
    expect(query('cv-save-error').textContent).toContain('Unknown field.')
    wrapper.unmount()
  })

  it('focuses the country picker for a location without a country', async () => {
    candidate = cvCandidate({
      basics: { ...cvCandidate().basics!, location: { city: 'Oslo', countryCode: null } }
    })
    const { wrapper } = await openReview()
    await click('cv-save')
    const field = document.body.querySelector('[data-cv-field="basics.location"]')!
    expect(field.textContent).toContain('Choose a country')
    expect(query('location-country').contains(document.activeElement)).toBe(true)
    expect(saveRequests()).toHaveLength(0)
    wrapper.unmount()
  })

  it('warns once about an unconfirmed save after a network failure and keeps edits', async () => {
    saveNetworkFails = true
    const { wrapper } = await openReview()
    await setText('cv-headline', 'Keep me')
    await click('cv-save')
    await vi.waitFor(() =>
      expect(query('cv-save-error').textContent).toContain('Could not confirm the import')
    )
    expect(query('cv-save-error').textContent).not.toContain('Error details')
    expect(saveRequests()).toHaveLength(1)
    expect((query('cv-headline') as HTMLInputElement).value).toBe('Keep me')
    expect(wrapper.emitted('saved')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps skipped skills identifiable, shows saved levels and imported links before opting in', async () => {
    candidate = cvCandidate({
      skills: [
        { name: 'Vue', level: null },
        { name: 'Rust', level: 2 }
      ],
      links: [{ kind: 'OTHER', label: 'Blog', url: 'https://blog.example' }]
    })
    const { wrapper } = await openReview()
    expect(query('cv-skill-0').textContent).toContain('Saved 4/5')
    expect(query('cv-skill-1').textContent).toContain('New')
    expect(query('cv-imported-links').textContent).toContain('Blog')
    expect(query('cv-status').textContent).toContain('3 changes to save')
    await click('cv-skills-skip-all')
    expect(query('cv-status').textContent).toContain('1 change to save')
    const name = query('cv-skill-0').querySelector('input')!
    expect(name.value).toBe('Vue')
    expect(name.disabled).toBe(true)
    await click('cv-skills-include-all')
    expect(query('cv-status').textContent).toContain('3 changes to save')
    wrapper.unmount()
  })
})
