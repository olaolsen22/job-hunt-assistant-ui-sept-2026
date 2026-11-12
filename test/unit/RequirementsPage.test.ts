import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readBody } from 'h3'
import RequirementsPage from '~/pages/listings/[id]/requirements.vue'
import RequirementMapCard from '~/components/listings/RequirementMapCard.vue'
import RequirementEvidenceModal from '~/components/listings/RequirementEvidenceModal.vue'
import RequirementNeedRow from '~/components/listings/RequirementNeedRow.vue'
import type { SavedRequirementMap } from '~/composables/useRequirementMap'
import type { ListingDetail } from '~/composables/useListing'
import { cvProfile } from '../fixtures/profileCv'
import {
  requirementNeed,
  requirementListing,
  savedRequirementMap
} from '../fixtures/requirementMap'
import { llmModels } from '../fixtures/llmModels'
let saved: SavedRequirementMap | null
let calls: { query: string; variables: { input?: Record<string, unknown> } }[]
let validationError: string | null
let profileFails: boolean
let readFails: boolean
let previewError: string | null
let promptError: boolean
let generatePayload: Record<string, unknown>
const mounted: { unmount: () => void }[] = []
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    calls.push(body)
    const q = body.query
    if (q.includes('query ListingById')) return { data: { listingById: requirementListing() } }
    if (q.includes('query Profile'))
      return profileFails
        ? { errors: [{ message: 'Profile unavailable' }] }
        : { data: { profile: cvProfile() } }
    if (q.includes('query RequirementMap('))
      return readFails
        ? { errors: [{ message: 'Map unavailable' }] }
        : { data: { requirementMap: saved } }
    if (q.includes('mutation SaveRequirementMap')) {
      if (validationError)
        return {
          data: {
            saveRequirementMap: {
              requirementMap: null,
              errors: [{ __typename: 'InvalidRequirementMapError', message: validationError }]
            }
          }
        }
      saved = savedRequirementMap(body.variables.input.content.needs)
      return { data: { saveRequirementMap: { requirementMap: saved, errors: null } } }
    }
    if (q.includes('mutation DeleteRequirementMap')) {
      if (validationError)
        return {
          data: {
            deleteRequirementMap: {
              listingId: null,
              errors: [{ __typename: 'RequirementMapNotFoundError', message: validationError }]
            }
          }
        }
      saved = null
      return { data: { deleteRequirementMap: { listingId: 5, errors: null } } }
    }
    if (q.includes('RequirementMapExternalPrompt'))
      return promptError
        ? { errors: [{ message: 'Listing has no description or skills.' }] }
        : {
            data: {
              requirementMapExternalPrompt: { version: 1, instructions: 'Use schemaVersion: 1' }
            }
          }
    if (q.includes('mutation GenerateRequirementMap'))
      return { data: { generateRequirementMap: generatePayload } }
    if (q.includes('mutation PreviewRequirementMap'))
      return {
        data: {
          previewRequirementMap: {
            candidate: previewError
              ? null
              : {
                  needs: [
                    requirementNeed({ text: 'Corrected candidate', match: 'GAP', bulletIds: [] })
                  ]
                },
            errors: previewError
              ? [{ __typename: 'InvalidRequirementMapError', message: previewError }]
              : null
          }
        }
      }
    if (q.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    return {
      data: {
        llmUsageToday: {
          model: 'fast',
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          requestsLimit: 50,
          remainingRequests: 50,
          resetsAt: '2026-11-11T00:00:00Z'
        }
      }
    }
  }
})
const el = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const click = async (id: string) => {
  el(id)!.click()
  await flushPromises()
}
const type = async (id: string, text: string) => {
  const found = el(id)!
  const field = (
    found.matches('textarea,input') ? found : found.querySelector('textarea,input')
  ) as HTMLTextAreaElement
  field.value = text
  field.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
const chooseOwn = async () => {
  const tab = [...document.body.querySelectorAll<HTMLElement>('[role="tab"]')].find((e) =>
    e.textContent?.includes('own AI')
  )!
  tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  tab.click()
  await flushPromises()
}
const mountPage = async () => {
  const w = await mountSuspended(RequirementsPage, {
    route: '/listings/5/requirements',
    attachTo: document.body
  })
  mounted.push(w)
  await flushPromises()
  if (!profileFails) await vi.waitFor(() => expect(el('requirements-ready')).not.toBeNull())
  return w
}
const ops = (name: string) => calls.filter((c) => c.query.includes(`mutation ${name}(`))
beforeEach(() => {
  clearNuxtData()
  calls = []
  saved = savedRequirementMap()
  validationError = null
  profileFails = false
  readFails = false
  previewError = null
  promptError = false
  document.cookie = 'ai-method=; Max-Age=0; path=/'
  generatePayload = {
    result: {
      status: 'SUCCEEDED',
      content: {
        needs: [
          requirementNeed({ text: 'Generated corrected candidate', match: 'GAP', bulletIds: [] })
        ]
      },
      error: null,
      errorCode: null
    },
    errors: null
  }
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))
describe('requirements page', () => {
  it('starts empty without a saved map and lets the owner add a manual need', async () => {
    saved = null
    const w = await mountPage()
    expect(w.text()).toContain('No requirements yet')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Add requirement')!
      .trigger('click')
    await type('requirement-text-0', 'Manual need')
    await click('requirements-save')
    await vi.waitFor(() => expect(saved?.content.needs[0]!.text).toBe('Manual need'))
    await vi.waitFor(() => expect(el('requirements-status')!.textContent).toBe('Saved'))
  })
  it('blocks blank text and Language notes, preserves API errors and adopts a successful full replacement', async () => {
    saved = savedRequirementMap([
      requirementNeed({ kind: 'LANGUAGE', bulletIds: [], note: 'Fluent' })
    ])
    await mountPage()
    await type('requirement-note-0', '')
    await click('requirements-save')
    expect(ops('SaveRequirementMap')).toHaveLength(0)
    expect(document.body.textContent).toContain('Add evidence or a note')
    await type('requirement-note-0', 'Fluent Norwegian')
    await type('requirement-text-0', '')
    await click('requirements-save')
    expect(ops('SaveRequirementMap')).toHaveLength(0)
    expect(document.activeElement?.getAttribute('data-testid')).toBe('requirement-text-0')
    await type('requirement-text-0', 'Language requirement')
    validationError = 'Invalid evidence in profile'
    await click('requirements-save')
    await vi.waitFor(() =>
      expect(el('requirements-save-error')!.textContent).toContain(validationError)
    )
    expect(el('requirements-status')!.textContent).toBe('Unsaved changes')
    validationError = null
    await click('requirements-save')
    await vi.waitFor(() => expect(el('requirements-status')!.textContent).toBe('Saved'))
    expect(saved!.content.needs[0]).toMatchObject({
      text: 'Language requirement',
      note: 'Fluent Norwegian',
      bulletIds: []
    })
  })
  it('does not clear evidence on a profile error and can retry loading', async () => {
    profileFails = true
    const w = await mountPage()
    await vi.waitFor(() => expect(w.text()).toContain('Couldn’t load the requirements editor'))
    expect(el('requirements-save')).toBeNull()
    expect(saved!.content.needs[0]!.bulletIds).toEqual([100])
    profileFails = false
    await w
      .findAll('button')
      .find((b) => b.text() === 'Retry')!
      .trigger('click')
    await vi.waitFor(() => expect(el('requirements-ready')).not.toBeNull())
    expect(el('requirements-status')!.textContent).toBe('Saved')
  })
  it('loads server-corrected built-in content without saving', async () => {
    await mountPage()
    await click('requirement-ai-open')
    await click('requirement-map-run')
    await vi.waitFor(() => expect(el('requirement-discard')).not.toBeNull())
    expect(document.body.textContent).toContain('Unsaved candidate')
    expect((el('requirement-text-0') as HTMLTextAreaElement).value).toBe(
      'Generated corrected candidate'
    )
    expect(ops('SaveRequirementMap')).toHaveLength(0)
  })
  it('confirms replacement before any AI request, and Discard restores prior unsaved edits', async () => {
    await mountPage()
    await type('requirement-text-0', 'My edit')
    await click('requirement-ai-open')
    await click('requirement-map-run')
    expect(ops('GenerateRequirementMap')).toHaveLength(0)
    expect(document.body.textContent).toContain('Replace unsaved requirements?')
    const cancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) =>
        b.textContent?.trim() === 'Cancel' &&
        b.closest('[role="dialog"]')?.textContent?.includes('Replace unsaved')
    )!
    cancel.click()
    await flushPromises()
    expect(ops('GenerateRequirementMap')).toHaveLength(0)
    await click('requirement-map-run')
    await click('confirm-modal-confirm')
    await vi.waitFor(() => expect(el('requirement-discard')).not.toBeNull())
    await click('requirement-discard')
    expect((el('requirement-text-0') as HTMLTextAreaElement).value).toBe('My edit')
    expect(el('requirements-status')!.textContent).toBe('Unsaved changes')
  })
  it.each([
    'Missing schemaVersion',
    'Wrong schemaVersion',
    'Malformed JSON',
    'Unknown enum value',
    'No needs'
  ])('retains reply and edits on preview error: %s', async (message) => {
    await mountPage()
    await click('requirement-ai-open')
    await chooseOwn()
    expect(document.body.textContent).toContain('schemaVersion: 1')
    await type('requirement-map-json', '{"bad":"reply"}')
    previewError = message
    await click('requirement-map-run')
    await vi.waitFor(() => expect(document.body.textContent).toContain(message))
    expect((el('requirement-map-json') as HTMLTextAreaElement).value).toBe('{"bad":"reply"}')
    expect((el('requirement-text-0') as HTMLTextAreaElement).value).toBe(
      'Build accessible Vue applications'
    )
    expect(ops('SaveRequirementMap')).toHaveLength(0)
  })
  it('loads only the corrected external candidate', async () => {
    await mountPage()
    await click('requirement-ai-open')
    await chooseOwn()
    await type('requirement-map-json', '{"schemaVersion":1,"text":"raw"}')
    await click('requirement-map-run')
    await vi.waitFor(() => expect(el('requirement-discard')).not.toBeNull())
    expect((el('requirement-text-0') as HTMLTextAreaElement).value).toBe('Corrected candidate')
    expect(ops('SaveRequirementMap')).toHaveLength(0)
  })
  it.each([
    {
      result: { status: 'FAILED', error: 'Model busy', errorCode: 'busy', content: null },
      errors: null
    },
    {
      result: null,
      errors: [{ __typename: 'InvalidRequirementMapError', message: 'No description or skills.' }]
    },
    {
      result: null,
      errors: [
        { __typename: 'AiSafetyError', code: 'result-unavailable', message: 'Result unavailable' }
      ]
    }
  ])('keeps built-in errors in the dialog %#', async (payload) => {
    generatePayload = payload
    await mountPage()
    await click('requirement-ai-open')
    await click('requirement-map-run')
    await flushPromises()
    expect(el('requirement-discard')).toBeNull()
    expect(ops('SaveRequirementMap')).toHaveLength(0)
    expect(document.body.textContent).toContain(payload.errors?.[0]?.message ?? 'Model busy (busy)')
    if (payload.errors?.[0]?.__typename === 'AiSafetyError') {
      const retry = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('Try again (may be charged)')
      )!
      const firstId = ops('GenerateRequirementMap')[0]!.variables.input!.requestId
      generatePayload = { result: { status: 'SUCCEEDED', content: saved!.content }, errors: null }
      retry.click()
      await vi.waitFor(() => expect(ops('GenerateRequirementMap')).toHaveLength(2))
      expect(ops('GenerateRequirementMap')[1]!.variables.input!.requestId).not.toBe(firstId)
    }
  })
  it('shows prompt GraphQL errors in the own AI flow', async () => {
    promptError = true
    await mountPage()
    await click('requirement-ai-open')
    await chooseOwn()
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Listing has no description or skills.')
    )
  })
  it('confirms delete, keeps the editor on failure, then clears the cache and returns', async () => {
    const w = await mountPage()
    await click('requirements-delete')
    expect(ops('DeleteRequirementMap')).toHaveLength(0)
    const cancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Cancel'
    )!
    cancel.click()
    await flushPromises()
    expect(ops('DeleteRequirementMap')).toHaveLength(0)
    expect(saved).not.toBeNull()
    await click('requirements-delete')
    validationError = 'Map no longer exists'
    await click('confirm-modal-confirm')
    await vi.waitFor(() =>
      expect(el('requirements-save-error')!.textContent).toContain(validationError)
    )
    expect(saved).not.toBeNull()
    validationError = null
    await click('confirm-modal-confirm')
    await vi.waitFor(() => expect(saved).toBeNull())
    await vi.waitFor(() => expect(w.vm.$router.currentRoute.value.path).toBe('/listings/5'))
  })
  it('asks before leaving unsaved edits and Cancel stays on the editor', async () => {
    const router = useRouter()
    router.addRoute({
      path: '/requirements-test-root',
      component: defineComponent({ setup: () => () => h(RouterView) }),
      children: [
        { path: 'editor', component: RequirementsPage },
        { path: 'away', component: defineComponent({ render: () => h('div', 'Away') }) }
      ]
    })
    // Use a real RouterView so the route guard is registered on its own route component.
    const root = await mountSuspended(defineComponent({ render: () => h(RouterView) }), {
      route: '/requirements-test-root/editor',
      attachTo: document.body
    })
    mounted.push(root)
    await vi.waitFor(() => expect(el('requirements-ready')).not.toBeNull())
    await type('requirement-text-0', 'Unsaved')
    await router.push('/requirements-test-root/away')
    await flushPromises()
    expect(document.body.textContent).toContain('Leave without saving?')
    expect(router.currentRoute.value.path).toBe('/requirements-test-root/editor')
    const cancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Cancel'
    )!
    cancel.click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/requirements-test-root/editor')
  })
})
describe('requirements card and evidence controls', () => {
  const mountCard = async () => {
    const w = await mountSuspended(RequirementMapCard, {
      props: { listing: requirementListing() as ListingDetail },
      attachTo: document.body
    })
    mounted.push(w)
    await flushPromises()
    return w
  }
  it('shows null as empty, saved counts/review order, and all-evidenced state', async () => {
    saved = null
    let w = await mountCard()
    await vi.waitFor(() => expect(w.text()).toContain('Map requirements'))
    w.unmount()
    clearNuxtData()
    saved = savedRequirementMap([
      requirementNeed(),
      requirementNeed({ text: 'Preferred gap', importance: 'PREFERRED', match: 'GAP' }),
      requirementNeed({ text: 'Required partial', match: 'PARTIAL' }),
      requirementNeed({ text: 'Required gap', match: 'GAP' })
    ])
    w = await mountCard()
    await vi.waitFor(() => expect(w.text()).toContain('2 gap'))
    expect(w.text().indexOf('Required gap')).toBeLessThan(w.text().indexOf('Required partial'))
    expect(w.text().indexOf('Required partial')).toBeLessThan(w.text().indexOf('Preferred gap'))
    w.unmount()
    clearNuxtData()
    saved = savedRequirementMap()
    w = await mountCard()
    await vi.waitFor(() => expect(w.text()).toContain('No gaps'))
  })
  it('distinguishes errors from null and offers Retry', async () => {
    readFails = true
    const w = await mountCard()
    await vi.waitFor(() => expect(w.text()).toContain('Couldn’t load requirements'))
    expect(w.text()).not.toContain('Map requirements')
    readFails = false
    await w
      .findAll('button')
      .find((b) => b.text() === 'Retry')!
      .trigger('click')
    await vi.waitFor(() => expect(w.text()).toContain('No gaps'))
  })
  it.each(['GAP', 'LANGUAGE', 'PRACTICAL'] as const)(
    'does not offer an evidence picker for %s',
    async (value) => {
      const n = requirementNeed(value === 'GAP' ? { match: value } : { kind: value })
      const w = await mountSuspended(RequirementNeedRow, {
        props: { modelValue: n, profile: cvProfile(), index: 0 },
        attachTo: document.body
      })
      mounted.push(w)
      expect(w.text()).not.toContain('Choose evidence')
      expect(w.text()).toContain(
        value === 'GAP' ? 'A gap is saved without evidence' : 'Explain the evidence in a note'
      )
    }
  )
  it('caps bullets and entries independently at ten, allows deselection, and Cancel does not apply', async () => {
    const p = cvProfile()
    p.projects = []
    p.experiences = Array.from({ length: 11 }, (_, i) => ({
      ...p.experiences[0]!,
      id: i + 1,
      employer: `Company ${i}`,
      bullets: [{ id: i + 1, text: `Evidence ${i}`, position: 0, translations: [] }]
    }))
    const n = requirementNeed({
      bulletIds: Array.from({ length: 10 }, (_, i) => i + 1),
      entries: Array.from({ length: 10 }, (_, i) => ({ kind: 'EXPERIENCE', id: i + 1 }))
    })
    const w = await mountSuspended(RequirementEvidenceModal, {
      props: { open: true, need: n, profile: p },
      attachTo: document.body
    })
    mounted.push(w)
    await flushPromises()
    const boxes = [...document.body.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]')]
    expect(boxes.filter((b) => b.disabled)).toHaveLength(2)
    expect(boxes[0]!.disabled).toBe(false)
    boxes[1]!.click()
    await flushPromises()
    expect(boxes.at(-1)!.disabled).toBe(false)
    const cancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Cancel'
    )!
    cancel.click()
    await flushPromises()
    expect(w.emitted('apply')).toBeUndefined()
    expect(n.bulletIds).toHaveLength(10)
  })
})
