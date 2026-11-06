import { describe, expect, it } from 'vitest'
import type { ProfileData } from '~/composables/useProfile'
import type { TailoredCvAnalysis } from '~/composables/useTailoredCvDraft'
import {
  clearCvFlags,
  cvFlagCounts,
  removeCvFlagItem,
  changedCvSections,
  cvSectionFromAnalysis,
  cvSectionText,
  mergeExternalCandidate,
  tailoredCvFromContent,
  tailoredCvFromProfile,
  tailoredCvToText,
  toTailoredCvInput
} from '~/utils/tailoredCv'
import { documentOriginLabel, latestUnsentDocument } from '~/utils/documents'
import { cvProfile } from '../fixtures/profileCv'

const profile = (): ProfileData => {
  const p = cvProfile()
  return {
    ...p,
    email: 'owner@example.com',
    location: { city: 'Oslo', countryCode: 'NO' },
    experiences: [
      {
        ...p.experiences[0]!,
        bullets: [
          { id: 100, text: 'Built the checkout', position: 0, translations: [] },
          { id: 101, text: 'Ran the design system', position: 1, translations: [] },
          { id: 102, text: 'Mentored juniors', position: 2, translations: [] }
        ]
      }
    ],
    skills: [
      { level: 4, experienceMonths: 24, skill: { id: 1, name: 'Vue', translations: [] } },
      { level: 3, experienceMonths: 12, skill: { id: 2, name: 'Go', translations: [] } },
      {
        level: 5,
        experienceMonths: 60,
        skill: {
          id: 3,
          name: 'Code review',
          translations: [{ language: 'NORWEGIAN', name: 'Kodegjennomgang' }]
        }
      }
    ]
  }
}

const result = (overrides: Partial<TailoredCvAnalysis>): TailoredCvAnalysis => ({
  status: 'SUCCEEDED',
  section: 'EXPERIENCE',
  sourceEntryId: 10,
  selectedBulletIds: [],
  selectedSkillIds: [],
  summary: null,
  error: null,
  ...overrides
})

describe('tailoredCvFromProfile translations', () => {
  it('uses the Norwegian summary, headline and bullets when the draft is Norwegian', () => {
    const p = profile()
    p.summary = 'English summary'
    p.headline = 'English headline'
    p.translations = [
      { language: 'NORWEGIAN', summary: 'Norsk sammendrag', headline: 'Norsk tittel' }
    ] as ProfileData['translations']
    p.experiences[0]!.bullets[0]!.translations = [
      { language: 'NORWEGIAN', text: 'Bygde kassen' }
    ] as ProfileData['experiences'][number]['bullets'][number]['translations']

    const cv = tailoredCvFromProfile(p, 'NORWEGIAN')

    expect(cv.summary).toBe('Norsk sammendrag')
    expect(cv.headline).toBe('Norsk tittel')
    expect(cv.experiences[0]!.bullets.map((b) => b.text)).toEqual([
      'Bygde kassen',
      'Ran the design system',
      'Mentored juniors'
    ])
    expect(tailoredCvFromProfile(p, 'ENGLISH').summary).toBe('English summary')
  })
})

