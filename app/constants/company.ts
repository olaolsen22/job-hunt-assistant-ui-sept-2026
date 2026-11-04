// Mirrors the CompanyKind and CompanySize enums in the API's schema.graphql.
export const COMPANY_KIND_OPTIONS = [
  { label: 'Product company', value: 'PRODUCT' },
  { label: 'Consultancy', value: 'CONSULTANCY' },
  { label: 'In-house IT', value: 'IN_HOUSE' },
  { label: 'Public sector', value: 'PUBLIC_SECTOR' },
  { label: 'Agency', value: 'AGENCY' },
  { label: 'Startup', value: 'STARTUP' },
  { label: 'Recruitment agency', value: 'RECRUITMENT' },
  { label: 'Consultant broker', value: 'BROKER' }
] as const

// `label` names the band with its range for the select; `range` is the short form for badges.
export const COMPANY_SIZE_OPTIONS = [
  { label: 'Micro (1–10)', value: 'MICRO', range: '1–10' },
  { label: 'Small (11–50)', value: 'SMALL', range: '11–50' },
  { label: 'Medium (51–200)', value: 'MEDIUM', range: '51–200' },
  { label: 'Large (201–1000)', value: 'LARGE', range: '201–1000' },
  { label: 'Enterprise (1000+)', value: 'ENTERPRISE', range: '1000+' }
] as const

export type CompanyKind = (typeof COMPANY_KIND_OPTIONS)[number]['value']
export type CompanySize = (typeof COMPANY_SIZE_OPTIONS)[number]['value']

export const companyKindLabel = (kind?: CompanyKind | null) =>
  COMPANY_KIND_OPTIONS.find((o) => o.value === kind)?.label

export const companySizeRange = (size?: CompanySize | null) =>
  COMPANY_SIZE_OPTIONS.find((o) => o.value === size)?.range

export const DESCRIPTION_MAX = 500
export const SKILLS_MAX = 50
export const FOUNDED_MIN = 1800

// The /companies type tabs. Employers lists the hiring types rather than "not consultancy", so a
// company without a type yet (not researched) shows only under All, as do recruiters and brokers.
export const COMPANY_TABS = [
  { label: 'All', value: 'all', icon: 'i-lucide-building-2', noun: ['company', 'companies'] },
  {
    label: 'Consultancies',
    value: 'consultancies',
    icon: 'i-lucide-briefcase-business',
    noun: ['consultancy', 'consultancies']
  },
  {
    label: 'Employers',
    value: 'employers',
    icon: 'i-lucide-factory',
    noun: ['employer', 'employers']
  }
] as const

export type CompaniesTab = (typeof COMPANY_TABS)[number]['value']

export const EMPLOYER_KINDS = COMPANY_KIND_OPTIONS.map((o) => o.value).filter(
  (kind) => kind !== 'CONSULTANCY' && kind !== 'RECRUITMENT' && kind !== 'BROKER'
)

// Literal `order` arguments; ties fall back to the name. The API's SQLite treats null as the smallest
// value, so the descending sorts put companies without that value last.
export const COMPANY_SORTS = [
  { label: 'Name A–Z', value: 'name', order: '[{ name: ASC }]' },
  { label: 'Largest first', value: 'size', order: '[{ sizeBand: DESC }, { name: ASC }]' },
  {
    label: 'Recently founded',
    value: 'founded',
    order: '[{ foundedYear: DESC }, { name: ASC }]'
  },
  {
    label: 'Recently researched',
    value: 'researched',
    order: '[{ researchedAt: DESC }, { name: ASC }]'
  },
  {
    label: 'Recently favorited',
    value: 'favorited',
    order: '[{ favoritedAt: DESC }, { name: ASC }]'
  }
] as const

export type CompaniesSort = (typeof COMPANY_SORTS)[number]['value']
