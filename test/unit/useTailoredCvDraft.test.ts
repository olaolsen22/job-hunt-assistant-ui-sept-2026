import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useTailoredCvDraft } from '~/composables/useTailoredCvDraft'
import { tailoredCvFromProfile, toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'
import { llmModels, unknownModelError } from '../fixtures/llmModels'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

let savedDraft: unknown = null
let calls: Body[] = []
let generateReply: () => unknown
let saveErrors: unknown = null
let analyze: (input: Record<string, unknown>) => unknown

const succeeded = (input: Record<string, unknown>) => ({
  result: {
    status: 'SUCCEEDED',
    section: input.section,
    sourceEntryId: input.sourceEntryId,
    selectedBulletIds: [],
    selectedSkillIds: [],
    summary: input.section === 'SUMMARY' ? 'Tailored summary' : null,
    error: null
  },
  errors: null
})

registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    if (body.query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
    if (body.query.includes('query TailoredCvDraft'))
      return { data: { tailoredCvDraft: savedDraft } }
    if (body.query.includes('mutation AnalyzeTailoredCvSection'))
      return { data: { analyzeTailoredCvSection: analyze(body.variables.input!) } }
    if (body.query.includes('mutation PreviewTailoredCvDraft'))
      return {
        data: {
          previewTailoredCvDraft: {
            candidate: {
              content: toTailoredCvInput({
                ...tailoredCvFromProfile(cvProfile()),
                email: '',
                summary: 'External summary',
                skills: []
              })
            },
            errors: null
          }
        }
      }
    if (body.query.includes('mutation SaveTailoredCvDraft'))
      return {
        data: {
          saveTailoredCvDraft: {
            tailoredCvDraft: {
              id: 1,
              updatedAt: '2026-10-12T10:00:00Z',
              content: body.variables.input!.content
            },
            errors: saveErrors
          }
        }
      }
    if (body.query.includes('mutation GenerateCvDocument'))
      return { data: { generateCvDocument: generateReply() } }
    return { data: null, errors: [{ message: 'unexpected' }] }
  }
})

const setup = async (profile = cvProfile()) => {
  let state!: ReturnType<typeof useTailoredCvDraft>
  await mountSuspended(
    defineComponent({
      setup() {
        state = useTailoredCvDraft(5, ref(profile))
        return () => h('div')
      }
    })
  )
  await state.query.refresh()
  return state
}

const operations = () =>
  calls
    .filter((c) => c.query.includes('mutation'))
    .map((c) => `${c.query.match(/mutation (\w+)/)![1]}:${c.variables.input?.section ?? ''}`)

beforeEach(() => {
  clearNuxtData('llm-models')
  calls = []
  savedDraft = null
  saveErrors = null
  analyze = succeeded
  let nextId = 70
  generateReply = () => ({
    document: { id: nextId++, fileName: 'cv.pdf' },
    errors: null
  })
})

