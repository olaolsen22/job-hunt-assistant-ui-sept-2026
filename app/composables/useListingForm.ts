import type { FormError } from '@nuxt/ui'
import { reactive } from 'vue'
import type { ListingDetail } from '~/composables/useListing'
import { todayIso } from '~/utils/todayIso'
import { graphql } from '~/utils/graphql'
import { COUNTRY_CODES } from '~/constants/countries'
import {
  CEFR_LEVELS,
  DEADLINE_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  LISTING_KIND_OPTIONS,
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
  ListingKind,
  Schedule,
  Seniority,
  WorkMode
} from '~/constants/listing'

// Full replace: every field the form doesn't send goes back to its default (see toListingInput).
export const UPDATE_LISTING = graphql(`
  mutation UpdateListing($id: Int!, $listing: ListingInput!) {
    updateListing(input: { id: $id, listing: $listing }) {
      listing {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
        ... on DuplicateListingError {
          existingListingId
        }
      }
    }
  }
`)

export interface ListingLocation {
  countryCode: string
  city: string
}

export interface ListingLanguage {
  language: Language
  level?: CefrLevel
  isRequired: boolean
}

export interface ListingContact {
  name: string
  title: string | null
  email: string | null
  phone: string | null
  url: string | null
}

export interface ListingSkill {
  name: string
  level: number
  minYears?: number | null
  isRequired: boolean
  // Only set by a parsed draft, as one of the owner's category names. The API fills an empty category
  // from it, never overwrites one, and ignores a name it doesn't know.
  categoryName?: string
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

// Duplicates are dropped because the skill and language rows allow one of each. No url: the full
// draft doesn't have one (quick-add reads its rows' links itself).
export const cleanListingDraft = (d: Record<string, unknown>) => {
  const skills = list(d.skills)
    .map((s) => ({
      name: text(s?.name),
      level: int(s?.level, 1, 5) ?? 3,
      minYears: int(s?.minYears, 1, 50) ?? null,
      isRequired: s?.isRequired !== false,
      categoryName: text(s?.categoryName) || undefined
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
  // Matched by name in the company on save, so one row per name.
  const contacts: ListingContact[] = list(d.contacts)
    .map((c) => ({
      name: text(c?.name),
      title: text(c?.title) || null,
      email: text(c?.email) || null,
      phone: text(c?.phone) || null,
      url: text(c?.url) || null
    }))
    .filter(
      (c, i, all) =>
        c.name && all.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) === i
    )
  return {
    // The parse prompts never answer UNSOLICITED: an ad always has one.
    kind: option(LISTING_KIND_OPTIONS.slice(0, 2), d.kind),
    title: text(d.title),
    companyName: text(d.companyName) || undefined,
    jobRoleName: text(d.jobRoleName) || undefined,
    jobRoleCategoryName: text(d.jobRoleCategoryName) || undefined,
    seniority: option(SENIORITY_OPTIONS, d.seniority),
    employmentType: option(EMPLOYMENT_TYPE_OPTIONS, d.employmentType),
    positionPercent: int(d.positionPercent, 1, 100),
    schedule: option(SCHEDULE_OPTIONS, d.schedule),
    workMode: option(WORK_MODE_OPTIONS, d.workMode),
    description: text(d.description),
    postedOn: isoDate(d.postedOn),
    // Parse results saved before the backend merged ROLLING into ASAP can still say ROLLING.
    deadlineType:
      option(DEADLINE_TYPE_OPTIONS, d.deadlineType === 'ROLLING' ? 'ASAP' : d.deadlineType) ??
      'UNSPECIFIED',
    deadlineOn: isoDate(d.deadlineOn),
    postingLanguage: option(LANGUAGE_OPTIONS, d.postingLanguage),
    locations: list(d.locations)
      .filter((l) => oneOf(COUNTRY_CODES, l?.countryCode))
      .map((l) => ({ countryCode: l.countryCode, city: text(l.city) })),
    languages,
    skills,
    contacts
  }
}

// What counts as "the parse found nothing" when merging into a saved listing.
const isBlank = (v: unknown) =>
  v === undefined || v === '' || v === 'UNSPECIFIED' || (Array.isArray(v) && !v.length)

type ListingBasics = {
  kind: ListingKind
  title: string
  companyName?: string
  jobRoleName?: string
  url: string
  postedOn: string
  deadlineType: DeadlineType
  deadlineOn: string
}

// The API's rules for every listing, checked first so they show beside their fields. `name` maps a
// field to its form name (quick-add prefixes the row). An unsolicited application has no ad, so no
// link or posting date.
export const listingBasicsErrors = (
  l: ListingBasics,
  name: (field: string) => string = (field) => field
): FormError[] => {
  const errors: FormError[] = []
  const add = (field: string, message: string) => errors.push({ name: name(field), message })
  if (!l.title.trim()) add('title', 'Required')
  if (!l.companyName) add('companyName', 'Required')
  if (!l.jobRoleName) add('jobRoleName', 'Required')
  if (l.kind !== 'UNSOLICITED') {
    if (!/^https?:\/\/\S+$/i.test(l.url.trim())) add('url', 'Enter an http(s) link')
    if (!l.postedOn) add('postedOn', 'Required')
  }
  // ISO dates compare correctly as strings.
  if (l.postedOn > todayIso()) add('postedOn', 'Can’t be in the future')
  if (l.deadlineType === 'DATE' && !l.deadlineOn) add('deadlineOn', 'Pick a date')
  return errors
}

export const emptyListing = () => ({
  kind: 'VACANCY' as ListingKind,
  title: '',
  companyName: undefined as string | undefined,
  jobRoleName: undefined as string | undefined,
  // A hint from a parse or an import file: the API fills an uncategorized role from it.
  jobRoleCategoryName: undefined as string | undefined,
  seniority: undefined as Seniority | undefined,
  employmentType: undefined as EmploymentType | undefined,
  positionPercent: undefined as number | null | undefined,
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
  contacts: [] as ListingContact[],
  isAnalyzed: false,
  reanalyzed: false
})

export type ListingFields = ReturnType<typeof emptyListing>

// updateListing replaces the whole listing, so every field goes out. Only trainingProgram (no
// control yet) is left out, which the API keeps; contacts are always sent, so a removed row
// unlinks that contact.
export const toListingInput = (l: ListingFields) => ({
  // An omitted kind would mean VACANCY.
  kind: l.kind,
  title: l.title.trim(),
  // Callers validate first, which requires both.
  companyName: l.companyName!,
  jobRoleName: l.jobRoleName!,
  jobRoleCategoryName: l.jobRoleCategoryName ?? null,
  seniority: l.seniority ?? null,
  employmentType: l.employmentType ?? null,
  positionPercent: l.positionPercent ?? null,
  schedule: l.schedule ?? null,
  workMode: l.workMode ?? null,
  description: orNull(l.description),
  // Empty only for an unsolicited application, which has neither.
  url: orNull(l.url),
  postedOn: l.postedOn || null,
  deadlineType: l.deadlineType,
  // The API rejects a date unless the type is DATE.
  deadlineOn: l.deadlineType === 'DATE' ? l.deadlineOn : null,
  postingLanguage: l.postingLanguage ?? null,
  locations: l.locations.map((location) => ({ ...location, city: orNull(location.city) })),
  languages: l.languages.map((language) => ({ ...language, level: language.level ?? null })),
  skills: l.skills.map((skill) => ({
    ...skill,
    minYears: skill.minYears ?? null,
    categoryName: skill.categoryName ?? null
  })),
  // Leaving this out would clear the marker.
  isAnalyzed: l.isAnalyzed,
  // Makes the API stamp reanalyzedAt; a first analysis keeps it null.
  reanalyzed: l.reanalyzed,
  // Blank rows are dropped.
  contacts: l.contacts
    .filter((c) => c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      title: orNull(c.title ?? ''),
      email: orNull(c.email ?? ''),
      phone: orNull(c.phone ?? ''),
      url: orNull(c.url ?? '')
    }))
})

export const useListingForm = () => {
  const state = reactive(emptyListing())
  // Whether the loaded listing was analyzed already, which makes a merged parse a re-analysis.
  let analyzedBefore = false

  const validate = (s: typeof state) => listingBasicsErrors(s)

  const toInput = () => toListingInput(state)

  // Inverse of toInput: the API's nulls become the form's empty values.
  const fill = (listing: ListingDetail) => {
    analyzedBefore = listing.analyzedAt != null
    return Object.assign(state, {
      kind: listing.kind,
      title: listing.title,
      companyName: listing.company.name,
      jobRoleName: listing.jobRole.name,
      seniority: listing.seniority ?? undefined,
      employmentType: listing.employmentType ?? undefined,
      positionPercent: listing.positionPercent ?? undefined,
      schedule: listing.schedule ?? undefined,
      workMode: listing.workMode ?? undefined,
      description: listing.description ?? '',
      url: listing.url ?? '',
      postedOn: listing.postedOn ?? '',
      deadlineType: listing.deadlineType,
      deadlineOn: listing.deadlineOn ?? '',
      postingLanguage: listing.postingLanguage ?? undefined,
      locations: listing.locations.map(({ location }) => ({
        countryCode: location.countryCode,
        city: location.city ?? ''
      })),
      languages: listing.languages.map((l) => ({ ...l, level: l.level ?? undefined })),
      skills: listing.skills.map(({ skill, ...rest }) => ({ ...rest, name: skill.name })),
      isAnalyzed: listing.analyzedAt != null,
      contacts: listing.contacts.map(({ contact: { name, title, email, phone, url } }) => ({
        name,
        title,
        email,
        phone,
        url
      }))
    })
  }

  // A parsed ad has its details filled in, which is what "analyzed" means.
  const fillDraft = (d: Record<string, unknown>) => {
    const draft = cleanListingDraft(d)
    Object.assign(state, {
      ...draft,
      kind: draft.kind ?? 'VACANCY',
      postedOn: draft.postedOn || todayIso(),
      isAnalyzed: true
    })
  }

  // For an existing listing: parsed values win, saved ones stay where the parse found nothing.
  // Contacts are added rather than replaced, since the user may have linked some by hand.
  const mergeDraft = (d: Record<string, unknown>) => {
    const { contacts, ...draft } = cleanListingDraft(d)
    const found = Object.entries(draft).filter(([, v]) => !isBlank(v))
    const known = new Set(state.contacts.map((c) => c.name.trim().toLowerCase()))
    Object.assign(state, Object.fromEntries(found), {
      contacts: [...state.contacts, ...contacts.filter((c) => !known.has(c.name.toLowerCase()))],
      isAnalyzed: true,
      reanalyzed: analyzedBefore
    })
  }

  return { state, validate, toInput, fill, fillDraft, mergeDraft }
}