describe('tailored CV candidate', () => {
  it('starts from the whole profile with contact fields and source ids', () => {
    const cv = tailoredCvFromProfile(profile())
    expect(cv.fullName).toBe('Existing owner')
    expect(cv.email).toBe('owner@example.com')
    expect(cv.address).toBe('Oslo, Norway')
    expect(cv.links).toEqual([{ label: 'GitHub', url: 'https://github.com/owner' }])
    expect(cv.experiences[0]).toMatchObject({ sourceEntryId: 10, employer: 'Acme' })
    expect(cv.contentStyle).toBe('BULLETS')
    expect(cv.template).toBe('DETAILED')
    expect(cv.experiences[0]!.bullets.map((b) => b.sourceBulletId)).toEqual([100, 101, 102])
    expect(cv.skills.map((s) => s.sourceSkillId)).toEqual([1, 2, 3])
  })

  it('carries the analysis paragraph and sends the CV-wide style', () => {
    const cv = tailoredCvFromProfile(profile())
    const section = cvSectionFromAnalysis(
      cv,
      profile(),
      result({ selectedBulletIds: [100], paragraph: 'Built checkout flows.' })
    )
    const experience = section!.value as (typeof cv.experiences)[number]
    expect(experience.paragraph).toBe('Built checkout flows.')
    cv.experiences[0] = experience
    cv.contentStyle = 'PARAGRAPH'
    cv.template = 'CONCISE'
    const input = toTailoredCvInput(cv)
    expect(input.contentStyle).toBe('PARAGRAPH')
    expect(input.template).toBe('CONCISE')
    expect(input.experiences?.[0]?.paragraph).toBe('Built checkout flows.')
  })

  it("takes the result's bullet text over the profile's, and keeps the edited title", () => {
    const cv = tailoredCvFromProfile(profile())
    cv.experiences[0]!.title = 'Senior developer'
    // Concise shortens the text; the source ids still point at the profile bullets.
    const bullets = [
      { text: 'Built checkout', sourceBulletId: 100 },
      { text: 'Mentored juniors', sourceBulletId: 102 }
    ]
    const section = cvSectionFromAnalysis(
      cv,
      profile(),
      result({ selectedBulletIds: [102, 100], bullets })
    )
    expect(section?.key).toBe('experience:10')
    expect(section?.value).toMatchObject({ title: 'Senior developer', bullets })
  })

  it('keeps only the selected skills and takes the suggested summary', () => {
    const cv = tailoredCvFromProfile(profile())
    const skills = cvSectionFromAnalysis(
      cv,
      profile(),
      result({ section: 'SKILLS', sourceEntryId: null, selectedSkillIds: [3, 1] })
    )
    // The AI's order (most relevant first) wins over the profile's order.
    expect((skills?.value as { name: string }[]).map((s) => s.name)).toEqual(['Code review', 'Vue'])
    // A Norwegian draft names an added skill by its Norwegian translation when there is one.
    const norwegian = cvSectionFromAnalysis(
      { ...cv, language: 'NORWEGIAN' },
      profile(),
      result({ section: 'SKILLS', sourceEntryId: null, selectedSkillIds: [3, 1] })
    )
    expect((norwegian?.value as { name: string }[]).map((s) => s.name)).toEqual([
      'Kodegjennomgang',
      'Vue'
    ])
    const summary = cvSectionFromAnalysis(
      cv,
      profile(),
      result({ section: 'SUMMARY', sourceEntryId: null, summary: 'Fits the role' })
    )
    expect(summary).toEqual({ key: 'summary', value: 'Fits the role' })
  })

  it('keeps only the selected education bullets and the entry fields', () => {
    const p = profile()
    p.educations = [
      {
        id: 30,
        school: 'NTNU',
        degree: 'MSc',
        field: null,
        location: null,
        startMonth: null,
        endMonth: null,
        bullets: [
          { id: 300, text: 'Thesis on compilers', position: 0, translations: [] },
          { id: 301, text: 'Student council', position: 1, translations: [] }
        ]
      }
    ]
    const cv = tailoredCvFromProfile(p)
    cv.educations[0]!.degree = 'Master of Science'
    const section = cvSectionFromAnalysis(
      cv,
      p,
      result({
        section: 'EDUCATION',
        sourceEntryId: 30,
        selectedBulletIds: [300],
        bullets: [{ text: 'Thesis on compilers', sourceBulletId: 300 }]
      })
    )
    expect(section?.key).toBe('education:30')
    expect(section?.value).toMatchObject({
      degree: 'Master of Science',
      bullets: [{ text: 'Thesis on compilers', sourceBulletId: 300 }]
    })
  })

  it('fills entry technologies by profile level then name, in the draft language, and the project type', () => {
    const p = profile()
    const skill = (id: number, name: string) => ({ id, name, translations: [] })
    p.experiences[0]!.skills = [
      skill(2, 'Go'),
      skill(9, 'Make'),
      skill(1, 'Vue'),
      {
        id: 3,
        name: 'Code review',
        translations: [{ language: 'NORWEGIAN', name: 'Kodegjennomgang' }]
      }
    ]
    p.projects[0] = { ...p.projects[0]!, kind: 'PERSONAL', skills: [skill(1, 'Vue')] }

    const cv = tailoredCvFromProfile(p, 'NORWEGIAN')
    // Level 5, 4, 3, then the skill missing from the profile list.
    expect(cv.experiences[0]!.technologies).toEqual(['Kodegjennomgang', 'Vue', 'Go', 'Make'])
    expect(cv.projects[0]).toMatchObject({ kind: 'PERSONAL', technologies: ['Vue'] })
    expect(tailoredCvFromProfile(profile()).projects[0]!.kind).toBeNull()
  })

  it('replaces entry technologies only when the analysis returns a list', () => {
    const cv = tailoredCvFromProfile(profile())
    cv.experiences[0]!.technologies = ['Mine']
    const kept = cvSectionFromAnalysis(cv, profile(), result({ technologies: null }))
    expect(kept?.value).toMatchObject({ technologies: ['Mine'] })
    const replaced = cvSectionFromAnalysis(cv, profile(), result({ technologies: ['Go', 'Vue'] }))
    expect(replaced?.value).toMatchObject({ technologies: ['Go', 'Vue'] })
  })

  it('takes a project result from the projects, never an experience with the same id', () => {
    const p = profile()
    p.projects[0] = { ...p.projects[0]!, id: 10 }
    const cv = tailoredCvFromProfile(p)
    cv.projects[0]!.name = 'Renamed'
    const section = cvSectionFromAnalysis(
      cv,
      p,
      result({ section: 'PROJECT', sourceEntryId: 10, technologies: ['Nuxt'] })
    )
    expect(section?.key).toBe('project:10')
    expect(section?.value).toMatchObject({ name: 'Renamed', bullets: [], technologies: ['Nuxt'] })
    expect(
      cvSectionFromAnalysis(cv, p, result({ section: 'PROJECT', sourceEntryId: 99 }))
    ).toBeNull()
  })

  it('always sends the project type and cleans the technologies', () => {
    const cv = tailoredCvFromProfile(profile())
    cv.projects[0]!.technologies = [' Vue ', 'vue', '', 'Nuxt']
    cv.experiences[0]!.technologies = []
    const input = toTailoredCvInput(cv)
    expect(input.projects![0]).toHaveProperty('kind', null)
    expect(input.projects![0]!.technologies).toEqual(['Vue', 'Nuxt'])
    expect(input.experiences![0]!.technologies).toEqual([])

    const saved = tailoredCvFromContent({
      ...input,
      experiences: [{ ...input.experiences![0]!, technologies: null }],
      projects: [{ ...input.projects![0]!, kind: undefined }]
    } as Parameters<typeof tailoredCvFromContent>[0])
    expect(saved.experiences[0]!.technologies).toEqual([])
    expect(saved.projects[0]!.kind).toBeNull()
  })

  it('shows the project type and technologies in the compare text', () => {
    const project = {
      ...tailoredCvFromProfile(profile()).projects[0]!,
      kind: 'OPEN_SOURCE' as const,
      technologies: ['Vue', 'Nuxt']
    }
    expect(cvSectionText('project:20', project)).toBe(
      'Portfolio (Open source project)\n- Project bullet\nTechnologies: Vue, Nuxt'
    )
  })

  it('suggests nothing for a failed section', () => {
    const cv = tailoredCvFromProfile(profile())
    expect(
      cvSectionFromAnalysis(cv, profile(), result({ status: 'FAILED', error: 'x' }))
    ).toBeNull()
  })

  it('keeps contact details and layout from the candidate when taking an external reply', () => {
    const cv = { ...tailoredCvFromProfile(profile()), sectionOrder: 'DEVELOPER' as const }
    const external = {
      ...tailoredCvFromProfile(profile()),
      email: '',
      fullName: '',
      summary: 'New'
    }
    const merged = mergeExternalCandidate(cv, external)
    expect(merged).toMatchObject({
      email: 'owner@example.com',
      fullName: 'Existing owner',
      summary: 'New',
      sectionOrder: 'DEVELOPER'
    })
    expect(changedCvSections(cv, merged).map((s) => s.key)).toEqual(['summary'])
    // No headline in the reply keeps the draft's; a new one is offered.
    expect(mergeExternalCandidate(cv, { ...external, headline: '' }).headline).toBe(cv.headline)
    expect(mergeExternalCandidate(cv, { ...external, headline: 'Lead' }).headline).toBe('Lead')
  })

  it('sends the complete candidate with blanks as null and empty bullets dropped', () => {
    const cv = tailoredCvFromProfile(profile())
    cv.phone = '  '
    cv.experiences[0]!.bullets.push({ text: ' ', sourceBulletId: null })
    const input = toTailoredCvInput(cv)
    expect(input.phone).toBeNull()
    expect(input.email).toBe('owner@example.com')
    expect(input.experiences).toHaveLength(1)
    expect(input.experiences![0]!.bullets).toHaveLength(3)
    expect(input.projects).toHaveLength(1)
    expect(input.languages).toEqual([{ name: 'Norwegian', spoken: 'NATIVE', written: 'VERY_GOOD' }])
  })

  it('renders plain text with contact details first and sections in order', () => {
    const cv = tailoredCvFromProfile(profile())
    cv.summary = 'Frontend developer.'
    cv.experiences[0]!.location = 'Lagos, Nigeria'
    const text = tailoredCvToText(cv)
    expect(text.startsWith('Existing owner\nEngineer\nowner@example.com · Oslo, Norway')).toBe(true)
    expect(text).toContain(
      'Developer – Acme (Jan 2020 – Jan 2022, Lagos, Nigeria)\n- Built the checkout'
    )
    const order = ['SUMMARY', 'EXPERIENCE', 'PROJECTS', 'SKILLS', 'LANGUAGES'].map((h) =>
      text.indexOf(`\n${h}\n`)
    )
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(text).toContain('Norwegian (spoken: Native, written: Very good)')
  })
})

