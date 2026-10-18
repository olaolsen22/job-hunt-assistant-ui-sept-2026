import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import SkillWordingModal from '~/components/profile/SkillWordingModal.vue'
import type { ProfileData } from '~/composables/useProfile'
import { llmModels } from '../fixtures/llmModels'

let applyError = ''
let wording: Record<string, unknown> = {}
const requests: { query: string; variables?: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ProfileSkillWordingPrompt'))
      return { data: { profileSkillWordingPrompt: { instructions: 'Fix wording' } } }
    if (body.query.includes('mutation SuggestProfileSkillWording'))
      return {
        data: {
          suggestProfileSkillWording: {
            result: { status: 'SUCCEEDED', error: null, wording },
            errors: null
          }
        }
      }
    if (body.query.includes('mutation ApplyProfileSkillWording'))
      return {
        data: {
          applyProfileSkillWording: applyError
            ? {
                profile: null,
                errors: [{ __typename: 'ProfileEntryNotFoundError', message: applyError }]
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
  headline: 'JS dev',
  summary: 'I write JS.',
  experiences: [{ bullets: [{ id: 10, text: 'Built apps in JS' }] }],
  educations: [],
  certifications: [],
  projects: [{ bullets: [{ id: 20, text: 'Wrote tests' }] }]
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
const suggest = async () => {
  const wrapper = await mountSuspended(SkillWordingModal, {
    props: { open: true, profile },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  await click(query('wording-suggest')!)
  await vi.waitFor(() => expect(query('wording-apply') ?? query('wording-empty')).not.toBeNull())
  return wrapper
}
const applyRequests = () =>
  requests.filter((r) => r.query.includes('mutation ApplyProfileSkillWording'))

beforeEach(() => {
  // The last AI used is remembered in a cookie; every test starts on the default tab.
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  applyError = ''
  wording = {
    bullets: [
      { id: 10, text: 'Built apps in JavaScript' },
      { id: 20, text: 'Wrote unit tests' }
    ],
    headline: 'JavaScript dev',
    summary: null
  }
  requests.length = 0
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('SkillWordingModal', () => {
  it('shows before and after, and applies only the ticked, edited changes', async () => {
    const wrapper = await suggest()
    expect(queryAll('compare-current').map((p) => p.textContent?.trim())).toEqual([
      'JS dev',
      'Built apps in JS',
      'Wrote tests'
    ])

    // Untick the second bullet and edit the first.
    await click(queryAll('wording-row')[2]!.querySelector<HTMLElement>('button[role="checkbox"]')!)
    const text = queryAll('wording-text')[1] as HTMLTextAreaElement
    text.value = ' Built apps in JavaScript and Vue '
    text.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(query('wording-apply')!)

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(applyRequests()[0]!.variables).toEqual({
      bullets: [{ id: 10, text: 'Built apps in JavaScript and Vue' }],
      headline: 'JavaScript dev',
      summary: null
    })
  })

  it('cannot apply a bullet that is not on the profile', async () => {
    wording = { bullets: [{ id: 99, text: 'Ghost' }], headline: null, summary: null }
    await suggest()
    expect(document.body.textContent).toContain('Not on your profile')
    expect((query('wording-apply') as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the review open and shows the API error when applying fails', async () => {
    applyError = 'Bullet not found.'
    const wrapper = await suggest()
    await click(query('wording-apply')!)
    await vi.waitFor(() => expect(query('wording-apply-error')).not.toBeNull())
    expect(query('wording-apply-error')!.textContent).toContain('Bullet not found.')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('closes an untouched review without asking, but asks after an edit', async () => {
    const wrapper = await suggest()
    await click(query('ai-modal-cancel')!)
    expect(query('confirm-modal-confirm')).toBeNull()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('asks before discarding an edited review', async () => {
    const wrapper = await suggest()
    const text = queryAll('wording-text')[0] as HTMLTextAreaElement
    text.value = 'Something else'
    text.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(query('ai-modal-cancel')!)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    await click(query('confirm-modal-confirm')!)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('selects none and all of the changes that can be applied', async () => {
    await suggest()
    expect(query('review-selected')!.textContent).toContain('3 of 3 selected')
    await click(query('review-select-none')!)
    expect(query('review-selected')!.textContent).toContain('0 of 3 selected')
    expect((query('wording-apply') as HTMLButtonElement).disabled).toBe(true)
    await click(query('review-select-all')!)
    expect((query('wording-apply') as HTMLButtonElement).disabled).toBe(false)
  })
})
