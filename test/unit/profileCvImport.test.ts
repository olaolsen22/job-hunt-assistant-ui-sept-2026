import { describe, expect, it } from 'vitest'
import {
  createCvDraft,
  reviewCvSelection,
  selectCvTarget,
  cvFeedback,
  cvSubmissionPaths,
  cvServerIssue,
  cvPathWithin,
  cvPathRenderable
} from '~/utils/profileCvImport'
import { cvProfile, cvCandidate, cvExperience } from '../fixtures/profileCv'

describe('reviewed CV selections', () => {
  it('defaults missing new skill levels to 1 and retains existing and supplied levels', () => {
    const draft = createCvDraft(
      cvCandidate({
        skills: [
          { name: 'New skill', level: null, categoryName: 'Frameworks' },
          { name: ' vue ', level: null },
          { name: 'Explicit', level: 5 }
        ]
      }),
      cvProfile()
    )
    expect(draft.skills.map((skill) => skill.level)).toEqual([1, 4, 5])
    expect(draft.skills[0]!.defaultNote).toContain('using level 1')
    expect(draft.skills[1]!.defaultNote).toContain('saved level')
    draft.skills[0]!.level = 2
    expect(reviewCvSelection(draft, cvProfile()).selection.skills![0]!.level).toBe(2)
    // The parsed category goes to the API untouched; it only fills an empty one there.
    expect(reviewCvSelection(draft, cvProfile()).selection.skills![0]!.categoryName).toBe(
      'Frameworks'
    )
  })

  it('maps filtered submission rows and bullets back to their original draft positions', () => {
    const draft = createCvDraft(
      cvCandidate({
        experiences: [cvExperience(), cvExperience({ bullets: ['Skip', 'Keep'] })],
        skills: [
          { name: 'Skip', level: 1 },
          { name: 'Keep', level: 3 }
        ]
      }),
      cvProfile()
    )
    draft.entries.experiences[0]!.action = 'skip'
    draft.entries.experiences[1]!.bullets[0]!.action = 'skip'
    draft.skills[0]!.include = false
    const paths = cvSubmissionPaths(draft)
    expect(cvServerIssue('Selection.Experiences[0].Bullets[0].Text: Too long', paths)).toEqual({
      path: 'experiences[1].bullets[1].text',
      message: 'Too long'
    })
    expect(cvServerIssue('selection.skills[0].level: Invalid level', paths)?.path).toBe(
      'skills[1].level'
    )
  })

  it('deduplicates live problems, retires corrected/skipped warnings and keeps source notes', () => {
    const draft = createCvDraft(
      cvCandidate({
        experiences: [cvExperience({ startMonth: null })],
        warnings: [
          { path: 'experiences[0].startMonth', message: 'Missing date' },
          { path: 'experiences[0].title', message: 'Check title against CV' },
          { path: 'source', message: 'Formatting was unclear' }
        ]
      }),
      cvProfile()
    )
    expect(cvFeedback(draft, reviewCvSelection(draft, cvProfile()).errors).warnings).toEqual([
      { path: 'experiences[0].title', message: 'Check title against CV', severity: 'warning' }
    ])
    draft.entries.experiences[0]!.title = 'Reviewed title'
    draft.entries.experiences[0]!.startMonth = '2020-01-01'
    expect(cvFeedback(draft, reviewCvSelection(draft, cvProfile()).errors).warnings).toEqual([])
    expect(cvFeedback(draft, []).notes).toHaveLength(1)
    draft.entries.experiences[0]!.action = 'skip'
    expect(cvFeedback(draft, []).warnings).toEqual([])
  })
  it('keeps entry-level notes until the entry is skipped and only lets exact errors replace warnings', () => {
    const draft = createCvDraft(
      cvCandidate({
        experiences: [cvExperience({ startMonth: null })],
        skills: [
          { name: 'Missing', level: null },
          { name: 'Unclear', level: 3 }
        ],
        warnings: [
          { path: 'experiences[0]', message: 'This role may be two separate positions.' },
          { path: 'skills[0].level', message: 'Skill level is missing from the CV.' },
          { path: 'skills[1].level', message: 'The CV may describe years, not proficiency.' }
        ]
      }),
      cvProfile()
    )
    const warnings = () =>
      cvFeedback(draft, reviewCvSelection(draft, cvProfile()).errors).warnings.map((w) => w.path)
    // The start-month error is on a child path, so it does not hide the entry's own note.
    expect(warnings()).toEqual(['experiences[0]', 'skills[1].level'])
    draft.entries.experiences[0]!.title = 'Edited title'
    draft.entries.experiences[0]!.startMonth = '2020-01-01'
    expect(warnings()).toContain('experiences[0]')
    draft.entries.experiences[0]!.action = 'skip'
    expect(warnings()).toEqual(['skills[1].level'])
  })

  it('matches paths within a prefix and recognizes only paths the review renders', () => {
    expect(cvPathWithin('skills[1].level', 'skills')).toBe(true)
    expect(cvPathWithin('skills[1].level', 'skills[1]')).toBe(true)
    expect(cvPathWithin('skillsets', 'skills')).toBe(false)
    expect(cvPathWithin('skills[10]', 'skills[1]')).toBe(false)
    for (const path of [
      'basics.location',
      'links[2]',
      'hobbies[0]',
      'skills[0]',
      'languages[1].spoken',
      'experiences[0].bullets[2]',
      'experiences[0].bullets[2].text',
      'projects[1].location.countryCode',
      'certifications[0].issuer'
    ])
      expect(cvPathRenderable(path), path).toBe(true)
    for (const path of ['contentLanguage', 'experiences[0].issuer', 'skills[0].years', 'source'])
      expect(cvPathRenderable(path), path).toBe(false)
  })

  it('omits unselected content, adds without IDs, and explicitly clears included basics', () => {
    const profile = cvProfile()
    const draft = createCvDraft(cvCandidate({ experiences: [cvExperience()] }), profile)
    draft.basics.headline.value = ''
    const result = reviewCvSelection(draft, profile)
    expect(result.errors).toEqual([])
    expect(result.selection).toMatchObject({
      contentLanguage: 'ENGLISH',
      basics: { headline: null },
      experiences: [{ title: 'Lead', bullets: [{ text: 'Incoming bullet' }] }]
    })
    expect(result.selection.basics).not.toHaveProperty('fullName')
    expect(result.selection).not.toHaveProperty('links')
    expect(result.selection).not.toHaveProperty('hobbies')
    expect(result.selection.experiences![0]).not.toHaveProperty('id')
    expect(result.selection.experiences![0]!.bullets![0]).not.toHaveProperty('id')
    draft.entries.experiences[0]!.action = 'skip'
    expect(reviewCvSelection(draft, profile).selection).not.toHaveProperty('experiences')
  })

  it('retains complete structure for an explicitly chosen update and preserves unlisted bullets', () => {
    const profile = cvProfile()
    const draft = createCvDraft(
      cvCandidate({ experiences: [cvExperience({ startMonth: null, endMonth: null })] }),
      profile
    )
    const row = draft.entries.experiences[0]!
    row.action = 'update'
    selectCvTarget(row, 'experiences', 10, profile)
    row.bullets[0]!.action = 'update'
    row.bullets[0]!.id = 100
    expect(reviewCvSelection(draft, profile)).toMatchObject({
      errors: [],
      selection: {
        experiences: [
          {
            id: 10,
            employer: 'Acme',
            title: 'Lead',
            startMonth: '2020-01-01',
            endMonth: '2022-01-01',
            location: { countryCode: 'NO', city: 'Oslo' },
            skillNames: ['Vue'],
            bullets: [{ id: 100, text: 'Incoming bullet' }]
          }
        ]
      }
    })
    expect(profile.experiences[0]!.bullets[0]!.translations).toHaveLength(1)
    row.bullets[0]!.action = 'skip'
    expect(reviewCvSelection(draft, profile).selection.experiences![0]).not.toHaveProperty(
      'bullets'
    )
    row.location = {}
    row.skillNames = []
    row.endMonth = null
    row.confirmedOngoing = true
    expect(reviewCvSelection(draft, profile).selection.experiences![0]).toMatchObject({
      location: null,
      skillNames: [],
      endMonth: null
    })
  })

  it('rejects foreign bullets and repeated targets and resets bullets when the parent changes', () => {
    const profile = cvProfile()
    const draft = createCvDraft(
      cvCandidate({ experiences: [cvExperience(), cvExperience()] }),
      profile
    )
    draft.entries.experiences.forEach((row) => {
      row.action = 'update'
      selectCvTarget(row, 'experiences', 10, profile)
    })
    const row = draft.entries.experiences[0]!
    row.bullets[0]!.action = 'update'
    row.bullets[0]!.id = 200
    const errors = reviewCvSelection(draft, profile).errors
    expect(errors.some((e) => e.path.includes('bullets'))).toBe(true)
    expect(errors.some((e) => e.message.includes('already selected'))).toBe(true)
    selectCvTarget(row, 'experiences', undefined, profile)
    expect(row.bullets[0]).toEqual({ action: 'add', text: 'Incoming bullet', id: undefined })
  })

  it('requires reviewed dates, ongoing confirmation and proficiency without blocking corrected warnings', () => {
    const profile = cvProfile()
    const draft = createCvDraft(
      cvCandidate({
        experiences: [cvExperience({ startMonth: '2020', endMonth: null })],
        skills: [{ name: 'Vue', level: null }],
        languages: [{ name: 'English', spoken: 'GOOD', written: null }],
        warnings: [{ path: 'experiences[0].startMonth', message: 'Missing month' }]
      }),
      profile
    )
    expect(reviewCvSelection(draft, profile).errors).toHaveLength(3)
    draft.entries.experiences[0]!.startMonth = '2020-05-01'
    draft.entries.experiences[0]!.confirmedOngoing = true
    draft.skills[0]!.level = 3
    draft.languages[0]!.written = 'VERY_GOOD'
    expect(reviewCvSelection(draft, profile)).toMatchObject({
      errors: [],
      selection: {
        skills: [{ name: 'Vue', level: 3 }],
        languages: [{ name: 'English', spoken: 'GOOD', written: 'VERY_GOOD' }]
      }
    })
    expect(draft.warnings).toHaveLength(1)
  })

  it('replaces only explicitly included lists, including clearing with empty arrays', () => {
    const profile = cvProfile()
    const draft = createCvDraft(cvCandidate({ hobbies: ['Hiking'] }), profile)
    expect(draft.hobbies).toEqual(['Chess', 'Hiking'])
    draft.replaceLinks = draft.replaceHobbies = true
    draft.links = []
    draft.hobbies = []
    expect(reviewCvSelection(draft, profile).selection).toMatchObject({ links: [], hobbies: [] })
  })

  it('blocks empty selections, duplicate skills, invalid URLs and full-parent bullet overflow', () => {
    const profile = cvProfile()
    const draft = createCvDraft(cvCandidate({ basics: null }), profile)
    expect(reviewCvSelection(draft, profile).count).toBe(0)
    draft.replaceLinks = true
    draft.links[0]!.url = 'bad'
    expect(reviewCvSelection(draft, profile).errors[0]!.path).toBe('links[0].url')
    draft.skills = [
      { include: true, name: 'Vue', level: 3 },
      { include: true, name: 'vue', level: 2 }
    ]
    expect(reviewCvSelection(draft, profile).errors).toContainEqual({
      path: 'skills[1].name',
      message: 'This skill is already included. Skip one copy.'
    })
    const overflowing = createCvDraft(
      cvCandidate({
        experiences: [cvExperience({ bullets: Array.from({ length: 20 }, () => 'new') })]
      }),
      profile
    )
    overflowing.entries.experiences[0]!.action = 'update'
    selectCvTarget(overflowing.entries.experiences[0]!, 'experiences', 10, profile)
    expect(
      reviewCvSelection(overflowing, profile).errors.some((e) => e.message.includes('20 bullets'))
    ).toBe(true)
  })

  it('serializes education, certifications and projects with reviewed structure', () => {
    const profile = cvProfile()
    const draft = createCvDraft(
      cvCandidate({
        educations: [
          {
            school: 'College',
            degree: 'BSc',
            field: 'CS',
            startMonth: '2010-09-01',
            endMonth: '2014-06-01',
            location: null,
            bullets: ['Studied systems']
          }
        ],
        certifications: [
          {
            name: 'Certificate',
            issuer: 'Institute',
            issuedMonth: null,
            expiresMonth: null,
            url: 'https://example.com/cert',
            bullets: []
          }
        ],
        projects: [
          {
            name: 'New project',
            url: null,
            startMonth: null,
            endMonth: null,
            location: null,
            skillNames: ['Vue'],
            bullets: []
          }
        ]
      }),
      profile
    )
    expect(reviewCvSelection(draft, profile)).toMatchObject({
      errors: [],
      selection: {
        educations: [
          {
            school: 'College',
            degree: 'BSc',
            field: 'CS',
            startMonth: '2010-09-01',
            endMonth: '2014-06-01',
            bullets: [{ text: 'Studied systems' }]
          }
        ],
        certifications: [
          {
            name: 'Certificate',
            issuer: 'Institute',
            issuedMonth: null,
            expiresMonth: null,
            url: 'https://example.com/cert'
          }
        ],
        projects: [
          { name: 'New project', url: null, startMonth: null, endMonth: null, skillNames: ['Vue'] }
        ]
      }
    })
  })
})
