import type { FormError } from '@nuxt/ui'
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

// Local YYYY-MM-DD. toISOString() is UTC, so near midnight it would give yesterday or tomorrow.
const todayIso = () => new Date().toLocaleDateString('sv-SE')

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
    skills: [] as ListingSkill[]
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
    skills: state.skills.map((s) => ({ ...s, minYears: s.minYears ?? null }))
  })

  return { state, validate, toInput, todayIso }
}
