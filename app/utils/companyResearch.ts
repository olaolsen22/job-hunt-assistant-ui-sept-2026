import {
  COMPANY_KIND_OPTIONS,
  type CompanyKind,
  type CompanySize,
  COMPANY_SIZE_OPTIONS,
  DESCRIPTION_MAX,
  FOUNDED_MIN,
  SKILLS_MAX,
  companyKindLabel,
  companySizeRange
} from '~/constants/company'
import {
  LANGUAGE_OPTIONS,
  WORK_MODE_OPTIONS,
  type Language,
  type WorkMode
} from '~/constants/listing'
import type { ListingLocation } from '~/composables/useListingForm'
import { COUNTRY_CODES } from '~/constants/countries'
import type { graphql } from './graphql'
import { isHttpUrl } from './isHttpUrl'

// What createCompanies rows and updateCompanyDetails both take besides name, industry and locations.
export type CompanyResearch = ReturnType<typeof graphql.scalar<'CompanyDetailsInput'>>

// Norwegian org.nr: 9 digits, the last a mod-11 check digit over the first 8 (weights 3,2,7,6,5,4,3,2).
export const isValidOrgNumber = (value: string) => {
  if (!/^\d{9}$/.test(value)) return false
  const digits = [...value].map(Number)
  const sum = [3, 2, 7, 6, 5, 4, 3, 2].reduce((acc, w, i) => acc + w * digits[i]!, 0)
  const check = (11 - (sum % 11)) % 11
  return check !== 10 && check === digits[8]
}

export const formatOrgNumber = (value: string) =>
  value.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const option = <T>(options: readonly { value: T }[], v: unknown) =>
  options.find((o) => o.value === v)?.value

// The research in an external AI's company JSON, keeping only values the API accepts: one bad enum
// fails the whole request's variables, and an InvalidCompanyError names no row. Dropped values are
// listed so the row can say what was ignored instead of losing them silently.
export const researchFromJson = (d: Record<string, unknown>) => {
  const ignored: string[] = []
  const keep = <T>(label: string, raw: unknown, value: T | undefined) => {
    if (value === undefined && raw != null && raw !== '') ignored.push(`${label} “${String(raw)}”`)
    return value ?? null
  }
  const url = (v: unknown) => (isHttpUrl(text(v)) ? text(v) : undefined)
  const orgNumber = text(d.orgNumber).replace(/\s/g, '')
  const year = d.foundedYear
  const description = text(d.description)
  if (description.length > DESCRIPTION_MAX)
    ignored.push(`description over ${DESCRIPTION_MAX} characters`)

  const names = (Array.isArray(d.skills) ? d.skills : []).map(text).filter(Boolean)
  const skills = names.filter(
    (n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i
  )
  if (skills.length > SKILLS_MAX)
    ignored.push(`${skills.length - SKILLS_MAX} skills over ${SKILLS_MAX}`)

  const research: CompanyResearch = {
    orgNumber: keep('org.nr', d.orgNumber, isValidOrgNumber(orgNumber) ? orgNumber : undefined),
    websiteUrl: keep('website', d.websiteUrl, url(d.websiteUrl)),
    careersUrl: keep('careers page', d.careersUrl, url(d.careersUrl)),
    linkedInUrl: keep('LinkedIn', d.linkedInUrl, url(d.linkedInUrl)),
    kind: keep('type', d.kind, option(COMPANY_KIND_OPTIONS, d.kind)),
    sizeBand: keep('size', d.sizeBand, option(COMPANY_SIZE_OPTIONS, d.sizeBand)),
    foundedYear: keep(
      'founded',
      year,
      Number.isInteger(year) &&
        (year as number) >= FOUNDED_MIN &&
        (year as number) <= new Date().getFullYear()
        ? (year as number)
        : undefined
    ),
    description: description && description.length <= DESCRIPTION_MAX ? description : null,
    workMode: keep('work mode', d.workMode, option(WORK_MODE_OPTIONS, d.workMode)),
    workingLanguage: keep(
      'language',
      d.workingLanguage,
      option(LANGUAGE_OPTIONS, d.workingLanguage)
    ),
    skills: skills.slice(0, SKILLS_MAX)
  }
  return { research, ignored }
}

// One line for a pasted row, e.g. "Consultancy · 51–200 · Hybrid · 6 skills · website, careers".
// Empty when the row has no research.
export const researchSummary = (r: CompanyResearch) => {
  const extras = [
    r.description && 'description',
    r.websiteUrl && 'website',
    r.careersUrl && 'careers',
    r.linkedInUrl && 'LinkedIn',
    r.orgNumber && 'org.nr',
    r.foundedYear && `founded ${r.foundedYear}`
  ].filter(Boolean)
  return [
    companyKindLabel(r.kind),
    companySizeRange(r.sizeBand),
    WORK_MODE_OPTIONS.find((o) => o.value === r.workMode)?.label,
    LANGUAGE_OPTIONS.find((o) => o.value === r.workingLanguage)?.label,
    r.skills.length && `${r.skills.length} ${r.skills.length === 1 ? 'skill' : 'skills'}`,
    extras.join(', ')
  ]
    .filter(Boolean)
    .join(' · ')
}

// The companies in an AI reply. AIs often wrap the JSON in a code fence or a sentence, so this takes
// the outermost array. Returns the message to show when there is none.
export const parseCompaniesReply = (reply: string) => {
  let items: unknown
  try {
    items = JSON.parse(reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1))
  } catch {
    return { error: 'That doesn’t look like a valid JSON array.' }
  }
  const rows = (Array.isArray(items) ? items : []).filter(
    (r): r is Record<string, unknown> => !!r && typeof r === 'object'
  )
  return rows.length ? { rows } : { error: 'No companies found in that reply.' }
}

