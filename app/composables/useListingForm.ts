import type { FormError } from '@nuxt/ui'
import type { ListingDetail } from '~/composables/useListing'
import { COUNTRY_CODES } from '~/constants/countries'
import {
  CEFR_LEVELS,
  DEADLINE_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  SCHEDULE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS
} from '~/constants/listing'
import type {
  CefrLevel,
  DeadlineType,
  EmploymentType,
  Language,
  Schedule,
  Seniority,
  WorkMode
} from '~/constants/listing'

export interface ListingLocation {
  countryCode: string
  city: string
}

export interface ListingLanguage {
  language: Language
  level?: CefrLevel
  isRequired: boolean
}

export interface ListingSkill {
  name: string
  level: number
  minYears?: number | null
  isRequired: boolean
}

// The API wants null, not "", for empty optional fields.
const orNull = (value?: string) => value?.trim() || null

// A parsed draft is an external AI's JSON, so fillDraft keeps only values the form can hold.
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])
const oneOf = <T>(values: readonly T[], v: unknown) => values.find((x) => x === v)
const option = <T>(options: readonly { value: T }[], v: unknown) =>
  options.find((o) => o.value === v)?.value
const int = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined

export const useListingForm = () => {
  const state = reactive({
    title: '',
    companyName: undefined as string | undefined,
    jobRoleName: undefined as string | undefined,
    seniority: undefined as Seniority | undefined,
    employmentType: undefined as EmploymentType | undefined,
    schedule: undefined as Schedule | undefined,
    workMode: undefined as WorkMode | undefined,
    description: '',
    url: '',
    postedOn: todayIso(),
    deadlineType: 'UNSPECIFIED' as DeadlineType,
    deadlineOn: '',
    postingLanguage: undefined as Language | undefined,
    // Most ads name a place, so start with one row. Empty city = the whole country.
    locations: [{ countryCode: 'NO', city: '' }] as ListingLocation[],
    languages: [] as ListingLanguage[],
    skills: [] as ListingSkill[],
    isAnalyzed: false
  })

  const validate = (s: typeof state): FormError[] => {
    const errors: FormError[] = []
    if (!s.title.trim()) errors.push({ name: 'title', message: 'Required' })
    if (!s.companyName) errors.push({ name: 'companyName', message: 'Required' })
    if (!s.jobRoleName) errors.push({ name: 'jobRoleName', message: 'Required' })
    if (!/^https?:\/\/\S+$/i.test(s.url.trim())) {
      errors.push({ name: 'url', message: 'Enter an http(s) link' })
    }
    if (!s.postedOn) {
      errors.push({ name: 'postedOn', message: 'Required' })
    } else if (s.postedOn > todayIso()) {
      // ISO dates compare correctly as strings.
      errors.push({ name: 'postedOn', message: 'Can’t be in the future' })
    }
    if (s.deadlineType === 'DATE' && !s.deadlineOn) {
      errors.push({ name: 'deadlineOn', message: 'Pick a date' })
    }
    return errors
  }

  const toInput = () => ({
    title: state.title.trim(),
    companyName: state.companyName,
    jobRoleName: state.jobRoleName,
    seniority: state.seniority ?? null,
    employmentType: state.employmentType ?? null,
    schedule: state.schedule ?? null,
    workMode: state.workMode ?? null,
    description: orNull(state.description),
    url: state.url.trim(),
    postedOn: state.postedOn,
    deadlineType: state.deadlineType,
    // The API rejects a date unless the type is DATE.
    deadlineOn: state.deadlineType === 'DATE' ? state.deadlineOn : null,
    postingLanguage: state.postingLanguage ?? null,
    locations: state.locations.map((l) => ({ ...l, city: orNull(l.city) })),
    languages: state.languages.map((l) => ({ ...l, level: l.level ?? null })),
    skills: state.skills.map((s) => ({ ...s, minYears: s.minYears ?? null })),
    // updateListing replaces the whole listing, so leaving this out would clear the marker.
    isAnalyzed: state.isAnalyzed
  })

  // Inverse of toInput: the API's nulls become the form's empty values.
  const fill = (listing: ListingDetail) =>
    Object.assign(state, {
      title: listing.title,
      companyName: listing.company.name,
      jobRoleName: listing.jobRole.name,
      seniority: listing.seniority ?? undefined,
      employmentType: listing.employmentType ?? undefined,
      schedule: listing.schedule ?? undefined,
      workMode: listing.workMode ?? undefined,
      description: listing.description ?? '',
      url: listing.url,
      postedOn: listing.postedOn,
      deadlineType: listing.deadlineType,
      deadlineOn: listing.deadlineOn ?? '',
      postingLanguage: listing.postingLanguage ?? undefined,
      locations: listing.locations.map(({ location }) => ({
        countryCode: location.countryCode,
        city: location.city ?? ''
      })),
      languages: listing.languages.map((l) => ({ ...l, level: l.level ?? undefined })),
      skills: listing.skills.map(({ skill, ...rest }) => ({ ...rest, name: skill.name })),
      isAnalyzed: listing.analyzedAt != null
    })

  // Leaves url alone: the draft doesn't have one. Duplicates are dropped because the skill and
  // language rows allow one of each.
  const fillDraft = (d: Record<string, unknown>) => {
    const skills = list(d.skills)
      .map((s) => ({
        name: text(s?.name),
        level: int(s?.level, 1, 5) ?? 3,
        minYears: int(s?.minYears, 1, 50) ?? null,
        isRequired: s?.isRequired !== false
      }))
      .filter(
        (s, i, all) =>
          s.name && all.findIndex((x) => x.name.toLowerCase() === s.name.toLowerCase()) === i
      )
    const languages: ListingLanguage[] = list(d.languages)
      .filter(
        (l, i, all) =>
          option(LANGUAGE_OPTIONS, l?.language) &&
          all.findIndex((x) => x?.language === l.language) === i
      )
      .map((l) => ({
        language: l.language,
        level: oneOf(CEFR_LEVELS, l.level),
        isRequired: l.isRequired !== false
      }))
    Object.assign(state, {
      title: text(d.title),
      companyName: text(d.companyName) || undefined,
      jobRoleName: text(d.jobRoleName) || undefined,
      seniority: option(SENIORITY_OPTIONS, d.seniority),
      employmentType: option(EMPLOYMENT_TYPE_OPTIONS, d.employmentType),
      schedule: option(SCHEDULE_OPTIONS, d.schedule),
      workMode: option(WORK_MODE_OPTIONS, d.workMode),
      description: text(d.description),
      postedOn: isoDate(d.postedOn) || todayIso(),
      deadlineType: option(DEADLINE_TYPE_OPTIONS, d.deadlineType) ?? 'UNSPECIFIED',
      deadlineOn: isoDate(d.deadlineOn),
      postingLanguage: option(LANGUAGE_OPTIONS, d.postingLanguage),
      locations: list(d.locations)
        .filter((l) => oneOf(COUNTRY_CODES, l?.countryCode))
        .map((l) => ({ countryCode: l.countryCode, city: text(l.city) })),
      languages,
      skills,
      // A parsed ad has its details filled in, which is what "analyzed" means.
      isAnalyzed: true
    })
  }

  return { state, validate, toInput, fill, fillDraft }
}
