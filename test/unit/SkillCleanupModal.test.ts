import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import SkillCleanupModal from '~/components/profile/SkillCleanupModal.vue'
import { parseCleanupReply } from '~/composables/useSkillCleanup'
import { llmModels } from '../fixtures/llmModels'

let applyError = ''
let skillsError = ''
let suggested: { skillIds: number[]; names: string[] }[] = []
let suggestedTranslations: { skillName: string; language: string; name: string }[] = []
let suggestedCategories: { skillName: string; categoryName: string }[] = []
let suggestedRemovals: { skillId: number; reason: string }[] = []
const requests: { query: string; variables?: Record<string, unknown> }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    requests.push(body)
    if (body.query.includes('query SkillCleanupPrompt'))
      return { data: { skillCleanupPrompt: { instructions: 'Skills: 1: JS' } } }
    if (body.query.includes('query AllSkillNames'))
      return skillsError
        ? { errors: [{ message: skillsError }] }
        : {
            data: {
              skills: {
                nodes: [
                  { id: 1, name: 'JS' },
                  { id: 2, name: 'Javascript' },
                  { id: 3, name: 'Vue' }
                ],
                pageInfo: { hasNextPage: false, endCursor: null }
              }
            }
          }
    if (body.query.includes('mutation SuggestSkillCleanup'))
      return {
        data: {
          suggestSkillCleanup: {
            result: {
              status: 'SUCCEEDED',
              error: null,
              operations: suggested,
              translations: suggestedTranslations,
              categories: suggestedCategories,
              removals: suggestedRemovals
            },
            errors: null
          }
        }
      }
    if (body.query.includes('mutation CleanUpSkills'))
      return {
        data: {
          cleanUpSkills: applyError
            ? {
                skills: null,
                errors: [{ __typename: 'InvalidSkillCleanupError', message: applyError }]
              }
            : { skills: [{ id: 1 }], errors: null }
        }
      }
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
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

