import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import TranslationAiModal from '~/components/profile/TranslationAiModal.vue'
import type { ProfileData } from '~/composables/useProfile'
import { llmModels } from '../fixtures/llmModels'

let applyError = ''
let translation: Record<string, unknown> = {}
const requests: { query: string; variables?: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ProfileTranslationPrompt'))
      return { data: { profileTranslationPrompt: { instructions: 'Translate' } } }
    if (body.query.includes('mutation SuggestProfileTranslation'))
      return {
        data: {
          suggestProfileTranslation: {
            result: { status: 'SUCCEEDED', error: null, translation },
            errors: null
          }
        }
      }
    if (body.query.includes('mutation ApplyProfileTranslation'))
      return {
        data: {
          applyProfileTranslation: applyError
            ? {
                profile: null,
                errors: [{ __typename: 'InvalidProfileError', message: applyError }]
              }
            : { profile: { id: 1 }, errors: null }
        }
      }
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    return {
      data: {
        llmUsageToday: {
          model: 'fast',
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          requestsLimit: 50,
          remainingRequests: 50,
          resetsAt: '2026-10-15T00:00:00Z'
        }
      }
    }
  }
})

// Only the fields the review reads.
const profile = {
  headline: 'Developer',
  summary: 'I build apps.',
  translations: [{ language: 'NORWEGIAN', headline: 'Utvikler', summary: null }],
  experiences: [
    {
      id: 1,
      title: 'Developer',
      employer: 'Acme',
      translations: [],
      bullets: [{ id: 10, text: 'Built apps', translations: [] }]
    }
  ],
  educations: [
    {
      id: 2,
      school: 'NTNU',
      degree: 'Bachelor',
      field: 'Computer science',
      translations: [{ language: 'NORWEGIAN', degree: 'Bachelor', field: null }],
      bullets: []
    }
  ],
  certifications: [],
  projects: []
} as unknown as ProfileData

const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const queryAll = (id: string) => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)
]
const click = async (el: HTMLElement) => {
  el.click()
  await flushPromises()
}
const mounted: { unmount: () => void }[] = []
const mount = async () => {
  const wrapper = await mountSuspended(TranslationAiModal, {
    props: { open: true, profile },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
const suggest = async () => {
  const wrapper = await mount()
  await click(query('translation-ai-suggest')!)
  await vi.waitFor(() =>
    expect(query('translation-ai-apply') ?? query('translation-ai-empty')).not.toBeNull()
  )
  return wrapper
}
const applyRequests = () =>
  requests.filter((r) => r.query.includes('mutation ApplyProfileTranslation'))

beforeEach(() => {
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  clearNuxtData('writing-samples')
  applyError = ''
  translation = {
    bullets: [{ id: 10, text: 'Bygde apper' }],
    experiences: [],
    educations: [],
    headline: 'Utvikler med erfaring',
    summary: 'Jeg bygger apper.'
  }
  requests.length = 0
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('TranslationAiModal', () => {
  it('shows each English source with its entry, and saves the ticked, edited translations', async () => {
    const wrapper = await suggest()
    expect(queryAll('compare-current').map((p) => p.textContent?.trim())).toEqual([
      'Developer',
      'I build apps.',
      'Built apps'
    ])
    expect(document.body.textContent).toContain('Bullet · Developer, Acme')
    expect(document.body.textContent).toContain('Replaces your current Norwegian translation.')

    // Untick the summary and edit the bullet.
    await click(
      queryAll('translation-ai-row')[1]!.querySelector<HTMLElement>('button[role="checkbox"]')!
    )
    const text = queryAll('translation-ai-text')[2] as HTMLTextAreaElement
    text.value = ' Bygde nettapper '
    text.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(query('translation-ai-apply')!)

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(applyRequests()[0]!.variables).toEqual({
      bullets: [{ id: 10, text: 'Bygde nettapper' }],
      headline: 'Utvikler med erfaring',
      summary: null,
      experiences: [],
      educations: []
    })
  })

  it('reviews job titles and education next to their bullets and sends each education once', async () => {
    translation = {
      bullets: [{ id: 10, text: 'Bygde apper' }],
      experiences: [{ id: 1, title: 'Utvikler' }],
      educations: [{ id: 2, degree: 'Bachelorgrad', field: 'Informatikk' }],
      headline: null,
      summary: null
    }
    const wrapper = await suggest()
    expect(queryAll('compare-current').map((p) => p.textContent?.trim())).toEqual([
      'Developer',
      'Built apps',
      'Bachelor',
      'Computer science'
    ])
    expect(document.body.textContent).toContain('Job title · Acme')
    expect(document.body.textContent).toContain('Field of study · NTNU')

    // Untick the degree: the field still goes out, and null leaves the saved degree alone.
    await click(
      queryAll('translation-ai-row')[2]!.querySelector<HTMLElement>('button[role="checkbox"]')!
    )
    await click(query('translation-ai-apply')!)

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(applyRequests()[0]!.variables).toMatchObject({
      experiences: [{ id: 1, title: 'Utvikler' }],
      educations: [{ id: 2, degree: null, field: 'Informatikk' }]
    })
  })

  it('says so when everything is already translated', async () => {
    translation = { bullets: [], experiences: [], educations: [], headline: null, summary: null }
    await suggest()
    expect(query('translation-ai-empty')!.textContent).toContain('up to date')
  })

  it('keeps the review open and shows the API error when saving fails', async () => {
    applyError = 'Repeated bullet.'
    const wrapper = await suggest()
    await click(query('translation-ai-apply')!)
    await vi.waitFor(() => expect(query('translation-ai-apply-error')).not.toBeNull())
    expect(query('translation-ai-apply-error')!.textContent).toContain('Repeated bullet.')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('suggests adding Norwegian writing samples only when there are none', async () => {
    useNuxtData('writing-samples').data.value = [{ id: 1, language: 'ENGLISH' }]
    await mount()
    expect(query('translation-ai-samples-hint')).not.toBeNull()
    mounted.splice(0).forEach((w) => w.unmount())

    useNuxtData('writing-samples').data.value = [{ id: 2, language: 'NORWEGIAN' }]
    await mount()
    expect(query('translation-ai-samples-hint')).toBeNull()
  })
})
