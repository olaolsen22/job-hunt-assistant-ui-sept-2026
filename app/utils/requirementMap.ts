import type { RequirementMapContent } from '~/composables/useRequirementMap'
import type { ProfileData } from '~/composables/useProfile'
import { profileEntries, profileBullets } from '~/utils/profileBullets'

export type RequirementNeed = RequirementMapContent['needs'][number]
export const REQUIREMENT_KINDS = [
  { label: 'Skill', value: 'SKILL' },
  { label: 'Duty', value: 'DUTY' },
  { label: 'Qualification', value: 'QUALIFICATION' },
  { label: 'Language', value: 'LANGUAGE' },
  { label: 'Practical', value: 'PRACTICAL' }
]
export const REQUIREMENT_IMPORTANCE = [
  { label: 'Required', value: 'REQUIRED' },
  { label: 'Preferred', value: 'PREFERRED' }
]
export const REQUIREMENT_MATCHES = [
  { label: 'Evidenced', value: 'EVIDENCED', icon: 'i-lucide-check' },
  { label: 'Partial', value: 'PARTIAL', icon: 'i-lucide-circle-minus' },
  { label: 'Gap', value: 'GAP', icon: 'i-lucide-circle-alert' }
]
export const allowsRequirementEvidence = (need: RequirementNeed) =>
  need.match !== 'GAP' && need.kind !== 'LANGUAGE' && need.kind !== 'PRACTICAL'

export const newRequirementNeed = (): RequirementNeed => ({
  text: '',
  kind: 'SKILL',
  importance: 'REQUIRED',
  match: 'GAP',
  note: null,
  bulletIds: [],
  entries: []
})

// Resolve only against a successfully loaded profile; callers keep errors distinct from empty data.
export const toRequirementMapInput = (
  needs: RequirementNeed[],
  profile: ProfileData
): RequirementMapContent => {
  const bullets = profileBullets(profile)
  const entries = profileEntries(profile)
  return {
    needs: needs.map((need) => ({
      ...need,
      note: need.note?.trim() ? need.note : null,
      bulletIds: allowsRequirementEvidence(need)
        ? need.bulletIds.filter((id) => bullets.has(id))
        : [],
      entries: allowsRequirementEvidence(need)
        ? need.entries
            .filter((e) => entries.has(`${e.kind}:${e.id}`))
            .map((e) => ({ kind: e.kind, id: e.id }))
        : []
    }))
  }
}
export const needIssue = (need: RequirementNeed) => {
  if (!need.text.trim()) return 'Describe the requirement.'
  if (need.text.length > 200) return 'Use at most 200 characters for the requirement.'
  if ((need.note?.length ?? 0) > 500) return 'Use at most 500 characters for the note.'
  if (need.bulletIds.length > 10) return 'Choose at most 10 bullets.'
  if (need.entries.length > 10) return 'Choose at most 10 entries.'
  if (need.match !== 'GAP' && !(need.note?.trim() || need.bulletIds.length || need.entries.length))
    return 'Add evidence or a note, or mark this as a gap.'
  return ''
}
export const matchCounts = (needs: RequirementNeed[]) => ({
  EVIDENCED: needs.filter((n) => n.match === 'EVIDENCED').length,
  PARTIAL: needs.filter((n) => n.match === 'PARTIAL').length,
  GAP: needs.filter((n) => n.match === 'GAP').length
})
export const needsToReview = (needs: RequirementNeed[]) =>
  needs
    .filter((n) => n.match !== 'EVIDENCED')
    .toSorted(
      (a, b) =>
        Number(b.importance === 'REQUIRED') - Number(a.importance === 'REQUIRED') ||
        Number(b.match === 'GAP') - Number(a.match === 'GAP')
    )
export const requirementMapStale = (mapUpdatedAt: string, listingUpdatedAt: string) =>
  Date.parse(listingUpdatedAt) > Date.parse(mapUpdatedAt)
