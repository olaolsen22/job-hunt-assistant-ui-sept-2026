import { describe, expect, it } from 'vitest'
import {
  basicsFromJson,
  fillEmptyBasics,
  fillEmptyResearch,
  hasCompanyResearch,
  isValidOrgNumber,
  parseCompaniesReply,
  researchFromJson,
  researchSummary,
  type ResearchForm
} from '~/utils/companyResearch'

describe('company research from AI JSON', () => {
  it('keeps valid values and normalizes the org.nr and skills', () => {
    const { research, ignored } = researchFromJson({
      orgNumber: '923 609 016',
      websiteUrl: ' https://example.no ',
      kind: 'PRODUCT',
      sizeBand: 'MEDIUM',
      foundedYear: 2008,
      description: 'Makes things.',
      workMode: 'HYBRID',
      workingLanguage: 'NORWEGIAN',
      skills: ['Vue', ' vue ', 'C#', '', 3]
    })
    expect(ignored).toEqual([])
    expect(research).toEqual({
      orgNumber: '923609016',
      websiteUrl: 'https://example.no',
      careersUrl: null,
      linkedInUrl: null,
      kind: 'PRODUCT',
      sizeBand: 'MEDIUM',
      foundedYear: 2008,
      description: 'Makes things.',
      workMode: 'HYBRID',
      workingLanguage: 'NORWEGIAN',
      skills: ['Vue', 'C#'],
      contacts: []
    })
  })

  it('keeps named contacts once each, with empty values as null and bad links dropped', () => {
    const { research, ignored } = researchFromJson({
      contacts: [
        {
          name: ' Kari Nordmann ',
          title: 'Recruiter',
          email: 'kari@acme.no',
          url: 'https://x.no/k'
        },
        { name: 'kari nordmann', title: 'Duplicate' },
        { title: 'No name' },
        { name: 'Ola', phone: ' ', url: 'linkedin.com/in/ola' },
        'not a contact'
      ]
    })
    expect(research.contacts).toEqual([
      {
        name: 'Kari Nordmann',
        title: 'Recruiter',
        email: 'kari@acme.no',
        phone: null,
        url: 'https://x.no/k'
      },
      { name: 'Ola', title: null, email: null, phone: null, url: null }
    ])
    expect(ignored).toEqual(['link for Ola “linkedin.com/in/ola”'])
    expect(researchSummary(research)).toBe('2 contacts')
  })

  it('drops values the API would reject and lists them', () => {
    const { research, ignored } = researchFromJson({
      orgNumber: '123456789',
      careersUrl: 'javascript:alert(1)',
      kind: 'BANK',
      foundedYear: 1700,
      description: 'x'.repeat(501),
      skills: Array.from({ length: 52 }, (_, i) => `Skill ${i}`)
    })
    expect(research).toMatchObject({
      orgNumber: null,
      careersUrl: null,
      kind: null,
      foundedYear: null,
      description: null
    })
    expect(research.skills).toHaveLength(50)
    expect(ignored).toEqual([
      'description over 500 characters',
      '2 skills over 50',
      'org.nr “123456789”',
      'careers page “javascript:alert(1)”',
      'type “BANK”',
      'founded “1700”'
    ])
  })

  it('treats missing and null values as not researched, without warnings', () => {
    const { research, ignored } = researchFromJson({ kind: null, websiteUrl: '' })
    expect(ignored).toEqual([])
    expect(researchSummary(research)).toBe('')
  })

  it('checks the org.nr check digit', () => {
    expect(isValidOrgNumber('923609016')).toBe(true)
    expect(isValidOrgNumber('923609017')).toBe(false)
    expect(isValidOrgNumber('92360901')).toBe(false)
  })
})

const emptyForm = (): ResearchForm => ({
  orgNumber: '',
  websiteUrl: '',
  careersUrl: '',
  linkedInUrl: '',
  description: '',
  skills: []
})

describe('filling only the empty research fields', () => {
  it('keeps saved values and fills the rest', () => {
    const form: ResearchForm = {
      ...emptyForm(),
      description: 'Mine.',
      kind: 'PRODUCT',
      skills: ['Vue']
    }
    const { research } = researchFromJson({
      description: 'AI text.',
      kind: 'AGENCY',
      workingLanguage: 'ENGLISH',
      careersUrl: 'https://acme.no/jobs',
      skills: ['Go']
    })

    const result = fillEmptyResearch(form, research)

    expect(form).toMatchObject({
      description: 'Mine.',
      kind: 'PRODUCT',
      workingLanguage: 'ENGLISH',
      careersUrl: 'https://acme.no/jobs',
      skills: ['Vue']
    })
    expect(result).toEqual({
      filled: ['careers page', 'working language'],
      kept: ['description', 'type', 'skills']
    })
  })

  it('fills skills when there are none, and reports nothing when the AI found nothing', () => {
    const form = emptyForm()
    expect(fillEmptyResearch(form, researchFromJson({ skills: ['Go', 'Rust'] }).research)).toEqual({
      filled: ['skills'],
      kept: []
    })
    expect(form.skills).toEqual(['Go', 'Rust'])
    expect(fillEmptyResearch(emptyForm(), researchFromJson({}).research)).toEqual({
      filled: [],
      kept: []
    })
  })
})

describe('companies in an AI reply', () => {
  it('takes the array out of a fenced reply and skips non-objects', () => {
    expect(parseCompaniesReply('Here:\n```json\n[{"name":"Bekk"}, null, 3]\n```')).toEqual({
      rows: [{ name: 'Bekk' }]
    })
  })

  it('explains an invalid or empty reply', () => {
    expect(parseCompaniesReply('nope')).toEqual({
      error: 'That doesn’t look like a valid JSON array.'
    })
    expect(parseCompaniesReply('[]')).toEqual({ error: 'No companies found in that reply.' })
  })
})

describe('whether a company has research', () => {
  it('counts any research field or skill, not the name or researchedAt', () => {
    expect(hasCompanyResearch({ skills: [], description: null, kind: null })).toBe(false)
    expect(hasCompanyResearch({ skills: [], foundedYear: 2001 })).toBe(true)
    expect(hasCompanyResearch({ skills: [{ skill: { name: 'Go' } }] })).toBe(true)
  })
})

describe('industry and locations from AI JSON', () => {
  it('keeps valid locations, lists bad country codes, and fills only an empty form', () => {
    const basics = basicsFromJson({
      industryName: ' Software ',
      locations: [{ city: ' Oslo ', countryCode: 'NO' }, { city: 'X', countryCode: 'ZZ' }, null]
    })
    expect(basics).toEqual({
      industryName: 'Software',
      locations: [{ countryCode: 'NO', city: 'Oslo' }],
      ignored: ['location “X, ZZ”']
    })

    const empty = { industryName: undefined as string | undefined, locations: [] }
    expect(fillEmptyBasics(empty, basics)).toEqual({ filled: ['industry', 'locations'], kept: [] })
    expect(empty).toEqual({
      industryName: 'Software',
      locations: [{ countryCode: 'NO', city: 'Oslo' }]
    })

    const saved = { industryName: 'Retail', locations: [{ countryCode: 'SE', city: 'Malmö' }] }
    expect(fillEmptyBasics(saved, basics)).toEqual({ filled: [], kept: ['industry', 'locations'] })
    expect(saved.industryName).toBe('Retail')
  })
})
