import { describe, expect, it } from 'vitest'
import { diffBullets, diffChips, suggestionDiff } from '~/utils/tailoredCvDiff'
import { tailoredCvFromProfile } from '../fixtures/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

// Runs in the nuxt project: suggestionDiff uses the auto-imported cvSectionText.

const bullet = (text: string, sourceBulletId: number | null = null) => ({ text, sourceBulletId })

describe('diffBullets', () => {
  it('marks kept, reworded and new bullets in the suggested order, then the removed ones', () => {
    const current = [bullet('Built the app', 1), bullet('Ran the team', 2), bullet('Wrote docs', 3)]
    const suggested = [
      bullet('Ran a team of five', 2),
      bullet('Built the app', 1),
      bullet('Led QA')
    ]
    expect(diffBullets(current, suggested)).toEqual([
      { kind: 'reworded', text: 'Ran a team of five', old: 'Ran the team' },
      { kind: 'kept', text: 'Built the app' },
      { kind: 'new', text: 'Led QA' },
      { kind: 'removed', text: 'Wrote docs' }
    ])
  })

  it('pairs bullets without a source id by their text, ignoring surrounding spaces', () => {
    expect(diffBullets([bullet('Own bullet ')], [bullet('Own bullet')])).toEqual([
      { kind: 'kept', text: 'Own bullet' }
    ])
    // Without an id or the same text there is nothing to pair, so it's a new and a removed one.
    expect(diffBullets([bullet('Own bullet')], [bullet('Other bullet')])).toEqual([
      { kind: 'new', text: 'Other bullet' },
      { kind: 'removed', text: 'Own bullet' }
    ])
  })

  it('pairs each current bullet only once', () => {
    expect(diffBullets([bullet('Same', 1)], [bullet('Same', 1), bullet('Same again', 1)])).toEqual([
      { kind: 'kept', text: 'Same' },
      { kind: 'new', text: 'Same again' }
    ])
  })

  it('pairs by source id before falling back to text', () => {
    // The id-less suggestion must not take the bullet a later suggestion rewords.
    expect(diffBullets([bullet('x', 1)], [bullet('x'), bullet('x2', 1)])).toEqual([
      { kind: 'new', text: 'x' },
      { kind: 'reworded', text: 'x2', old: 'x' }
    ])
  })

  it('handles empty lists', () => {
    expect(diffBullets([], [])).toEqual([])
    expect(diffBullets([], [bullet('Added', 1)])).toEqual([{ kind: 'new', text: 'Added' }])
    expect(diffBullets([bullet('Gone', 1)], [])).toEqual([{ kind: 'removed', text: 'Gone' }])
  })
})

describe('diffChips', () => {
  const name = (s: string) => s
  it('lists kept and added in the suggested order, then removed in the current order', () => {
    expect(diffChips(['Vue', 'Figma', 'Node.js'], ['TypeScript', 'Vue'], name, name)).toEqual([
      { kind: 'added', name: 'TypeScript' },
      { kind: 'kept', name: 'Vue' },
      { kind: 'removed', name: 'Figma' },
      { kind: 'removed', name: 'Node.js' }
    ])
  })

  it('compares by id and shows the name', () => {
    const skills = [
      { id: 1, label: 'Vue' },
      { id: 2, label: 'Nuxt' }
    ]
    expect(
      diffChips(
        skills,
        [{ id: 1, label: 'Vue.js' }],
        (s) => s.id,
        (s) => s.label
      )
    ).toEqual([
      { kind: 'kept', name: 'Vue.js' },
      { kind: 'removed', name: 'Nuxt' }
    ])
  })
})

describe('suggestionDiff', () => {
  const cv = () => tailoredCvFromProfile(cvProfile())

  it('marks skills by profile id, else by name ignoring case', () => {
    const current = [
      { name: 'Vue', level: 4, sourceSkillId: 1, categoryId: null, group: null },
      { name: 'Figma', level: null, sourceSkillId: null, categoryId: null, group: null }
    ]
    const suggested = [
      { name: 'Vue 3', level: 4, sourceSkillId: 1, categoryId: null, group: null },
      { name: 'figma', level: null, sourceSkillId: null, categoryId: null, group: null },
      { name: 'Nuxt', level: null, sourceSkillId: null, categoryId: null, group: null }
    ]
    expect(suggestionDiff('skills', current, suggested, 'BULLETS')).toEqual({
      kind: 'skills',
      chips: [
        { kind: 'kept', name: 'Vue 3' },
        { kind: 'kept', name: 'figma' },
        { kind: 'added', name: 'Nuxt' }
      ]
    })
  })

  it('keeps the plain compare for short values, whole lists and removals', () => {
    expect(suggestionDiff('summary', 'Old', 'New', 'BULLETS')).toBeNull()
    expect(suggestionDiff('headline', 'Old', 'New', 'BULLETS')).toBeNull()
    expect(suggestionDiff('experiences', [], [], 'BULLETS')).toBeNull()
    expect(suggestionDiff('experience:10', cv().experiences[0], null, 'BULLETS')).toBeNull()
  })

  it('diffs an entry by bullets, showing details and technologies only when they changed', () => {
    const current = cv().experiences[0]!
    const suggested = {
      ...structuredClone(current),
      bullets: [bullet('Existing bullet, reworded', 100)]
    }
    expect(suggestionDiff('experience:10', current, suggested, 'BULLETS')).toEqual({
      kind: 'entry',
      bullets: [{ kind: 'reworded', text: 'Existing bullet, reworded', old: 'Existing bullet' }],
      technologies: undefined,
      details: undefined
    })

    const retitled = { ...suggested, title: 'Lead developer', technologies: ['Vue', 'Nuxt'] }
    const diff = suggestionDiff('experience:10', current, retitled, 'BULLETS')
    expect(diff).toMatchObject({
      technologies: [
        { kind: 'kept', name: 'Vue' },
        { kind: 'added', name: 'Nuxt' }
      ]
    })
    expect(diff?.kind === 'entry' && diff.details?.suggested).toContain('Lead developer')
    expect(diff?.kind === 'entry' && diff.details?.current).not.toContain('Lead developer')
  })

  it('compares paragraphs instead of bullets in paragraphs mode', () => {
    const current = { ...cv().experiences[0]!, paragraph: ' Old paragraph ' }
    const suggested = { ...current, paragraph: 'New paragraph' }
    expect(suggestionDiff('experience:10', current, suggested, 'PARAGRAPH')).toEqual({
      kind: 'entry',
      paragraph: { current: 'Old paragraph', suggested: 'New paragraph' },
      technologies: undefined,
      details: undefined
    })
  })
})
