import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import BulletRefinementModal from '~/components/profile/BulletRefinementModal.vue'
import type { BulletScope } from '~/composables/useBulletRefinement'
import type { ProfileData } from '~/composables/useProfile'
import { llmModels } from '../fixtures/llmModels'

let applyError = ''
let suggestion: Record<string, unknown> = {}
let previewResult: Record<string, unknown> = {}
const requests: { query: string; variables?: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query ProfileBulletRefinementPrompt'))
      return { data: { profileBulletRefinementPrompt: { instructions: 'Refine bullets' } } }
    if (body.query.includes('mutation RefineProfileBullets'))
      return { data: { refineProfileBullets: { result: suggestion, errors: null } } }
    if (body.query.includes('mutation PreviewProfileBulletRefinement'))
      return { data: { previewProfileBulletRefinement: { result: previewResult, errors: null } } }
    if (body.query.includes('mutation ApplyProfileBulletRefinement'))
      return {
        data: {
          applyProfileBulletRefinement: applyError
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
  experiences: [
    {
      title: 'Dev',
      employer: 'Acme',
      bullets: [
        { id: 10, text: 'Worked on the checkout' },
        { id: 11, text: 'Improved performance' }
      ]
    }
  ],
  educations: [],
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
const type = async (el: HTMLElement, value: string) => {
  const input = el as HTMLTextAreaElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}
const mounted: { unmount: () => void }[] = []
const open = async (scope?: BulletScope) => {
  const wrapper = await mountSuspended(BulletRefinementModal, {
    props: { open: true, profile, scope },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
const suggest = async (scope?: BulletScope) => {
  const wrapper = await open(scope)
  await click(query('refine-suggest')!)
  await vi.waitFor(() => expect(query('refine-apply') ?? query('refine-empty')).not.toBeNull())
  return wrapper
}
const requestsFor = (name: string) => requests.filter((r) => r.query.includes(name))
const applyButton = () => query('refine-apply') as HTMLButtonElement

beforeEach(() => {
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  applyError = ''
  suggestion = {
    status: 'SUCCEEDED',
    error: null,
    bullets: [
      { bulletId: 10, text: 'Rebuilt the checkout, cutting drop-off', note: null },
      { bulletId: 11, text: null, note: 'By how much did performance improve?' }
    ]
  }
  previewResult = suggestion
  requests.length = 0
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('BulletRefinementModal', () => {
  it('sends the entry scope, and no bullet id, with the request', async () => {
    await suggest({ kind: 'EXPERIENCE', entryId: 7 })
    expect(requestsFor('mutation RefineProfileBullets')[0]!.variables).toMatchObject({
      kind: 'EXPERIENCE',
      entryId: 7
    })
    expect(requestsFor('mutation RefineProfileBullets')[0]!.variables).not.toHaveProperty(
      'bulletId'
    )
  })

  it('sends no scope for the whole profile', async () => {
    await suggest()
    const variables = requestsFor('mutation RefineProfileBullets')[0]!.variables!
    expect(variables.kind).toBeUndefined()
    expect(variables.entryId).toBeUndefined()
    expect(variables.bulletId).toBeUndefined()
  })

  it('applies an edited suggestion and leaves a question without new text out', async () => {
    const wrapper = await suggest()
    expect(query('refine-note')!.textContent).toContain('By how much')
    // The question row starts unticked, so only the first change counts.
    expect(applyButton().textContent).toContain('Apply 1 change')

    await type(queryAll('refine-text')[0]!, ' Rebuilt the checkout, cutting drop-off by 12% ')
    await click(applyButton())

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(requestsFor('mutation ApplyProfileBulletRefinement')[0]!.variables).toEqual({
      bullets: [{ id: 10, text: 'Rebuilt the checkout, cutting drop-off by 12%' }]
    })
  })

  it('counts a question row once a changed text is typed into it', async () => {
    await suggest()
    await type(queryAll('refine-text')[1]!, 'Improved performance by 30%')
    expect(applyButton().textContent).toContain('Apply 2 changes')
    await click(applyButton())
    await vi.waitFor(() =>
      expect(requestsFor('mutation ApplyProfileBulletRefinement')).toHaveLength(1)
    )
    expect(requestsFor('mutation ApplyProfileBulletRefinement')[0]!.variables).toEqual({
      bullets: [
        { id: 10, text: 'Rebuilt the checkout, cutting drop-off' },
        { id: 11, text: 'Improved performance by 30%' }
      ]
    })
  })

  it('shows a calm empty state when nothing needs changes', async () => {
    suggestion = { status: 'SUCCEEDED', error: null, bullets: [] }
    await suggest()
    expect(query('refine-empty')!.textContent).toContain('No bullets need changes')
    expect(query('refine-apply')).toBeNull()
  })

  it('keeps the pasted text and shows the error when the preview fails', async () => {
    document.cookie = 'ai-method=own; path=/'
    previewResult = { status: 'FAILED', error: 'The reply was not valid JSON.', bullets: null }
    await open()
    await type(query('refine-json')!, '{oops')
    await click(query('refine-preview')!)
    await vi.waitFor(() => expect(document.body.textContent).toContain('not valid JSON'))
    expect((query('refine-json') as HTMLTextAreaElement).value).toBe('{oops')
    expect(query('refine-apply')).toBeNull()
  })

  it('keeps the review open and shows the API message when applying fails', async () => {
    applyError = 'Bullet not found.'
    const wrapper = await suggest()
    await click(applyButton())
    await vi.waitFor(() => expect(query('refine-apply-error')).not.toBeNull())
    expect(query('refine-apply-error')!.textContent).toContain('Bullet not found.')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })
})
