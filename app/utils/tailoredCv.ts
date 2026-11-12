import type {
  TailoredCvAnalysis,
  TailoredCvContent,
  TailoredCvContentInput
} from '~/composables/useTailoredCvDraft'

// The editable candidate: the save input with every field present, so forms bind without null checks.
// Blank strings go back to the API as null (see toTailoredCvInput).
// Technologies are always a list too, so the chip field binds directly.
type CandidateBase = {
  [K in keyof TailoredCvContentInput]-?: NonNullable<TailoredCvContentInput[K]>
}
type WithTechnologies<T> = (T & { technologies: string[] })[]
export type TailoredCv = Omit<CandidateBase, 'experiences' | 'projects'> & {
  experiences: WithTechnologies<CandidateBase['experiences'][number]>
  projects: WithTechnologies<CandidateBase['projects'][number]>
}
export type TailoredCvExperience = TailoredCv['experiences'][number]
export type TailoredCvEducation = TailoredCv['educations'][number]
export type TailoredCvCertification = TailoredCv['certifications'][number]
export type TailoredCvProject = TailoredCv['projects'][number]
export type TailoredCvBullet = TailoredCvExperience['bullets'][number]

// A part of the draft that AI output can replace on its own. Built-in analysis works per experience,
// education and project entry; an external reply is split the same way when its entries pair up
// (see changedCvSections), else compared per whole section.
export type TailoredCvSectionKey =
  | 'headline'
  | 'summary'
  | 'skills'
  | 'languages'
  | 'experiences'
  | 'educations'
  | 'certifications'
  | 'projects'
  | `experience:${number}`
  | `education:${number}`
  | `project:${number}`

// Entry keys point into a list by profile entry id.
const ENTRY_LISTS = {
  experience: 'experiences',
  education: 'educations',
  project: 'projects'
} as const
const entryOf = (key: TailoredCvSectionKey) => {
  const [prefix, id] = key.split(':')
  const list = ENTRY_LISTS[prefix as keyof typeof ENTRY_LISTS]
  return list ? { list, id: Number(id) } : null
}

export const CV_SECTION_TITLES: Record<string, string> = {
  headline: 'Headline',
  summary: 'Summary',
  skills: 'Skills',
  languages: 'Languages',
  experiences: 'Experience',
  educations: 'Education',
  certifications: 'Certifications',
  projects: 'Projects'
}

const withBullets = <T extends { bullets: readonly unknown[] }>(e: T) => ({
  ...e,
  bullets: [...e.bullets]
})

// Null and empty print the same; one form keeps the unsaved-changes comparison stable.
const withTechnologies = <T extends { technologies?: readonly string[] | null }>(e: T) => ({
  ...e,
  technologies: [...(e.technologies ?? [])]
})

// Saved or previewed content has nullable lists and strings; the candidate has none.
export const tailoredCvFromContent = (content: TailoredCvContent): TailoredCv => ({
  fullName: content.fullName ?? '',
  headline: content.headline ?? '',
  email: content.email ?? '',
  phone: content.phone ?? '',
  address: content.address ?? '',
  language: content.language,
  dateOfBirth: content.dateOfBirth ?? '',
  referencesOnRequest: content.referencesOnRequest,
  sectionOrder: content.sectionOrder,
  contentStyle: content.contentStyle,
  template: content.template,
  links: [...(content.links ?? [])],
  summary: content.summary ?? '',
  experiences: [...(content.experiences ?? [])].map((e) => withTechnologies(withBullets(e))),
  educations: [...(content.educations ?? [])].map(withBullets),
  certifications: [...(content.certifications ?? [])].map(withBullets),
  projects: [...(content.projects ?? [])].map((p) => ({
    ...withTechnologies(withBullets(p)),
    kind: p.kind ?? null
  })),
  skills: [...(content.skills ?? [])],
  languages: [...(content.languages ?? [])]
})

// A copy with nothing shared, so editing it can't change what it came from.
export const cloneCv = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// Fresh content from the profile, keeping the owner's layout choices: the API returns defaults.
export const withLayoutFrom = (fresh: TailoredCv, current: TailoredCv): TailoredCv => ({
  ...fresh,
  contentStyle: current.contentStyle,
  sectionOrder: current.sectionOrder,
  template: current.template,
  referencesOnRequest: current.referencesOnRequest
})