describe('latestUnsentDocument', () => {
  const doc = (id: number, kind: string, createdAt: string, sentAt: string | null = null) => ({
    id,
    kind,
    createdAt,
    sentAt
  })

  it('picks the newest unsent CV', () => {
    const latest = latestUnsentDocument(
      [
        doc(1, 'CV', '2026-10-01T10:00:00Z'),
        doc(2, 'CV', '2026-10-03T10:00:00Z'),
        doc(3, 'CV', '2026-10-02T10:00:00Z')
      ],
      'CV'
    )
    expect(latest?.id).toBe(2)
  })

  it('skips sent CVs and cover letters', () => {
    const latest = latestUnsentDocument(
      [
        doc(1, 'CV', '2026-10-01T10:00:00Z'),
        doc(2, 'CV', '2026-10-05T10:00:00Z', '2026-10-06T10:00:00Z'),
        doc(3, 'COVER_LETTER', '2026-10-07T10:00:00Z')
      ],
      'CV'
    )
    expect(latest?.id).toBe(1)
  })

  it('skips a CV template copy, which is not the listing’s own CV', () => {
    const latest = latestUnsentDocument(
      [
        { ...doc(1, 'CV', '2026-10-01T10:00:00Z'), origin: 'TAILORED' },
        { ...doc(2, 'CV', '2026-10-05T10:00:00Z'), origin: 'BASE_CV' }
      ],
      'CV'
    )
    expect(latest?.id).toBe(1)
  })

  it('picks cover letters when asked', () => {
    const latest = latestUnsentDocument(
      [doc(1, 'CV', '2026-10-05T10:00:00Z'), doc(2, 'COVER_LETTER', '2026-10-01T10:00:00Z')],
      'COVER_LETTER'
    )
    expect(latest?.id).toBe(2)
  })

  it('returns nothing without an unsent CV', () => {
    expect(
      latestUnsentDocument([doc(1, 'COVER_LETTER', '2026-10-01T10:00:00Z')], 'CV')
    ).toBeUndefined()
  })
})