const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const queryAll = (id: string) => [...document.body.querySelectorAll(`[data-testid="${id}"]`)]
const click = async (id: string) => {
  query(id)!.click()
  await flushPromises()
}
const mounted: { unmount: () => void }[] = []
const mountOpen = async () => {
  const wrapper = await mountSuspended(SkillCleanupModal, {
    props: { open: true },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
const applyRequests = () => requests.filter((r) => r.query.includes('mutation CleanUpSkills'))
const suggest = async () => {
  const wrapper = await mountOpen()
  await click('cleanup-suggest')
  await vi.waitFor(() => expect(query('cleanup-apply') ?? query('cleanup-empty')).not.toBeNull())
  return wrapper
}

beforeEach(() => {
  // The last AI used is remembered in a cookie; every test starts on the default tab.
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  applyError = ''
  skillsError = ''
  suggested = [{ skillIds: [1, 2], names: ['JavaScript'] }]
  suggestedTranslations = []
  suggestedCategories = []
  suggestedRemovals = []
  requests.length = 0
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('SkillCleanupModal', () => {
  it('labels a merge with the current names and applies the edited plan', async () => {
    const wrapper = await suggest()
    expect(query('compare-current')!.textContent!.trim()).toBe('JS, Javascript')
    expect(document.body.textContent).toContain('Merge')

    const input = query('cleanup-name') as HTMLInputElement
    input.value = '  JavaScript  '
    input.dispatchEvent(new Event('input'))
    await click('cleanup-apply')

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(applyRequests()[0]!.variables).toEqual({
      operations: [{ skillIds: [1, 2], names: ['JavaScript'] }],
      translations: [],
      categories: []
    })
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('applies an edited translation even when there are no operations', async () => {
    suggested = []
    suggestedTranslations = [
      { skillName: 'Code review', language: 'NORWEGIAN', name: 'Kodegjennomgang' },
      { skillName: 'Testing', language: 'NORWEGIAN', name: 'Testing' }
    ]
    await suggest()
    const translation = query('cleanup-translation')!.textContent
    expect(translation).toContain('Code review')
    expect(translation).toContain('Norwegian name')

    await click('cleanup-translation-remove')
    const input = query('cleanup-translation-name') as HTMLInputElement
    expect(input.value).toBe('Testing')
    input.value = ' Testing og QA '
    input.dispatchEvent(new Event('input'))
    await click('cleanup-apply')

    await vi.waitFor(() => expect(applyRequests()).toHaveLength(1))
    expect(applyRequests()[0]!.variables).toEqual({
      operations: [],
      translations: [{ skillName: 'Testing', language: 'NORWEGIAN', name: 'Testing og QA' }],
      categories: []
    })
  })

  it('sends only the category suggestions that stay ticked', async () => {
    suggested = []
    suggestedTranslations = []
    suggestedCategories = [
      { skillName: 'Vue', categoryName: 'Frameworks' },
      { skillName: 'Docker', categoryName: 'Tools' }
    ]
    await suggest()
    expect(queryAll('cleanup-category')[0]!.textContent).toContain('Vue → Frameworks')

    const second = queryAll('cleanup-category-accept')[1] as HTMLElement
    second.click()
    await flushPromises()
    await click('cleanup-apply')

    await vi.waitFor(() => expect(applyRequests()).toHaveLength(1))
    expect(applyRequests()[0]!.variables).toEqual({
      operations: [],
      translations: [],
      categories: [{ skillName: 'Vue', categoryName: 'Frameworks' }]
    })
  })

  describe('removals', () => {
    it('start unticked, are confirmed as permanent, and send only the ticked ids', async () => {
      suggested = []
      suggestedRemovals = [
        { skillId: 1, reason: 'A role area, not a skill' },
        { skillId: 3, reason: 'A trait' }
      ]
      const wrapper = await suggest()
      const boxes = queryAll('cleanup-removal-accept') as HTMLElement[]
      expect(queryAll('cleanup-removal')[0]!.textContent).toContain('JS')
      expect(queryAll('cleanup-removal')[0]!.textContent).toContain('A role area, not a skill')
      expect(
        boxes.map((b) => b.getAttribute('aria-checked') ?? b.getAttribute('data-state'))
      ).not.toContain('checked')
      expect((query('cleanup-apply') as HTMLButtonElement).disabled).toBe(true)
      expect(query('cleanup-nothing-selected')).not.toBeNull()

      boxes[1]!.click()
      await flushPromises()
      await click('cleanup-apply')
      expect(applyRequests()).toHaveLength(0)
      expect(query('cleanup-remove-list')!.textContent).toContain('Vue')
      expect(document.body.textContent).toContain('permanently')

      await click('confirm-modal-confirm')
      await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
      expect(applyRequests()[0]!.variables).toEqual({
        operations: [],
        translations: [],
        categories: [],
        removeSkillIds: [3]
      })
    })

    it('disables a removal that is part of an operation and skips unknown skills', async () => {
      suggestedRemovals = [
        { skillId: 1, reason: 'Duplicate' },
        { skillId: 99, reason: 'Gone' }
      ]
      await suggest()
      expect(queryAll('cleanup-removal')).toHaveLength(1)
      expect((query('cleanup-removal-accept') as HTMLButtonElement).disabled).toBe(true)
      expect(query('cleanup-removal-skipped')!.textContent).toContain('1 suggestion skipped')
    })

    it('are read from a pasted reply', () => {
      expect(
        parseCleanupReply('{"operations":[],"removals":[{"skillId":2,"reason":"Trait"}]}')?.removals
      ).toEqual([{ skillId: 2, reason: 'Trait' }])
      expect(parseCleanupReply('{"operations":[],"removals":[{"skillId":"2"}]}')).toBeNull()
    })
  })

  it('shows an unknown id as invalid and blocks Apply until it is dropped', async () => {
    suggested = [
      { skillIds: [1, 99], names: ['X'] },
      { skillIds: [3], names: ['Vue.js'] }
    ]
    await suggest()
    expect(document.body.textContent).toContain('Skill not found')
    expect((query('cleanup-apply') as HTMLButtonElement).disabled).toBe(true)
    expect(query('cleanup-problems')!.textContent).toContain('Fix 1 item first')

    await click('cleanup-remove')
    expect((query('cleanup-apply') as HTMLButtonElement).disabled).toBe(false)
    expect(query('cleanup-apply')!.textContent).toContain('Apply 1 change')
  })

  it('keeps a dropped change in the list, leaves it out of Apply, and restores it', async () => {
    suggested = [
      { skillIds: [1, 2], names: ['JavaScript'] },
      { skillIds: [3], names: ['Vue.js'] }
    ]
    await suggest()
    await click('cleanup-remove')
    expect(queryAll('cleanup-row')).toHaveLength(2)
    expect(query('cleanup-apply')!.textContent).toContain('Apply 1 change')

    await click('cleanup-restore')
    expect(query('cleanup-apply')!.textContent).toContain('Apply 2 changes')

    await click('cleanup-remove')
    await click('cleanup-apply')
    await vi.waitFor(() => expect(applyRequests()).toHaveLength(1))
    expect(applyRequests()[0]!.variables!.operations).toEqual([
      { skillIds: [3], names: ['Vue.js'] }
    ])
  })

  it('frees a removal when the change using that skill is dropped', async () => {
    suggestedRemovals = [{ skillId: 1, reason: 'Duplicate' }]
    await suggest()
    expect((query('cleanup-removal-accept') as HTMLButtonElement).disabled).toBe(true)
    await click('cleanup-remove')
    expect((query('cleanup-removal-accept') as HTMLButtonElement).disabled).toBe(false)
  })

  it('counts ticked removals as permanent in the Apply button', async () => {
    suggested = [{ skillIds: [2], names: ['Javascript'] }]
    suggestedRemovals = [{ skillId: 3, reason: 'A trait' }]
    await suggest()
    expect(query('cleanup-apply')!.textContent).toContain('Apply 1 change')
    expect(query('cleanup-apply')!.textContent).not.toContain('permanent')

    await click('cleanup-removal-accept')
    expect(query('cleanup-apply')!.textContent).toContain('Apply 2 changes (1 permanent)')
  })

  it('says there is nothing to clean up for an empty plan', async () => {
    suggested = []
    await suggest()
    expect(query('cleanup-empty')!.textContent).toContain('Nothing to clean up')
    expect(query('cleanup-apply')).toBeNull()
  })

  it('keeps the review open and shows the API error when applying fails', async () => {
    applyError = 'Skill is in two operations.'
    const wrapper = await suggest()
    await click('cleanup-apply')
    await vi.waitFor(() => expect(query('cleanup-apply-error')).not.toBeNull())
    expect(query('cleanup-apply-error')!.textContent).toContain('two operations')
    expect(query('cleanup-name')).not.toBeNull()
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('keeps a pasted reply that is not valid JSON and shows an error', async () => {
    await mountOpen()
    const tab = [...document.body.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) =>
      t.textContent?.includes('own AI')
    )!
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    tab.click()
    await flushPromises()
    const box = query('cleanup-json') as HTMLTextAreaElement
    box.value = 'not json'
    box.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('cleanup-preview')
    expect(document.body.textContent).toContain('valid JSON')
    expect((query('cleanup-json') as HTMLTextAreaElement).value).toBe('not json')
  })

  it('includes the API message when the skills cannot be loaded', async () => {
    skillsError = 'Page size too large'
    await mountOpen()
    await click('cleanup-suggest')
    await vi.waitFor(() => expect(query('cleanup-error')).not.toBeNull())
    expect(query('cleanup-error')!.textContent).toContain('Page size too large')
  })

  it('keeps the paid plan when the skills cannot be loaded, so trying again only loads them', async () => {
    skillsError = 'Page size too large'
    await mountOpen()
    await click('cleanup-suggest')
    await vi.waitFor(() => expect(query('cleanup-error')?.textContent).toContain('plan is kept'))

    skillsError = ''
    await click('cleanup-suggest')
    await vi.waitFor(() => expect(query('cleanup-apply')).not.toBeNull())
    expect(requests.filter((r) => r.query.includes('mutation SuggestSkillCleanup'))).toHaveLength(1)
  })

  it('closes an untouched plan without asking, and asks once a change was removed', async () => {
    const wrapper = await suggest()
    await click('ai-modal-cancel')
    expect(query('confirm-modal-confirm')).toBeNull()
    expect(wrapper.emitted('update:open')).toEqual([[false]])

    const edited = await suggest()
    await click('cleanup-remove')
    await click('ai-modal-cancel')
    expect(edited.emitted('update:open')).toBeUndefined()
    await click('confirm-modal-confirm')
    expect(edited.emitted('update:open')).toEqual([[false]])
  })
})