const blankToNull = (value: string | null | undefined) => value?.trim() || null

// The API replaces the whole draft, so every section goes out; empty bullets are dropped.
export const toTailoredCvInput = (cv: TailoredCv): TailoredCvContentInput => {
  const bullets = (list: TailoredCvBullet[]) =>
    list.filter((b) => b.text.trim()).map((b) => ({ ...b, text: b.text.trim() }))
  // Paragraphs always go out, so switching back to bullets and forth loses nothing.
  const paragraph = (e: { paragraph?: string | null }) => blankToNull(e.paragraph)
  const technologies = (list?: string[] | null) => {
    const names = (list ?? []).map((t) => t.trim()).filter(Boolean)
    return names.filter((t, i) => names.findIndex((n) => n.toLowerCase() === t.toLowerCase()) === i)
  }
  return {
    fullName: blankToNull(cv.fullName),
    headline: blankToNull(cv.headline),
    email: blankToNull(cv.email),
    phone: blankToNull(cv.phone),
    address: blankToNull(cv.address),
    language: cv.language,
    dateOfBirth: blankToNull(cv.dateOfBirth),
    referencesOnRequest: cv.referencesOnRequest,
    sectionOrder: cv.sectionOrder,
    contentStyle: cv.contentStyle,
    template: cv.template,
    summary: blankToNull(cv.summary),
    links: cv.links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    experiences: cv.experiences.map((e) => ({
      ...e,
      location: blankToNull(e.location),
      technologies: technologies(e.technologies),
      bullets: bullets(e.bullets),
      paragraph: paragraph(e)
    })),
    educations: cv.educations.map((e) => ({
      ...e,
      degree: blankToNull(e.degree),
      field: blankToNull(e.field),
      location: blankToNull(e.location),
      bullets: bullets(e.bullets),
      paragraph: paragraph(e)
    })),
    certifications: cv.certifications.map((c) => ({
      ...c,
      issuer: blankToNull(c.issuer),
      url: blankToNull(c.url),
      bullets: bullets(c.bullets),
      paragraph: paragraph(c)
    })),
    projects: cv.projects.map((p) => ({
      ...p,
      // Always sent: leaving it out would clear it, like on the profile.
      kind: p.kind ?? null,
      url: blankToNull(p.url),
      location: blankToNull(p.location),
      technologies: technologies(p.technologies),
      bullets: bullets(p.bullets),
      paragraph: paragraph(p)
    })),
    skills: cv.skills
      .filter((s) => s.name.trim())
      .map((s) => ({ ...s, group: blankToNull(s.group) })),
    languages: cv.languages
  }
}

export const getCvSection = (cv: TailoredCv, key: TailoredCvSectionKey): unknown => {
  const entry = entryOf(key)
  if (entry) return cv[entry.list].find((e) => e.sourceEntryId === entry.id)
  return cv[key as keyof TailoredCv]
}

export const setCvSection = (cv: TailoredCv, key: TailoredCvSectionKey, value: unknown) => {
  const entry = entryOf(key)
  if (entry) {
    const list = cv[entry.list] as { sourceEntryId?: number | null }[]
    const index = list.findIndex((e) => e.sourceEntryId === entry.id)
    // Null removes the entry (an AI reply that left it out). An entry the owner removed comes back
    // at the end rather than being lost.
    if (value == null) {
      if (index !== -1) list.splice(index, 1)
    } else if (index === -1) list.push(value as (typeof list)[number])
    else list[index] = value as (typeof list)[number]
    return
  }
  ;(cv as Record<string, unknown>)[key] = value
}

export type CvContentStyle = TailoredCv['contentStyle']

const joinedBullets = (e: { bullets: { text: string }[] }) => e.bullets.map((b) => b.text).join(' ')

