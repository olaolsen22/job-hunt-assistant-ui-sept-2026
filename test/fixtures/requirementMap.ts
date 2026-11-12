import type { RequirementNeed } from '../../app/utils/requirementMap'
import type { SavedRequirementMap } from '../../app/composables/useRequirementMap'
export const requirementNeed = (overrides: Partial<RequirementNeed> = {}): RequirementNeed => ({
  text: 'Build accessible Vue applications',
  kind: 'SKILL',
  importance: 'REQUIRED',
  match: 'EVIDENCED',
  bulletIds: [100],
  entries: [],
  note: null,
  ...overrides
})
export const savedRequirementMap = (needs = [requirementNeed()]): SavedRequirementMap => ({
  id: 1,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-08T10:00:00Z',
  content: { needs }
})
export const requirementListing = () => ({
  id: 5,
  kind: 'VACANCY',
  title: 'Frontend Developer',
  company: { id: 3, name: 'Acme', applicationCount: 0, avoidedAt: null },
  jobRole: { name: 'Developer' },
  seniority: null,
  employmentType: null,
  positionPercent: null,
  schedule: null,
  workMode: null,
  description: 'Build Vue applications',
  url: null,
  postedOn: null,
  deadlineType: 'UNSPECIFIED',
  deadlineOn: null,
  dueOn: null,
  postingLanguage: 'ENGLISH',
  favoritedAt: null,
  analyzedAt: null,
  reanalyzedAt: null,
  archivedAt: null,
  status: 'SAVED',
  statusHistory: [],
  interviews: [],
  applicationQuestions: [],
  documents: [],
  locations: [],
  languages: [],
  skills: [],
  contacts: [],
  updatedAt: '2026-11-09T10:00:00Z'
})
