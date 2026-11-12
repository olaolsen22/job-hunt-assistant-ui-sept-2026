import { describe, it, expect } from 'vitest'
import { cvProfile } from '../fixtures/profileCv'
import { requirementNeed as need } from '../fixtures/requirementMap'
import { profileEntries, profileBullets } from '~/utils/profileBullets'
import {
  needIssue,
  toRequirementMapInput,
  matchCounts,
  needsToReview,
  requirementMapStale
} from '~/utils/requirementMap'

describe('requirement evidence', () => {
  it('resolves all four entry kinds with overlapping ids and keeps bullet order', () => {
    const p = cvProfile()
    p.educations = [
      {
        id: 10,
        school: 'University',
        degree: 'BSc',
        field: null,
        translations: [],
        location: null,
        startMonth: null,
        endMonth: null,
        bullets: []
      }
    ]
    p.certifications = [
      {
        id: 10,
        name: 'Certificate',
        issuer: null,
        issuedMonth: null,
        expiresMonth: null,
        url: null,
        bullets: []
      }
    ]
    p.projects[0]!.id = 10
    const entries = profileEntries(p)
    expect([...entries.keys()]).toEqual([
      'EXPERIENCE:10',
      'EDUCATION:10',
      'CERTIFICATION:10',
      'PROJECT:10'
    ])
    expect(entries.get('PROJECT:10')?.name).toBe('Portfolio')
    expect(profileBullets(p).get(100)?.name).toContain('Acme')
    expect(
      toRequirementMapInput(
        [
          need({
            bulletIds: [200, 999, 100],
            entries: [
              { kind: 'PROJECT', id: 10 },
              { kind: 'EXPERIENCE', id: 99 }
            ]
          })
        ],
        p
      ).needs[0]
    ).toMatchObject({ bulletIds: [200, 100], entries: [{ kind: 'PROJECT', id: 10 }] })
  })
  it.each(['GAP', 'LANGUAGE', 'PRACTICAL'] as const)('strips evidence for %s', (value) => {
    const n = need(value === 'GAP' ? { match: value } : { kind: value })
    expect(toRequirementMapInput([n], cvProfile()).needs[0]).toMatchObject({
      bulletIds: [],
      entries: []
    })
  })
  it('keeps a stale saved match and requires repair if its last support vanished', () => {
    const n = toRequirementMapInput([need({ bulletIds: [999] })], cvProfile()).needs[0]!
    expect(n.match).toBe('EVIDENCED')
    expect(needIssue(n)).toContain('Add evidence')
  })
})
describe('strict requirement save rules', () => {
  it.each([
    [{ text: '' }, 'Describe'],
    [{ text: '  ' }, 'Describe'],
    [{ text: 'x'.repeat(201) }, '200'],
    [{ note: 'x'.repeat(501) }, '500'],
    [{ bulletIds: Array.from({ length: 11 }, (_, i) => i) }, '10 bullets'],
    [
      { entries: Array.from({ length: 11 }, (_, id) => ({ kind: 'PROJECT' as const, id })) },
      '10 entries'
    ],
    [{ bulletIds: [], note: '  ' }, 'Add evidence']
  ])('rejects invalid need %#', (overrides, message) =>
    expect(needIssue(need(overrides))).toContain(message)
  )
  it('permits exact field and independent evidence boundaries', () => {
    expect(
      needIssue(
        need({
          text: 'x'.repeat(200),
          note: 'x'.repeat(500),
          bulletIds: Array.from({ length: 10 }, (_, i) => i),
          entries: Array.from({ length: 10 }, (_, id) => ({ kind: 'PROJECT', id }))
        })
      )
    ).toBe('')
  })
  it.each(['EVIDENCED', 'PARTIAL'] as const)(
    'accepts note-only %s evidence and requires Language/Practical notes',
    (match) => {
      expect(needIssue(need({ match, bulletIds: [], note: 'Relevant adjacent experience' }))).toBe(
        ''
      )
      for (const kind of ['LANGUAGE', 'PRACTICAL'] as const) {
        const n = toRequirementMapInput([need({ kind, match, note: ' ' })], cvProfile()).needs[0]!
        expect(needIssue(n)).toContain('Add evidence')
        expect(needIssue({ ...n, note: 'Fluent written Norwegian' })).toBe('')
      }
    }
  )
  it('allows a gap without support', () =>
    expect(needIssue(need({ match: 'GAP', bulletIds: [], note: null }))).toBe(''))
  it('orders required review needs before preferred and gaps before partial', () => {
    const needs = [
      need(),
      need({ text: 'Preferred gap', importance: 'PREFERRED', match: 'GAP' }),
      need({ text: 'Required partial', match: 'PARTIAL' }),
      need({ text: 'Required gap', match: 'GAP' })
    ]
    expect(matchCounts(needs)).toEqual({ EVIDENCED: 1, PARTIAL: 1, GAP: 2 })
    expect(needsToReview(needs).map((n) => n.text)).toEqual([
      'Required gap',
      'Required partial',
      'Preferred gap'
    ])
  })
  it('hints stale only when listing changed later', () => {
    expect(requirementMapStale('2026-11-08', '2026-11-09')).toBe(true)
    expect(requirementMapStale('2026-11-08', '2026-11-08')).toBe(false)
    expect(requirementMapStale('2026-11-09', '2026-11-08')).toBe(false)
  })
})
