import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readBody } from 'h3'
import { useRequirementMap } from '~/composables/useRequirementMap'
import type { SavedRequirementMap } from '~/composables/useRequirementMap'
import type { ProfileData } from '~/composables/useProfile'
import { cvProfile } from '../fixtures/profileCv'
import { savedRequirementMap, requirementNeed } from '../fixtures/requirementMap'
import { llmModels } from '../fixtures/llmModels'
let saved: SavedRequirementMap | null
let calls: { query: string; variables: { input?: Record<string, unknown> } }[] = []
let payloadError: string | null
let generateResult: Record<string, unknown>
let failTransport: boolean
let promptFails: boolean
let editor: ReturnType<typeof useRequirementMap>
let profile: ReturnType<typeof ref<ProfileData | null>>
const mounted: { unmount: () => void }[] = []
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    calls.push(body)
    const q = body.query
    if (q.includes('query RequirementMap(')) return { data: { requirementMap: saved } }
    if (q.includes('mutation SaveRequirementMap')) {
      if (payloadError)
        return {
          data: {
            saveRequirementMap: {
              requirementMap: null,
              errors: [{ __typename: 'InvalidRequirementMapError', message: payloadError }]
            }
          }
        }
      saved = savedRequirementMap(body.variables.input.content.needs)
      return { data: { saveRequirementMap: { requirementMap: saved, errors: null } } }
    }
    if (q.includes('mutation DeleteRequirementMap')) {
      if (payloadError)
        return {
          data: {
            deleteRequirementMap: {
              listingId: null,
              errors: [{ __typename: 'RequirementMapNotFoundError', message: payloadError }]
            }
          }
        }
      saved = null
      return { data: { deleteRequirementMap: { listingId: 5, errors: null } } }
    }
    if (q.includes('mutation GenerateRequirementMap')) {
      if (failTransport) throw new Error('network')
      return { data: { generateRequirementMap: generateResult } }
    }
    if (q.includes('RequirementMapExternalPrompt'))
      return promptFails
        ? { errors: [{ message: 'No description or skills.' }] }
        : {
            data: {
              requirementMapExternalPrompt: { version: 1, instructions: 'Return schemaVersion: 1' }
            }
          }
    if (q.includes('mutation PreviewRequirementMap'))
      return {
        data: {
          previewRequirementMap: {
            candidate: {
              needs: [requirementNeed({ text: 'Corrected', match: 'GAP', bulletIds: [] })]
            },
            errors: null
          }
        }
      }
    return { data: { llmModels: llmModels() } }
  }
})
const mountEditor = async (initial: ProfileData | null = cvProfile()) => {
  profile = ref(initial)
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        editor = useRequirementMap(5, profile)
        return () => h('div')
      }
    })
  )
  mounted.push(wrapper)
  await flushPromises()
  if (initial) await vi.waitFor(() => expect(editor.initialized.value).toBe(true))
  return editor
}
const mutations = (name: string) => calls.filter((c) => c.query.includes(`mutation ${name}(`))
beforeEach(() => {
  clearNuxtData()
  saved = savedRequirementMap()
  payloadError = null
  calls = []
  failTransport = false
  promptFails = false
  generateResult = {
    result: {
      status: 'SUCCEEDED',
      content: { needs: [requirementNeed()] },
      error: null,
      errorCode: null
    },
    errors: null
  }
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))
describe('requirement map state and persistence', () => {
  it('loads null as empty and enforces 0/1/30/31 need boundaries', async () => {
    saved = null
    await mountEditor()
    expect(editor.needs.value).toEqual([])
    expect(editor.dirty.value).toBe(false)
    expect(await editor.save()).toBe(false)
    for (const count of [1, 30]) {
      editor.needs.value = Array.from({ length: count }, () => requirementNeed())
      expect(await editor.save()).toBe(true)
    }
    editor.needs.value = Array.from({ length: 31 }, () => requirementNeed())
    expect(await editor.save()).toBe(false)
    expect(mutations('SaveRequirementMap')).toHaveLength(2)
  })
  it('marks even identical candidates unsaved; discard restores previous edits and dirty status', async () => {
    await mountEditor()
    expect(editor.dirty.value).toBe(false)
    editor.loadCandidate(saved!.content)
    expect(editor.dirty.value).toBe(true)
    editor.discard()
    expect(editor.dirty.value).toBe(false)
    editor.needs.value[0]!.text = 'My unsaved edit'
    editor.loadCandidate({ needs: [requirementNeed({ text: 'Candidate' })] })
    editor.discard()
    expect(editor.needs.value[0]!.text).toBe('My unsaved edit')
    expect(editor.dirty.value).toBe(true)
  })
  it('waits for profile success before resolving evidence and does not mark filtering dirty', async () => {
    saved = savedRequirementMap([requirementNeed({ bulletIds: [999] })])
    await mountEditor(null)
    expect(editor.initialized.value).toBe(false)
    expect(await editor.save()).toBe(false)
    profile.value = cvProfile()
    await flushPromises()
    expect(editor.normalized.value[0]!.bulletIds).toEqual([])
    expect(editor.normalized.value[0]!.match).toBe('EVIDENCED')
    expect(editor.dirty.value).toBe(false)
    expect(editor.issues.value[0]).toContain('Add evidence')
    editor.needs.value[0]!.note = 'My note'
    expect(await editor.save()).toBe(true)
    expect(mutations('SaveRequirementMap')[0]!.variables.input).toMatchObject({
      content: { needs: [{ bulletIds: [], note: 'My note' }] }
    })
  })
  it('protects local edits across saved-data and profile refresh', async () => {
    await mountEditor()
    editor.needs.value[0]!.text = 'Keep my edit'
    saved = savedRequirementMap([requirementNeed({ text: 'Server changed' })])
    await editor.query.refresh()
    profile.value = cvProfile()
    await flushPromises()
    expect(editor.needs.value[0]!.text).toBe('Keep my edit')
  })
  it('replaces the full map and adopts normalized saved response in shared query', async () => {
    saved = savedRequirementMap([requirementNeed(), requirementNeed({ text: 'Remove this' })])
    await mountEditor()
    editor.loadCandidate({
      needs: [requirementNeed({ text: 'Replacement', match: 'GAP', bulletIds: [100] })]
    })
    expect(await editor.save()).toBe(true)
    expect(saved!.content.needs).toHaveLength(1)
    expect(editor.query.data.value?.content.needs[0]).toMatchObject({
      text: 'Replacement',
      bulletIds: []
    })
    expect(editor.dirty.value).toBe(false)
    expect(editor.candidateLoaded.value).toBe(false)
    await editor.query.refresh()
    expect(editor.needs.value[0]!.text).toBe('Replacement')
  })
  it('preserves edits and saved cache on API save and delete errors', async () => {
    await mountEditor()
    editor.needs.value[0]!.text = 'Keep me'
    payloadError = 'Profile evidence changed.'
    expect(await editor.save()).toBe(false)
    expect(editor.error.value).toBe(payloadError)
    expect(editor.dirty.value).toBe(true)
    expect(await editor.remove()).toBe(false)
    expect(editor.needs.value[0]!.text).toBe('Keep me')
    expect(editor.query.data.value?.id).toBe(1)
    payloadError = null
    expect(await editor.remove()).toBe(true)
    expect(editor.query.data.value).toBeNull()
    expect(editor.dirty.value).toBe(false)
    await editor.query.refresh()
    expect(editor.query.data.value).toBeNull()
  })
})
describe('requirement map AI contract', () => {
  it('uses the returned corrected candidate without any implicit save', async () => {
    await mountEditor()
    const outcome = await editor.preview('{"schemaVersion":1,"needs":[{"text":"Raw"}]}')
    expect(outcome.value?.needs[0]).toMatchObject({
      text: 'Corrected',
      match: 'GAP',
      bulletIds: []
    })
    editor.loadCandidate(outcome.value!)
    expect(editor.needs.value[0]!.text).toBe('Corrected')
    expect(editor.dirty.value).toBe(true)
    expect(mutations('SaveRequirementMap')).toHaveLength(0)
    expect(editor.query.data.value?.content.needs[0]!.text).not.toBe('Corrected')
  })
  it('uses default model, reuses transport-retry id, and starts a fresh confirmed action', async () => {
    await mountEditor()
    failTransport = true
    expect((await editor.generate()).error).toBeTruthy()
    failTransport = false
    expect((await editor.generate()).value?.needs).toBeTruthy()
    const inputs = mutations('GenerateRequirementMap').map((c) => c.variables.input!)
    expect(inputs[0]!.requestId).toBe(inputs[1]!.requestId)
    expect(inputs[0]).not.toHaveProperty('model')
    editor.confirmRetry()
    await editor.generate()
    expect(mutations('GenerateRequirementMap')[2]!.variables.input!.requestId).not.toBe(
      inputs[1]!.requestId
    )
    expect(mutations('SaveRequirementMap')).toHaveLength(0)
  })
  it('reports failed result, payload errors, and prompt GraphQL errors without touching edits', async () => {
    await mountEditor()
    editor.needs.value[0]!.text = 'Keep'
    generateResult = {
      result: { status: 'FAILED', content: null, error: 'Model busy', errorCode: 'busy' },
      errors: null
    }
    expect((await editor.generate()).error).toBe('Model busy (busy)')
    generateResult = {
      result: null,
      errors: [{ __typename: 'InvalidRequirementMapError', message: 'No description or skills.' }]
    }
    expect((await editor.generate()).error).toBe('No description or skills.')
    promptFails = true
    await editor.loadPrompt()
    expect(editor.promptError.value).toContain('No description or skills.')
    expect(editor.needs.value[0]!.text).toBe('Keep')
  })
})