// What the PDF prints for an entry without a paragraph, so the editor shows the same text.
// Mutates `cv`; a no-op in bullets mode, where a missing paragraph never prints.
export const fillMissingParagraphs = (cv: TailoredCv) => {
  if (cv.contentStyle !== 'PARAGRAPH') return cv
  for (const e of [...cv.experiences, ...cv.educations, ...cv.certifications, ...cv.projects]) {
    if (!e.paragraph?.trim()) e.paragraph = joinedBullets(e)
  }
  return cv
}

// One format for the whole CV, Detailed or Concise. Bullets stay in the draft either way, since
// they carry the source ids.
export const setCvContentStyle = (cv: TailoredCv, style: CvContentStyle) => {
  cv.contentStyle = style
  fillMissingParagraphs(cv)
}

// What an editor page adds to the shared editor's cards and entries. `review` and `section` return
// props and listeners for v-bind (Vue 3 passes `on*` keys as listeners): `review` for a card's
// suggestions, `section` also for its own AI run. Without `analyze` (CV templates) cards only show
// suggestions, with no per-section AI.
export interface CvEditorAi {
  review: (key: TailoredCvSectionKey) => Record<string, unknown>
  section: (key: TailoredCvSectionKey) => Record<string, unknown>
  analyze?: (key: TailoredCvSectionKey, label: string) => void
}

// The lists whose profile items the owner can remove from this CV and add back.
export type CvProfileList = 'experiences' | 'educations' | 'certifications' | 'projects' | 'skills'
// The lists whose items are entries with bullets or a paragraph.
export type CvEntryList = Exclude<CvProfileList, 'skills'>
export type CvEntry = TailoredCv[CvEntryList][number]
type ProfileItem = { sourceEntryId?: number | null; sourceSkillId?: number | null }
type AnalyzedEntry = TailoredCvExperience | TailoredCvEducation | TailoredCvProject
const profileItemId = (item: ProfileItem) => item.sourceEntryId ?? item.sourceSkillId

// The profile's items this CV doesn't have. `source` is the API's prefill in the CV's language, so
// they come in profile order and already translated.
export const missingFromProfile = <K extends CvProfileList>(
  cv: TailoredCv,
  source: TailoredCv,
  list: K
): TailoredCv[K] => {
  const present = new Set((cv[list] as ProfileItem[]).map(profileItemId))
  return (source[list] as ProfileItem[]).filter(
    (item) => !present.has(profileItemId(item))
  ) as TailoredCv[K]
}

// Puts a copy of a profile item back where the profile has it, before the first entry that comes
// later there. Skills go last: their order is the owner's or the AI's, not the profile's.
export const addFromProfile = <K extends CvProfileList>(
  cv: TailoredCv,
  source: TailoredCv,
  list: K,
  item: TailoredCv[K][number]
) => {
  const items = cv[list] as ProfileItem[]
  const added = cloneCv(item) as ProfileItem
  if (list === 'skills') return void items.push(added)
  const order = (source[list] as ProfileItem[]).map(profileItemId)
  const rank = (e: ProfileItem) => order.indexOf(profileItemId(e))
  const at = items.findIndex((e) => rank(e) > rank(added))
  items.splice(at === -1 ? items.length : at, 0, added)
}

const ANALYZED_ENTRIES = {
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  PROJECT: 'project'
} as const

