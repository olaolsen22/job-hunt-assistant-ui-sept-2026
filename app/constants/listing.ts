// Mirrors the enums in the API's schema.graphql.
export const SENIORITY_OPTIONS = [
  { label: 'Intern', value: 'INTERN' },
  { label: 'Junior', value: 'JUNIOR' },
  { label: 'Mid', value: 'MID' },
  { label: 'Senior', value: 'SENIOR' },
  { label: 'Lead', value: 'LEAD' }
] as const

export const EMPLOYMENT_TYPE_OPTIONS = [
  { label: 'Permanent', value: 'PERMANENT' },
  { label: 'Temporary', value: 'TEMPORARY' },
  { label: 'Fixed term', value: 'FIXED_TERM' },
  { label: 'Contract', value: 'CONTRACT' },
  { label: 'Internship', value: 'INTERNSHIP' },
  { label: 'Seasonal', value: 'SEASONAL' }
] as const

export const SCHEDULE_OPTIONS = [
  { label: 'Full time', value: 'FULL_TIME' },
  { label: 'Part time', value: 'PART_TIME' }
] as const

export const WORK_MODE_OPTIONS = [
  { label: 'Onsite', value: 'ONSITE' },
  { label: 'Hybrid', value: 'HYBRID' },
  { label: 'Remote', value: 'REMOTE' }
] as const

export const DEADLINE_TYPE_OPTIONS = [
  { label: 'Date', value: 'DATE' },
  { label: 'ASAP', value: 'ASAP' },
  { label: 'Not stated', value: 'UNSPECIFIED' }
] as const

export const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'ENGLISH' },
  { label: 'Norwegian', value: 'NORWEGIAN' }
] as const

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export const PROFICIENCY_OPTIONS = [
  { label: 'Beginner', value: 'BEGINNER' },
  { label: 'Good', value: 'GOOD' },
  { label: 'Very good', value: 'VERY_GOOD' },
  { label: 'Native', value: 'NATIVE' }
] as const

// Labelled, so the closed select reads on its own; the API doesn't define what each level means.
export const SKILL_LEVELS = [1, 2, 3, 4, 5].map((n) => ({ label: `Level ${n}`, value: n }))

export const LINK_KIND_OPTIONS = [
  { label: 'GitHub', value: 'GITHUB', icon: 'i-lucide-github' },
  { label: 'LinkedIn', value: 'LINKEDIN', icon: 'i-lucide-linkedin' },
  { label: 'Portfolio', value: 'PORTFOLIO', icon: 'i-lucide-briefcase-business' },
  { label: 'Other', value: 'OTHER', icon: 'i-lucide-link' }
] as const

export const PROJECT_KIND_OPTIONS = [
  { label: 'Work', value: 'WORK' },
  { label: 'Personal', value: 'PERSONAL' },
  { label: 'Coursework', value: 'COURSEWORK' },
  { label: 'Open source', value: 'OPEN_SOURCE' }
] as const

export type Seniority = (typeof SENIORITY_OPTIONS)[number]['value']
export type EmploymentType = (typeof EMPLOYMENT_TYPE_OPTIONS)[number]['value']
export type Schedule = (typeof SCHEDULE_OPTIONS)[number]['value']
export type WorkMode = (typeof WORK_MODE_OPTIONS)[number]['value']
export type DeadlineType = (typeof DEADLINE_TYPE_OPTIONS)[number]['value']
export type Language = (typeof LANGUAGE_OPTIONS)[number]['value']
export type CefrLevel = (typeof CEFR_LEVELS)[number]
export type Proficiency = (typeof PROFICIENCY_OPTIONS)[number]['value']
export type ProjectKind = (typeof PROJECT_KIND_OPTIONS)[number]['value']

export const projectKindLabel = (kind?: ProjectKind | null) =>
  PROJECT_KIND_OPTIONS.find((o) => o.value === kind)?.label

export const APPLICATION_STATUS_OPTIONS = [
  { label: 'Saved', value: 'SAVED', color: 'neutral' },
  { label: 'Applied', value: 'APPLIED', color: 'info' },
  { label: 'Interviewing', value: 'INTERVIEWING', color: 'primary' },
  { label: 'Offer', value: 'OFFER', color: 'success' },
  { label: 'Accepted', value: 'ACCEPTED', color: 'success' },
  { label: 'Rejected', value: 'REJECTED', color: 'error' },
  { label: 'Withdrawn', value: 'WITHDRAWN', color: 'neutral' }
] as const

export const OUTCOME_OPTIONS = [
  { label: 'Offer', value: 'OFFER' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Withdrawn', value: 'WITHDRAWN' }
] as const

export type Outcome = (typeof OUTCOME_OPTIONS)[number]['value']