// The research part of the company edit form.
export interface ResearchForm {
  orgNumber: string
  websiteUrl: string
  careersUrl: string
  linkedInUrl: string
  kind?: CompanyKind
  sizeBand?: CompanySize
  foundedYear?: number | string
  description: string
  workMode?: WorkMode
  workingLanguage?: Language
  skills: string[]
}

const FIELD_LABELS: Record<keyof ResearchForm, string> = {
  description: 'description',
  websiteUrl: 'website',
  careersUrl: 'careers page',
  linkedInUrl: 'LinkedIn',
  kind: 'type',
  sizeBand: 'size',
  workMode: 'work mode',
  workingLanguage: 'working language',
  foundedYear: 'founded',
  orgNumber: 'org.nr',
  skills: 'skills'
}

// Fills only the empty fields, like the API does for a company that already exists: a saved value is
// never overwritten, and skills are filled only when there are none. `filled` and `kept` name the
// fields the AI had a value for that were set or already had one.
export const fillEmptyResearch = (form: ResearchForm, research: CompanyResearch) => {
  const filled: string[] = []
  const kept: string[] = []
  const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length)
  const target = form as unknown as Record<string, unknown>
  for (const key of Object.keys(FIELD_LABELS) as (keyof ResearchForm)[]) {
    const incoming = research[key]
    if (isEmpty(incoming)) continue
    if (isEmpty(form[key])) {
      target[key] = Array.isArray(incoming) ? [...incoming] : incoming
      filled.push(FIELD_LABELS[key])
    } else kept.push(FIELD_LABELS[key])
  }
  return { filled, kept }
}

// Whether a saved company has any research yet: picks "Research company" or "Re-research". Not
// researchedAt, which only createCompanies sets (an edit-form save leaves it).
export const hasCompanyResearch = (
  c: {
    [K in Exclude<keyof CompanyResearch, 'skills'>]?: unknown
  } & { skills: readonly unknown[] }
) =>
  c.skills.length > 0 ||
  (Object.keys(FIELD_LABELS) as (keyof ResearchForm)[]).some(
    (key) => key !== 'skills' && c[key] != null && c[key] !== ''
  )

// Industry and locations from the same company JSON (every createCompanies row takes them). A bad
// country code would fail the whole request, so those locations are dropped and listed.
export const basicsFromJson = (d: Record<string, unknown>) => {
  const ignored: string[] = []
  const locations: ListingLocation[] = []
  for (const l of Array.isArray(d.locations) ? d.locations : []) {
    if (!l || typeof l !== 'object') continue
    const { countryCode, city } = l as Record<string, unknown>
    if (COUNTRY_CODES.find((c) => c === countryCode))
      locations.push({ countryCode: countryCode as string, city: text(city) })
    else
      ignored.push(
        `location “${[text(city), String(countryCode ?? '')].filter(Boolean).join(', ')}”`
      )
  }
  return { industryName: text(d.industryName) || undefined, locations, ignored }
}

// The same fill-only-empty rule for the edit form's basics: an empty industry is filled, and
// locations only when the company has none.
export const fillEmptyBasics = (
  form: { industryName?: string; locations: ListingLocation[] },
  basics: ReturnType<typeof basicsFromJson>
) => {
  const filled: string[] = []
  const kept: string[] = []
  if (basics.industryName) {
    if (form.industryName) kept.push('industry')
    else {
      form.industryName = basics.industryName
      filled.push('industry')
    }
  }
  if (basics.locations.length) {
    if (form.locations.length) kept.push('locations')
    else {
      form.locations = basics.locations.map((l) => ({ ...l }))
      filled.push('locations')
    }
  }
  return { filled, kept }
}