describe('useTailoredCvDraft', () => {
  it('analyzes experience, then education, then skills, then summary, filling a new candidate without saving', async () => {
    const profile = cvProfile()
    profile.educations = [
      {
        id: 30,
        school: 'NTNU',
        degree: 'MSc',
        field: 'Computer science',
        location: null,
        startMonth: '2015-08-01',
        endMonth: '2017-06-01',
        bullets: [{ id: 300, text: 'Thesis on compilers', position: 0, translations: [] }]
      }
    ]
    const state = await setup(profile)
    expect(state.init()).toBe(true)
    await state.analyzeAll()

    expect(operations()).toEqual([
      'AnalyzeTailoredCvSection:EXPERIENCE',
      'AnalyzeTailoredCvSection:EDUCATION',
      'AnalyzeTailoredCvSection:SKILLS',
      'AnalyzeTailoredCvSection:SUMMARY'
    ])
    expect(state.cv.value!.summary).toBe('Tailored summary')
    expect(state.cv.value!.experiences[0]!.bullets).toEqual([])
    expect(state.cv.value!.educations[0]).toMatchObject({ school: 'NTNU', bullets: [] })
    expect(state.suggestions.value).toEqual([])
    expect(state.dirty.value).toBe(true)
  })

  it('shows a failed section inline and still analyzes the rest', async () => {
    analyze = (input) =>
      input.section === 'SKILLS'
        ? {
            result: { ...succeeded(input).result, status: 'FAILED', error: 'Model timed out' },
            errors: null
          }
        : succeeded(input)
    const state = await setup()
    state.init()
    await state.analyzeAll()

    expect(state.sectionErrors.value.skills).toBe('Model timed out')
    expect(state.cv.value!.skills).toHaveLength(1)
    expect(state.cv.value!.summary).toBe('Tailored summary')
  })

  it('stops the whole-CV run on an unknown default model and refetches the models', async () => {
    analyze = () => ({ result: null, errors: [unknownModelError] })
    const state = await setup()
    await vi.waitFor(() => expect(calls.some((c) => c.query.includes('LlmModels'))).toBe(true))
    state.init()
    await state.analyzeAll()

    expect(operations()).toEqual(['AnalyzeTailoredCvSection:EXPERIENCE'])
    expect(Object.values(state.sectionErrors.value)).toContain(unknownModelError.message)
    expect(calls.filter((c) => c.query.includes('query LlmModels'))).toHaveLength(2)
  })

  it('offers results as suggestions over a saved draft, and Dismiss keeps the content', async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), summary: 'Mine' })
    }
    const state = await setup()
    expect(state.init()).toBe(false)
    await state.analyzeSection('summary')

    expect(state.cv.value!.summary).toBe('Mine')
    expect(state.suggestions.value).toEqual([{ key: 'summary', value: 'Tailored summary' }])
    state.dismiss('summary')
    expect(state.cv.value!.summary).toBe('Mine')
    expect(state.dirty.value).toBe(false)

    await state.analyzeSection('summary')
    state.accept('summary')
    expect(state.cv.value!.summary).toBe('Tailored summary')
    expect(state.dirty.value).toBe(true)
  })

  it('saves the complete candidate and is clean afterwards', async () => {
    const state = await setup()
    state.init()
    state.cv.value!.phone = '+47 400 00 000'
    expect(await state.save()).toBe(true)

    const content = calls.find((c) => c.query.includes('mutation SaveTailoredCvDraft'))!.variables
      .input!.content as Record<string, unknown>
    expect(content).toMatchObject({ fullName: 'Existing owner', phone: '+47 400 00 000' })
    expect(Object.keys(content).sort()).toEqual(
      [
        'certifications',
        'educations',
        'email',
        'experiences',
        'fullName',
        'headline',
        'languages',
        'links',
        'location',
        'phone',
        'projects',
        'skills',
        'summary'
      ].sort()
    )
    expect(state.dirty.value).toBe(false)
    expect(state.draft.value).not.toBeNull()
  })
  it('takes only the asked section from an external reply', async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), summary: 'Mine' })
    }
    const state = await setup()
    state.init()
    expect(await state.preview('{}', 'summary')).toBeNull()
    expect(state.suggestions.value).toEqual([{ key: 'summary', value: 'External summary' }])

    // Unscoped, every changed section is offered, and contact details stay.
    expect(await state.preview('{}')).toBeNull()
    expect(state.suggestions.value.map((s) => s.key).sort()).toEqual(['skills', 'summary'])
    expect(state.cv.value!.summary).toBe('Mine')
  })

  describe('generate', () => {
    const generations = () => calls.filter((c) => c.query.includes('mutation GenerateCvDocument'))
    const savedState = async () => {
      savedDraft = {
        id: 1,
        updatedAt: '2026-10-12T10:00:00Z',
        content: toTailoredCvInput(tailoredCvFromProfile(cvProfile()))
      }
      const state = await setup()
      state.init()
      return state
    }

    it('returns each created document and creates a new one every time', async () => {
      const state = await savedState()
      expect(await state.generate()).toBe(true)
      expect(state.generated.value).toEqual({ id: 70, fileName: 'cv.pdf' })
      expect(await state.generate()).toBe(true)
      expect(state.generated.value!.id).toBe(71)
      expect(generations().map((c) => c.variables)).toEqual([{ listingId: 5 }, { listingId: 5 }])
      expect(state.generating.value).toBe(false)
    })

    it('ignores a second call while one is running', async () => {
      const state = await savedState()
      await Promise.all([state.generate(), state.generate()])
      expect(generations()).toHaveLength(1)
    })

    it('generates from a clean saved draft without saving again', async () => {
      const state = await savedState()
      await state.generate()
      expect(operations()).toEqual(['GenerateCvDocument:'])
    })

    it('saves unsaved edits, or a first draft, before generating', async () => {
      const state = await savedState()
      state.cv.value!.phone = '+47 400 00 000'
      expect(await state.generate()).toBe(true)
      expect(operations()).toEqual(['SaveTailoredCvDraft:', 'GenerateCvDocument:'])
      expect(state.dirty.value).toBe(false)

      calls = []
      savedDraft = null
      const fresh = await setup()
      fresh.init()
      expect(await fresh.generate()).toBe(true)
      expect(operations()).toEqual(['SaveTailoredCvDraft:', 'GenerateCvDocument:'])
    })

    it('sends no generation when the save fails, and keeps the edits', async () => {
      const state = await savedState()
      state.cv.value!.phone = '+47 400 00 000'
      saveErrors = [{ __typename: 'ValidationError', message: 'Bad phone' }]
      expect(await state.generate()).toBe(false)
      expect(generations()).toHaveLength(0)
      expect(state.cv.value!.phone).toBe('+47 400 00 000')
      expect(state.dirty.value).toBe(true)
      expect(state.generating.value).toBe(false)
    })

    it('keeps edits and saves a draft that no longer exists on the next generate', async () => {
      const state = await savedState()
      state.cv.value!.phone = '+47 400 00 000'
      generateReply = () => ({
        document: null,
        errors: [{ __typename: 'TailoredCvDraftNotFoundError', message: 'No draft' }]
      })
      expect(await state.generate()).toBe(false)
      expect(state.generateError.value).toEqual({ kind: 'draft', message: 'No draft' })
      expect(state.draft.value).toBeNull()
      expect(state.dirty.value).toBe(true)

      calls = []
      generateReply = () => ({ document: { id: 72, fileName: 'cv.pdf' }, errors: null })
      expect(await state.generate()).toBe(true)
      expect(operations()).toEqual(['SaveTailoredCvDraft:', 'GenerateCvDocument:'])
      expect(state.cv.value!.phone).toBe('+47 400 00 000')
      expect(state.draft.value).not.toBeNull()
    })

    it('reports an unavailable listing and a failed request without retrying', async () => {
      const state = await savedState()
      generateReply = () => ({
        document: null,
        errors: [{ __typename: 'ListingNotFoundError', message: 'Gone' }]
      })
      await state.generate()
      expect(state.generateError.value!.kind).toBe('listing')

      generateReply = () => {
        throw new Error('boom')
      }
      expect(await state.generate()).toBe(false)
      expect(state.generateError.value!.kind).toBe('other')
      expect(state.generating.value).toBe(false)
      expect(generations()).toHaveLength(2)
    })
  })
})
