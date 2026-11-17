import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useTailoredCvDraft } from '~/composables/useTailoredCvDraft'
import { toTailoredCvInput } from '~/utils/tailoredCv'
import { tailoredCvFromProfile } from '../fixtures/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'
import { llmModels, unknownModelError } from '../fixtures/llmModels'

type Body = { query: string; variables: { input?: Record<string, unknown> } }

let savedDraft: unknown = null
let calls: Body[] = []
let generateReply: () => unknown
let saveErrors: unknown = null
let analyze: (input: Record<string, unknown>) => unknown
// What the API builds its prefill from.
let apiProfile = cvProfile()
let postingLanguage: 'ENGLISH' | 'NORWEGIAN' | undefined

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
    // Like the API: the asked language, else the saved draft's, else the posting's, else English.
    if (body.query.includes('query TailoredCvDraftFromProfile')) {
      const language =
        (body.variables as { language?: 'ENGLISH' | 'NORWEGIAN' }).language ??
        (savedDraft as { content: { language: 'ENGLISH' | 'NORWEGIAN' } } | null)?.content
          .language ??
        postingLanguage ??
        'ENGLISH'
      return {
        data: {
          tailoredCvDraftFromProfile: toTailoredCvInput(tailoredCvFromProfile(apiProfile, language))
        }
      }
    }
    if (body.query.includes('query TailoredCvDraft'))
      return { data: { tailoredCvDraft: savedDraft } }
    if (body.query.includes('mutation AnalyzeTailoredCvSection'))
      return { data: { analyzeTailoredCvSection: analyze(body.variables.input!) } }
    if (body.query.includes('query TailoredCvExternalPrompt'))
      return { data: { tailoredCvExternalPrompt: { instructions: 'Tailor this CV' } } }
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

