import { describe, expect, it } from 'vitest'
import { useListingForm } from '~/composables/useListingForm'

const fillRequired = (state: ReturnType<typeof useListingForm>['state']) => {
  state.title = ' Frontend Developer '
  state.companyName = 'Acme'
  state.jobRoleName = 'Developer'
  state.url = 'https://example.com/job'
}

describe('useListingForm', () => {
  it('flags missing required fields and a non-http URL', () => {
    const { state, validate } = useListingForm()
    state.url = 'example.com'

    expect(validate(state).map((e) => e.name)).toEqual([
      'title',
      'companyName',
      'jobRoleName',
      'url'
    ])

    fillRequired(state)
    expect(validate(state)).toEqual([])
  })

  it('requires a deadline date only when the type is DATE', () => {
    const { state, validate } = useListingForm()
    fillRequired(state)
    state.deadlineType = 'DATE'

    expect(validate(state).map((e) => e.name)).toEqual(['deadlineOn'])
  })

  it('builds the API input with nulls for empty fields', () => {
    const { state, toInput } = useListingForm()
    fillRequired(state)
    state.deadlineType = 'ASAP'
    state.deadlineOn = '2026-10-01'
    state.skills = [{ name: 'Vue', level: 4, isRequired: true }]

    expect(toInput()).toMatchObject({
      title: 'Frontend Developer',
      description: null,
      seniority: null,
      deadlineOn: null,
      locations: [{ countryCode: 'NO', city: null }],
      skills: [{ name: 'Vue', level: 4, minYears: null, isRequired: true }]
    })
  })

  it('fills from a fetched listing and maps back to the same input', () => {
    const { state, toInput, fill } = useListingForm()
    fill({
      id: 1,
      title: 'Frontend Developer',
      company: { name: 'Acme' },
      jobRole: { name: 'Developer' },
      seniority: null,
      employmentType: 'PERMANENT',
      schedule: null,
      workMode: null,
      description: null,
      url: 'https://example.com/job',
      postedOn: '2026-09-01',
      deadlineType: 'DATE',
      deadlineOn: '2026-10-01',
      postingLanguage: null,
      favoritedAt: null,
      analyzedAt: '2026-09-20T10:00:00Z',
      locations: [{ location: { city: null, countryCode: 'SE' } }],
      languages: [{ language: 'NORWEGIAN', level: null, isRequired: true }],
      skills: [{ skill: { name: 'Vue' }, level: 4, minYears: 2, isRequired: false }]
    })

    expect(state.companyName).toBe('Acme')
    expect(toInput()).toMatchObject({
      companyName: 'Acme',
      jobRoleName: 'Developer',
      employmentType: 'PERMANENT',
      description: null,
      deadlineOn: '2026-10-01',
      locations: [{ countryCode: 'SE', city: null }],
      languages: [{ language: 'NORWEGIAN', level: null, isRequired: true }],
      skills: [{ name: 'Vue', level: 4, minYears: 2, isRequired: false }],
      isAnalyzed: true
    })
  })

  it('fills from a parsed draft, dropping values the form cannot hold', () => {
    const { state, fillDraft } = useListingForm()
    state.url = 'https://example.com/job'
    fillDraft({
      title: 'Frontend Developer',
      companyName: 'Acme',
      jobRoleName: 'Developer',
      seniority: 'PRINCIPAL',
      workMode: 'REMOTE',
      deadlineType: 'DATE',
      deadlineOn: '2026-10-01',
      locations: [{ countryCode: 'NO', city: 'Oslo' }, { countryCode: 'XX' }],
      languages: [{ language: 'NORWEGIAN', level: 'B2' }, { language: 'KLINGON' }],
      skills: [{ name: 'Vue', level: 9 }, { name: 'vue' }, { name: '' }]
    })

    expect(state).toMatchObject({
      url: 'https://example.com/job',
      seniority: undefined,
      workMode: 'REMOTE',
      deadlineOn: '2026-10-01',
      locations: [{ countryCode: 'NO', city: 'Oslo' }],
      languages: [{ language: 'NORWEGIAN', level: 'B2', isRequired: true }],
      skills: [{ name: 'Vue', level: 3, minYears: null, isRequired: true }]
    })
  })

  it('merges a parsed draft into a saved listing, keeping what the parse lacks', () => {
    const { state, mergeDraft } = useListingForm()
    Object.assign(state, {
      title: 'Developer',
      seniority: 'MID',
      description: 'Saved description',
      url: 'https://example.com/job',
      postedOn: '2026-09-01',
      deadlineType: 'DATE',
      deadlineOn: '2026-11-01',
      locations: [{ countryCode: 'NO', city: 'Oslo' }],
      skills: [{ name: 'Vue', level: 3, minYears: null, isRequired: true }],
      isAnalyzed: false
    })
    mergeDraft({
      title: 'Senior Frontend Developer',
      seniority: 'SENIOR',
      deadlineType: 'UNSPECIFIED',
      locations: [{ countryCode: 'XX' }],
      skills: [{ name: 'TypeScript', level: 4 }]
    })

    expect(state).toMatchObject({
      title: 'Senior Frontend Developer',
      seniority: 'SENIOR',
      description: 'Saved description',
      url: 'https://example.com/job',
      postedOn: '2026-09-01',
      deadlineType: 'DATE',
      deadlineOn: '2026-11-01',
      locations: [{ countryCode: 'NO', city: 'Oslo' }],
      skills: [{ name: 'TypeScript', level: 4, minYears: null, isRequired: true }],
      isAnalyzed: true
    })
  })

  it('maps a legacy ROLLING deadline in a parsed draft to ASAP', () => {
    const { state, fillDraft } = useListingForm()
    fillDraft({ title: 'Frontend Developer', deadlineType: 'ROLLING' })

    expect(state.deadlineType).toBe('ASAP')
  })
})
