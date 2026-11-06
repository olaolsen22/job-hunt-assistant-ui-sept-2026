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
      skills: [{ skill: { name: 'Vue' }, level: 4, minYears: 2, isRequired: false }],
      contacts: [
        {
          contact: {
            id: 5,
            name: 'Kari',
            title: null,
            email: 'kari@acme.no',
            phone: null,
            url: null,
            notes: 'Met at a meetup'
          }
        }
      ]
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
      contacts: [{ name: 'Kari', title: null, email: 'kari@acme.no', phone: null, url: null }],
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

  it('keeps the position share and role category from a parse, and drops an impossible share', () => {
    const { state, fillDraft, toInput } = useListingForm()
    fillRequired(state)
    fillDraft({ positionPercent: 80, jobRoleCategoryName: ' IT ' })
    expect(toInput()).toMatchObject({ positionPercent: 80, jobRoleCategoryName: 'IT' })

    fillDraft({ positionPercent: 180 })
    expect(toInput()).toMatchObject({ positionPercent: null, jobRoleCategoryName: null })
  })

  it("passes a parsed skill's category name through to the save", () => {
    const { state, fillDraft, toInput } = useListingForm()
    fillRequired(state)
    // Any name: the API matches it to the owner's categories and ignores one it doesn't know.
    fillDraft({ skills: [{ name: 'Vue', categoryName: ' Frameworks ' }, { name: 'Jira' }] })

    expect(toInput().skills).toEqual([
      expect.objectContaining({ name: 'Vue', categoryName: 'Frameworks' }),
      expect.objectContaining({ name: 'Jira', categoryName: null })
    ])
  })

  it('flags a merged parse as a re-analysis only when the listing was analyzed before', () => {
    const base = {
      id: 1,
      title: 'Developer',
      company: { name: 'Acme' },
      jobRole: { name: 'Developer' },
      seniority: null,
      employmentType: null,
      schedule: null,
      workMode: null,
      description: null,
      url: 'https://example.com/job',
      postedOn: '2026-09-01',
      deadlineType: 'UNSPECIFIED' as const,
      deadlineOn: null,
      postingLanguage: null,
      favoritedAt: null,
      locations: [],
      languages: [],
      skills: [],
      contacts: []
    }
    const first = useListingForm()
    first.fill({ ...base, analyzedAt: null } as never)
    first.mergeDraft({ title: 'Developer' })
    expect(first.toInput().reanalyzed).toBe(false)

    const again = useListingForm()
    again.fill({ ...base, analyzedAt: '2026-09-20T10:00:00Z' } as never)
    again.mergeDraft({ title: 'Developer' })
    expect(again.toInput().reanalyzed).toBe(true)
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

  it('cleans parsed contacts and drops blank rows', () => {
    const { state, toInput, fillDraft } = useListingForm()
    fillDraft({
      title: 'Frontend Developer',
      contacts: [
        { name: ' Kari ', email: 'kari@acme.no', phone: '' },
        { name: 'kari', title: 'Recruiter' },
        { email: 'no-name@acme.no' }
      ]
    })
    fillRequired(state)
    state.contacts.push({ name: ' ', title: null, email: null, phone: null, url: null })

    expect(toInput().contacts).toEqual([
      { name: 'Kari', title: null, email: 'kari@acme.no', phone: null, url: null }
    ])
  })

  it('adds parsed contacts to the saved ones on merge', () => {
    const { state, mergeDraft } = useListingForm()
    state.contacts = [{ name: 'Kari', title: null, email: null, phone: null, url: null }]
    mergeDraft({ contacts: [{ name: 'KARI', email: 'k@acme.no' }, { name: 'Ola' }] })

    expect(state.contacts.map((c) => c.name)).toEqual(['Kari', 'Ola'])
  })

  // updateListing replaces the whole listing, and an omitted kind would turn it into a vacancy.
  it('sends the listing kind back on save', () => {
    const { state, toInput, fill } = useListingForm()
    expect(toInput().kind).toBe('VACANCY')

    fill({
      kind: 'OPEN_INVITATION',
      title: 'Open application',
      company: { name: 'Acme' },
      jobRole: { name: 'Developer' },
      url: 'https://example.com/careers',
      postedOn: '2026-09-01',
      deadlineType: 'UNSPECIFIED',
      deadlineOn: null,
      analyzedAt: null,
      locations: [],
      languages: [],
      skills: [],
      contacts: []
    } as never)

    expect(state.kind).toBe('OPEN_INVITATION')
    expect(toInput().kind).toBe('OPEN_INVITATION')
  })

  it('takes the kind from a parsed ad, but only one the form offers', () => {
    const { state, fillDraft, mergeDraft } = useListingForm()
    fillDraft({ title: 'Open application', kind: 'OPEN_INVITATION' })
    expect(state.kind).toBe('OPEN_INVITATION')

    // A parse without a kind keeps the one already chosen.
    mergeDraft({ title: 'Open application' })
    expect(state.kind).toBe('OPEN_INVITATION')

    fillDraft({ title: 'No ad', kind: 'UNSOLICITED' })
    expect(state.kind).toBe('VACANCY')
  })

  it('saves an unsolicited application without a link or posting date', () => {
    const { state, validate, toInput } = useListingForm()
    fillRequired(state)
    state.kind = 'UNSOLICITED'
    state.url = ''
    state.postedOn = ''

    expect(validate(state)).toEqual([])
    expect(toInput()).toMatchObject({ kind: 'UNSOLICITED', url: null, postedOn: null })
  })
})