const setup = async (profile = cvProfile(), posting?: 'ENGLISH' | 'NORWEGIAN') => {
  apiProfile = profile
  postingLanguage = posting
  let state!: ReturnType<typeof useTailoredCvDraft>
  await mountSuspended(
    defineComponent({
      setup() {
        state = useTailoredCvDraft(5)
        return () => h('div')
      }
    })
  )
  await Promise.all([state.query.refresh(), state.sourceQuery.refresh()])
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
  it('analyzes experience, education, projects, then skills and summary, offering each result as a suggestion on a new CV', async () => {
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
    const before = JSON.stringify(state.cv.value)
    await state.analyzeAll()

    expect(operations()).toEqual([
      'AnalyzeTailoredCvSection:EXPERIENCE',
      'AnalyzeTailoredCvSection:EDUCATION',
      'AnalyzeTailoredCvSection:PROJECT',
      'AnalyzeTailoredCvSection:SKILLS',
      'AnalyzeTailoredCvSection:SUMMARY'
    ])
    // Even an untouched first CV keeps the profile content: every change waits for review.
    expect(JSON.stringify(state.cv.value)).toBe(before)
    expect(state.pristine.value).toBe(true)
    expect(state.reviewing.value).toBe(true)
    expect(state.suggestions.value.map((s) => s.key)).toEqual([
      'experience:10',
      'education:30',
      'project:20',
      'skills',
      'summary'
    ])
    expect(state.suggestions.value.find((s) => s.key === 'summary')!.value).toBe('Tailored summary')

    state.accept('summary')
    state.accept('education:30')
    expect(state.cv.value!.summary).toBe('Tailored summary')
    expect(state.cv.value!.educations[0]).toMatchObject({ school: 'NTNU', bullets: [] })
    expect(state.cv.value!.experiences[0]!.bullets).toHaveLength(1)
    expect(state.pristine.value).toBe(false)
  })

  it('sends no save and no PDF request while suggestions are pending', async () => {
    const state = await setup()
    state.init()
    await state.analyzeSection('summary')
    expect(state.reviewing.value).toBe(true)
    calls = []

    expect(await state.save()).toBe(false)
    expect(await state.generate()).toBe(false)
    expect(operations()).toEqual([])

    state.dismiss('summary')
    expect(state.reviewing.value).toBe(false)
    expect(await state.save()).toBe(true)
    expect(operations()).toEqual(['SaveTailoredCvDraft:'])
  })

  it('drops a pending suggestion when its entry is removed from the CV', async () => {
    const state = await setup()
    state.init()
    await state.analyzeSection('experience:10')
    expect(state.suggestions.value.map((s) => s.key)).toEqual(['experience:10'])

    state.cv.value!.experiences = state.cv.value!.experiences.filter((e) => e.sourceEntryId !== 10)
    await nextTick()
    expect(state.suggestions.value).toEqual([])
    expect(state.reviewing.value).toBe(false)
  })

  it('offers no suggestion when only an entry paragraph changes while the CV prints bullets', async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput(tailoredCvFromProfile(cvProfile()))
    }
    analyze = (input) => {
      const reply = succeeded(input)
      return {
        ...reply,
        result: {
          ...reply.result,
          selectedBulletIds: [100],
          bullets: [{ text: 'Existing bullet', sourceBulletId: 100 }],
          technologies: ['Vue'],
          paragraph: 'A paragraph nobody sees'
        }
      }
    }
    const state = await setup()
    state.init()
    expect(state.cv.value!.contentStyle).toBe('BULLETS')
    await state.analyzeSection('experience:10')
    expect(state.suggestions.value).toEqual([])

    // In paragraphs mode the same reply is a change to review.
    state.cv.value!.contentStyle = 'PARAGRAPH'
    await state.analyzeSection('experience:10')
    expect(state.suggestions.value.map((s) => s.key)).toEqual(['experience:10'])
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
    expect(state.suggestions.value.map((s) => s.key)).not.toContain('skills')
    expect(state.suggestions.value.find((s) => s.key === 'summary')!.value).toBe('Tailored summary')
  })

  it('skips entries removed from this CV, so they are neither analyzed nor offered back', async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput({ ...tailoredCvFromProfile(cvProfile()), experiences: [] })
    }
    const state = await setup()
    state.init()
    expect(state.requestCount()).toBe(3)
    await state.analyzeAll()

    expect(operations()).toEqual([
      'AnalyzeTailoredCvSection:PROJECT',
      'AnalyzeTailoredCvSection:SKILLS',
      'AnalyzeTailoredCvSection:SUMMARY'
    ])
    expect(state.suggestions.value.map((s) => s.key)).not.toContain('experience:10')
    expect(state.cv.value!.experiences).toEqual([])
  })

  it('keeps the old written style when a whole-CV run writes nothing', async () => {
    analyze = (input) => ({
      result: { ...succeeded(input).result, status: 'FAILED', error: 'Model timed out' },
      errors: null
    })
    const state = await setup()
    state.init()
    state.cv.value!.template = 'CONCISE'
    await state.analyzeAll()
    expect(state.writtenTemplate.value).toBe('DETAILED')

    analyze = succeeded
    await state.analyzeAll()
    expect(state.writtenTemplate.value).toBe('CONCISE')
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

  it("offers project technologies from analysis, and a null list keeps the entry's", async () => {
    analyze = (input) => {
      const reply = succeeded(input)
      if (input.section !== 'PROJECT') return reply
      return {
        ...reply,
        result: {
          ...reply.result,
          selectedBulletIds: [200],
          bullets: [{ text: 'Project bullet', sourceBulletId: 200 }],
          technologies: ['Nuxt', 'Vue']
        }
      }
    }
    const state = await setup()
    state.init()
    expect(state.matchesProfile.value).toBe(true)
    expect(state.cv.value!.experiences[0]!.technologies).toEqual(['Vue'])
    await state.analyzeAll()
    state.accept('project:20')
    state.accept('experience:10')

    expect(state.cv.value!.projects[0]).toMatchObject({
      bullets: [{ text: 'Project bullet', sourceBulletId: 200 }],
      technologies: ['Nuxt', 'Vue']
    })
    expect(state.cv.value!.experiences[0]!.technologies).toEqual(['Vue'])
  })

  it('analyzes one project and offers it as a suggestion over a saved draft', async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput(tailoredCvFromProfile(cvProfile()))
    }
    analyze = (input) => {
      const reply = succeeded(input)
      return { ...reply, result: { ...reply.result, technologies: ['Nuxt'] } }
    }
    const state = await setup()
    state.init()
    await state.analyzeSection('project:20')

    const input = calls.find((c) => c.query.includes('mutation AnalyzeTailoredCvSection'))!
      .variables.input
    expect(input).toMatchObject({ section: 'PROJECT', sourceEntryId: 20 })
    expect(state.suggestions.value).toHaveLength(1)
    expect(state.suggestions.value[0]).toMatchObject({
      key: 'project:20',
      value: { name: 'Portfolio', technologies: ['Nuxt'] }
    })
    state.accept('project:20')
    expect(state.cv.value!.projects[0]!.technologies).toEqual(['Nuxt'])
  })

  it('sends the chosen template to analysis, the prompt and the preview of its reply', async () => {
    analyze = succeeded
    const state = await setup()
    state.init()
    state.cv.value!.template = 'CONCISE'
    await state.analyzeSection('summary')
    await state.loadPrompt()
    await state.preview('{}')
    const sent = (name: string) =>
      calls.filter((c) => c.query.includes(name)).map((c) => c.variables)
    expect(sent('mutation AnalyzeTailoredCvSection')[0]!.input).toMatchObject({
      template: 'CONCISE'
    })
    expect(sent('query TailoredCvExternalPrompt')[0]).toMatchObject({ template: 'CONCISE' })
    expect(sent('mutation PreviewTailoredCvDraft')[0]!.input).toMatchObject({
      template: 'CONCISE'
    })

    // A prompt already loaded is fetched again for the new template.
    state.cv.value!.template = 'DETAILED'
    await vi.waitFor(() =>
      expect(sent('query TailoredCvExternalPrompt')[1]).toMatchObject({ template: 'DETAILED' })
    )
  })

  it('saves the complete candidate and is clean afterwards', async () => {
    const state = await setup()
    state.init()
    state.cv.value!.phone = '+47 400 00 000'
    expect(await state.save()).toBe(true)

    const content = calls.find((c) => c.query.includes('mutation SaveTailoredCvDraft'))!.variables
      .input!.content as Record<string, unknown>
    expect(content).toMatchObject({
      fullName: 'Existing owner',
      phone: '+47 400 00 000',
      sectionOrder: 'STANDARD'
    })
    expect(Object.keys(content).sort()).toEqual(
      [
        'address',
        'certifications',
        'contentStyle',
        'dateOfBirth',
        'educations',
        'email',
        'experiences',
        'fullName',
        'headline',
        'language',
        'languages',
        'links',
        'phone',
        'projects',
        'referencesOnRequest',
        'sectionOrder',
        'skills',
        'summary',
        'template'
      ].sort()
    )
    expect(state.dirty.value).toBe(false)
    expect(state.draft.value).not.toBeNull()
  })

  it('saves the listing language with the draft before generating its CV', async () => {
    const state = await setup(cvProfile(), 'NORWEGIAN')
    state.init()
    expect(state.cv.value!.language).toBe('NORWEGIAN')

    expect(await state.generate()).toBe(true)

    const save = calls.find((c) => c.query.includes('mutation SaveTailoredCvDraft'))!
    expect(save.variables.input!.content).toMatchObject({ language: 'NORWEGIAN' })
    expect(calls.some((c) => c.query.includes('mutation GenerateCvDocument'))).toBe(true)
  })

  it("keeps a saved draft's language over the listing's", async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput(tailoredCvFromProfile(cvProfile(), 'ENGLISH'))
    }
    const state = await setup(cvProfile(), 'NORWEGIAN')
    state.init()
    expect(state.cv.value!.language).toBe('ENGLISH')
    expect(state.dirty.value).toBe(false)
  })

  it('rebuilds in another language without saving, then sends it with every AI request', async () => {
    analyze = succeeded
    const state = await setup()
    state.init()
    state.cv.value!.sectionOrder = 'DEVELOPER'

    expect(await state.reset('NORWEGIAN')).toBeNull()
    const sent = (name: string) =>
      calls.filter((c) => c.query.includes(name)).map((c) => c.variables)
    expect(sent('query TailoredCvDraftFromProfile').at(-1)).toEqual({
      listingId: 5,
      language: 'NORWEGIAN'
    })
    expect(state.cv.value!.language).toBe('NORWEGIAN')
    expect(state.cv.value!.sectionOrder).toBe('DEVELOPER')
    // Reset keeps the layout, so resetting again would change nothing.
    expect(state.matchesProfile.value).toBe(true)
    expect(operations()).not.toContain('SaveTailoredCvDraft:')

    await state.analyzeSection('summary')
    await state.loadPrompt()
    await state.preview('{}')
    expect(sent('mutation AnalyzeTailoredCvSection')[0]!.input).toMatchObject({
      language: 'NORWEGIAN'
    })
    expect(sent('query TailoredCvExternalPrompt')[0]).toMatchObject({ language: 'NORWEGIAN' })
    expect(sent('mutation PreviewTailoredCvDraft')[0]!.input).toMatchObject({
      language: 'NORWEGIAN'
    })
    expect(state.cv.value!.language).toBe('NORWEGIAN')

    // A prompt already loaded is fetched again for the new language.
    await state.reset('ENGLISH')
    await vi.waitFor(() =>
      expect(sent('query TailoredCvExternalPrompt')[1]).toMatchObject({ language: 'ENGLISH' })
    )
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
