// Mirrors the CompanyKind and CompanySize enums in the API's schema.graphql.
export const COMPANY_KIND_OPTIONS = [
  { label: 'Product company', value: 'PRODUCT' },
  { label: 'Consultancy', value: 'CONSULTANCY' },
  { label: 'In-house IT', value: 'IN_HOUSE' },
  { label: 'Public sector', value: 'PUBLIC_SECTOR' },
  { label: 'Agency', value: 'AGENCY' },
  { label: 'Startup', value: 'STARTUP' }
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