describe('documentOriginLabel', () => {
  it('names the CV template and version a CV was made from', () => {
    expect(
      documentOriginLabel({
        origin: 'BASE_CV',
        baseCvVersion: { number: 3, baseCv: { name: 'Frontend (EN)' } }
      })
    ).toBe('CV template: Frontend (EN) v3')
  })

  it('names tailored and uploaded documents, and nothing for ones from before origins', () => {
    expect(documentOriginLabel({ origin: 'TAILORED' })).toBe('Tailored for this listing')
    expect(documentOriginLabel({ origin: 'UPLOADED' })).toBe('Uploaded')
    expect(documentOriginLabel({ origin: null })).toBeUndefined()
  })
})

describe('untranslated field flags', () => {
  it('groups paths by the card that shows them', () => {
    const counts = cvFlagCounts([
      'summary',
      'headline',
      'experiences[0].bullets[2]',
      'experiences[0].title',
      'projects[1].paragraph',
      'skills[3].group'
    ])
    expect(Object.fromEntries(counts)).toEqual({
      summary: 1,
      contact: 1,
      'experiences[0]': 2,
      'projects[1]': 1,
      skills: 1
    })
    expect(clearCvFlags(['summary', 'experiences[0].title'], 'experiences[0]')).toEqual(['summary'])
  })

  it('drops a removed item’s paths and moves later ones up', () => {
    expect(
      removeCvFlagItem(
        ['experiences[0].title', 'experiences[1].bullets[0]', 'experiences[2].title', 'summary'],
        'experiences',
        1
      )
    ).toEqual(['experiences[0].title', 'experiences[1].title', 'summary'])
  })
})