// Turns one built-in analysis result into the section value it suggests, or null when it failed.
// Bullets are the result's own text (shortened for the Concise template), skills the selected profile
// skills in the AI's order; the owner's edits to an entry's other fields (title, employer, school...) stay.
export const cvSectionFromAnalysis = (
  cv: TailoredCv,
  source: TailoredCv,
  result: TailoredCvAnalysis
): { key: TailoredCvSectionKey; value: unknown } | null => {
  if (result.status !== 'SUCCEEDED') return null
  if (result.section === 'SUMMARY') return { key: 'summary', value: result.summary ?? '' }
  if (result.section === 'SKILLS') {
    // The AI's order (most relevant first) is kept: it prints as is.
    // A skill the draft already has keeps its group.
    const groups = new Map(cv.skills.map((s) => [s.sourceSkillId, s.group]))
    const value = (result.selectedSkillIds ?? [])
      .map((id) => source.skills.find((s) => s.sourceSkillId === id))
      .filter((s) => s != null)
      .map((s) => ({
        ...s,
        ...(groups.get(s.sourceSkillId) && { group: groups.get(s.sourceSkillId) })
      }))
    return { key: 'skills', value }
  }
  const prefix = ANALYZED_ENTRIES[result.section as keyof typeof ANALYZED_ENTRIES]
  if (!prefix) return null
  const key: TailoredCvSectionKey = `${prefix}:${result.sourceEntryId ?? 0}`
  const fromProfile = getCvSection(source, key) as AnalyzedEntry | undefined
  if (!fromProfile) return null
  const current = (getCvSection(cv, key) as AnalyzedEntry | undefined) ?? fromProfile
  const bullets = (result.bullets ?? []).map((b) => ({
    text: b.text,
    sourceBulletId: b.sourceBulletId
  }))
  return {
    key,
    value: {
      ...current,
      // Any entry may have no relevant bullets (a listing outside the owner's field); it stays with
      // its title and dates, and the owner decides whether to remove it.
      bullets,
      // Written from the selected bullets; it shows once the entry is in paragraph mode. Null means
      // it failed the API's word check and the PDF joins the bullets, so the draft does too.
      paragraph: result.paragraph ?? joinedBullets({ bullets }),
      // Education has none. A list replaces the entry's, null means no suggestion and keeps it.
      ...('technologies' in current && {
        technologies: result.technologies ? [...result.technologies] : current.technologies
      })
    }
  }
}

// The external prompt has no contact details or layout, so the previewed candidate keeps the current ones.
// A reply without a headline (null, read as '') keeps the draft's rather than clearing it.
// A paragraph that failed the API's word check comes back null and is filled like the PDF does.
export const mergeExternalCandidate = (cv: TailoredCv, external: TailoredCv): TailoredCv =>
  fillMissingParagraphs({
    ...external,
    headline: external.headline || cv.headline,
    sectionOrder: cv.sectionOrder,
    template: cv.template,
    fullName: cv.fullName,
    email: cv.email,
    phone: cv.phone,
    address: cv.address,
    links: cv.links
  })

// An entry list's changes one entry at a time, so each experience (company) is reviewed on its own
// card: a changed entry suggests its new value, a left-out one suggests null (remove it). Null when
// the reply added entries or changed their order, which can't be paired, so the list goes as one.
const ENTRY_PREFIXES = {
  experiences: 'experience',
  educations: 'education',
  projects: 'project'
} as const
type EntryList = keyof typeof ENTRY_PREFIXES
const entryChanges = (list: EntryList, cv: TailoredCv, next: TailoredCv) => {
  const before = cv[list] as { sourceEntryId?: number | null }[]
  const after = next[list] as { sourceEntryId?: number | null }[]
  const ids = before.map((e) => e.sourceEntryId)
  const nextIds = after.map((e) => e.sourceEntryId)
  if ([...ids, ...nextIds].some((id) => id == null)) return null
  if (nextIds.some((id) => !ids.includes(id))) return null
  if (ids.filter((id) => nextIds.includes(id)).some((id, i) => id !== nextIds[i])) return null
  return before.flatMap((entry) => {
    const value = after.find((e) => e.sourceEntryId === entry.sourceEntryId) ?? null
    if (JSON.stringify(value) === JSON.stringify(entry)) return []
    const key: TailoredCvSectionKey = `${ENTRY_PREFIXES[list]}:${entry.sourceEntryId!}`
    return [{ key, value: value as unknown }]
  })
}

// Where the external reply differs from the candidate, for review as suggestions: entry lists per
// entry when they can be paired, everything else per whole section.
export const changedCvSections = (cv: TailoredCv, next: TailoredCv) =>
  (
    [
      'headline',
      'summary',
      'experiences',
      'skills',
      'educations',
      'certifications',
      'projects',
      'languages'
    ] as const
  ).flatMap((key): { key: TailoredCvSectionKey; value: unknown }[] => {
    if (JSON.stringify(cv[key]) === JSON.stringify(next[key])) return []
    const entries = key in ENTRY_PREFIXES ? entryChanges(key as EntryList, cv, next) : null
    return entries ?? [{ key, value: next[key] as unknown }]
  })
