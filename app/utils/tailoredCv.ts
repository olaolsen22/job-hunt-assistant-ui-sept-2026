import type { ProfileData } from '~/composables/useProfile'
import type {
  TailoredCvAnalysis,
  TailoredCvContent,
  TailoredCvContentInput
} from '~/composables/useTailoredCvDraft'
import {
  LINK_KIND_OPTIONS,
  PROFICIENCY_OPTIONS,
  projectKindLabel,
  type Language
} from '~/constants/listing'

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

// A part of the draft that AI output can replace on its own. Built-in analysis works per experience
// and education entry; an external reply can change any list, so it is compared per whole section.
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

// The paragraph is only written once the owner or AI fills it in; the CV-wide contentStyle decides which shows.
const BULLET_CONTENT = { paragraph: null } as const

// Uses the bullet's translation for the draft language when it has one, like the API's prefill.
const bulletsOf = (
  bullets: readonly {
    id: number
    text: string
    translations?: readonly { language: string; text: string }[]
  }[],
  language?: Language
) =>
  bullets.map((b) => ({
    text: b.translations?.find((t) => t.language === language)?.text ?? b.text,
    sourceBulletId: b.id
  }))

const linkLabel = (link: ProfileData['links'][number]) =>
  link.kind === 'OTHER' && link.label
    ? link.label
    : LINK_KIND_OPTIONS.find((o) => o.value === link.kind)!.label

type EntrySkill = ProfileData['experiences'][number]['skills'][number]

// Like the API prefill: the entry's own skills, higher profile level first (unknown level last), then
// by name, culture-aware like the API, in the draft language.
const technologiesFromProfile = (
  skills: readonly EntrySkill[],
  profile: ProfileData,
  language: Language
) => {
  const levels = new Map(profile.skills.map((p) => [p.skill.id, p.level]))
  const level = (s: EntrySkill) => levels.get(s.id) ?? 0
  return [...skills]
    .sort((a, b) => level(b) - level(a) || a.name.localeCompare(b.name))
    .map((s) => s.translations.find((t) => t.language === language)?.name ?? s.name)
}

// With no saved draft, the candidate starts as the whole profile, keeping source ids for attribution.
export const tailoredCvFromProfile = (
  profile: ProfileData,
  language: Language = profile.contentLanguage
): TailoredCv => {
  const translated = profile.translations.find((t) => t.language === language)
  return {
    fullName: profile.fullName ?? '',
    headline: translated?.headline ?? profile.headline ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    address: profile.location ? formatLocation(profile.location) : '',
    language,
    dateOfBirth: profile.dateOfBirth ?? '',
    referencesOnRequest: false,
    sectionOrder: 'STANDARD',
    contentStyle: 'BULLETS',
    template: 'DETAILED',
    links: profile.links.map((l) => ({ label: linkLabel(l), url: l.url })),
    summary: translated?.summary ?? profile.summary ?? '',
    experiences: profile.experiences.map((e) => experienceFromProfile(e, profile, language)),
    educations: profile.educations.map((e) => educationFromProfile(e, language)),
    certifications: profile.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      issuedMonth: c.issuedMonth,
      expiresMonth: c.expiresMonth,
      url: c.url,
      ...BULLET_CONTENT,
      bullets: bulletsOf(c.bullets, language),
      sourceEntryId: c.id
    })),
    projects: profile.projects.map((p) => projectFromProfile(p, profile, language)),
    skills: profile.skills.map((s) => skillFromProfile(s, language)),
    languages: profile.languages.map((l) => ({
      name: l.name,
      spoken: l.spoken,
      written: l.written
    }))
  }
}

const educationFromProfile = (
  e: ProfileData['educations'][number],
  language: Language
): TailoredCvEducation => ({
  school: e.school,
  degree: e.degree,
  field: e.field,
  location: e.location ? formatLocation(e.location) : null,
  startMonth: e.startMonth,
  endMonth: e.endMonth,
  ...BULLET_CONTENT,
  bullets: bulletsOf(e.bullets, language),
  sourceEntryId: e.id
})

const experienceFromProfile = (
  e: ProfileData['experiences'][number],
  profile: ProfileData,
  language: Language
): TailoredCvExperience => ({
  employer: e.employer,
  title: e.title,
  location: e.location ? formatLocation(e.location) : null,
  startMonth: e.startMonth,
  endMonth: e.endMonth,
  ...BULLET_CONTENT,
  technologies: technologiesFromProfile(e.skills, profile, language),
  bullets: bulletsOf(e.bullets, language),
  sourceEntryId: e.id
})

const projectFromProfile = (
  p: ProfileData['projects'][number],
  profile: ProfileData,
  language: Language
): TailoredCvProject => ({
  name: p.name,
  kind: p.kind ?? null,
  url: p.url,
  location: p.location ? formatLocation(p.location) : null,
  startMonth: p.startMonth,
  endMonth: p.endMonth,
  ...BULLET_CONTENT,
  technologies: technologiesFromProfile(p.skills, profile, language),
  bullets: bulletsOf(p.bullets, language),
  sourceEntryId: p.id
})

// The API's prefill already names skills in the draft language; AI-picked skills follow that.
const skillFromProfile = (s: ProfileData['skills'][number], language?: Language) => ({
  name: s.skill.translations.find((t) => t.language === language)?.name ?? s.skill.name,
  level: s.level,
  sourceSkillId: s.skill.id,
  categoryId: s.skill.categoryId ?? null
})

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
    // An entry the owner removed comes back at the end rather than being lost.
    if (index === -1) list.push(value as (typeof list)[number])
    else list[index] = value as (typeof list)[number]
    return
  }
  ;(cv as Record<string, unknown>)[key] = value
}

export type CvContentStyle = TailoredCv['contentStyle']
// Concise always prints bullets; the stored choice and paragraphs stay for switching back.
export const cvEntryStyle = (cv: TailoredCv): CvContentStyle =>
  cv.template === 'CONCISE' ? 'BULLETS' : cv.contentStyle

// One format for the whole CV. Entries with no paragraph yet start from their bullets joined;
// bullets stay in the draft either way, since they carry the source ids.
export const setCvContentStyle = (cv: TailoredCv, style: CvContentStyle) => {
  cv.contentStyle = style
  if (style !== 'PARAGRAPH') return
  for (const e of [...cv.experiences, ...cv.educations, ...cv.certifications, ...cv.projects]) {
    if (!e.paragraph?.trim()) e.paragraph = e.bullets.map((b) => b.text).join(' ')
  }
}

// What the tailored CV page adds to the shared editor's cards and entries. `review` and `section`
// return props and listeners for v-bind (Vue 3 passes `on*` keys as listeners): `review` for a
// card's suggestions, `section` also for its own AI run.
export interface CvEditorAi {
  review: (key: TailoredCvSectionKey) => Record<string, unknown>
  section: (key: TailoredCvSectionKey) => Record<string, unknown>
  analyze: (key: TailoredCvSectionKey, label: string) => void
}

// The lists whose profile items the owner can remove from this CV and add back.
export type CvProfileList = 'experiences' | 'educations' | 'certifications' | 'projects' | 'skills'
// The lists whose items are entries with bullets or a paragraph.
export type CvEntryList = Exclude<CvProfileList, 'skills'>
export type CvEntry = TailoredCv[CvEntryList][number]
type ProfileItem = { sourceEntryId?: number | null; sourceSkillId?: number | null }
const profileItemId = (item: ProfileItem) => item.sourceEntryId ?? item.sourceSkillId

// The profile's items this CV doesn't have, in profile order and the draft's language.
export const missingFromProfile = <K extends CvProfileList>(
  cv: TailoredCv,
  profile: ProfileData,
  list: K
): TailoredCv[K] => {
  const present = new Set((cv[list] as ProfileItem[]).map(profileItemId))
  return (tailoredCvFromProfile(profile, cv.language)[list] as ProfileItem[]).filter(
    (item) => !present.has(profileItemId(item))
  ) as TailoredCv[K]
}

// Puts a profile item back where the profile has it, before the first entry that comes later
// there. Skills go last: their order is the owner's or the AI's, not the profile's.
export const addFromProfile = <K extends CvProfileList>(
  cv: TailoredCv,
  profile: ProfileData,
  list: K,
  item: TailoredCv[K][number]
) => {
  const items = cv[list] as ProfileItem[]
  if (list === 'skills') return void items.push(item)
  const order = (profile[list] as { id: number }[]).map((e) => e.id)
  const rank = (e: ProfileItem) => order.indexOf(e.sourceEntryId ?? -1)
  const at = items.findIndex((e) => rank(e) > rank(item))
  items.splice(at === -1 ? items.length : at, 0, item)
}

// Turns one built-in analysis result into the section value it suggests, or null when it failed.
// Bullets are the result's own text (shortened for the Concise template), skills the selected profile
// skills in the AI's order; the owner's edits to an entry's other fields (title, employer, school...) stay.
export const cvSectionFromAnalysis = (
  cv: TailoredCv,
  profile: ProfileData,
  result: TailoredCvAnalysis
): { key: TailoredCvSectionKey; value: unknown } | null => {
  if (result.status !== 'SUCCEEDED') return null
  if (result.section === 'SUMMARY') return { key: 'summary', value: result.summary ?? '' }
  if (result.section === 'SKILLS') {
    // The AI's order (most relevant first) is kept: it prints as is.
    // A skill the draft already has keeps its group.
    const groups = new Map(cv.skills.map((s) => [s.sourceSkillId, s.group]))
    const value = (result.selectedSkillIds ?? [])
      .map((id) => profile.skills.find((s) => s.skill.id === id))
      .filter((s) => s != null)
      .map((s) => ({
        ...skillFromProfile(s, cv.language),
        ...(groups.get(s.skill.id) && { group: groups.get(s.skill.id) })
      }))
    return { key: 'skills', value }
  }
  const bullets = (result.bullets ?? []).map((b) => ({
    text: b.text,
    sourceBulletId: b.sourceBulletId
  }))
  if (result.section === 'EDUCATION') {
    const source = profile.educations.find((e) => e.id === result.sourceEntryId)
    if (!source) return null
    const key = `education:${source.id}` as const
    const current =
      (getCvSection(cv, key) as TailoredCvEducation | undefined) ??
      educationFromProfile(source, cv.language)
    return {
      key,
      value: {
        ...current,
        bullets,
        paragraph: result.paragraph ?? current.paragraph
      }
    }
  }
  // Technologies: a list replaces the entry's, null means no suggestion and keeps it.
  if (result.section === 'PROJECT') {
    const source = profile.projects.find((p) => p.id === result.sourceEntryId)
    if (!source) return null
    const key = `project:${source.id}` as const
    const current =
      (getCvSection(cv, key) as TailoredCvProject | undefined) ??
      projectFromProfile(source, profile, cv.language)
    // A project may have no relevant bullets; it stays, and the owner decides whether to remove it.
    return {
      key,
      value: {
        ...current,
        bullets,
        paragraph: result.paragraph ?? current.paragraph,
        technologies: result.technologies ? [...result.technologies] : current.technologies
      }
    }
  }
  if (result.section !== 'EXPERIENCE') return null
  const source = profile.experiences.find((e) => e.id === result.sourceEntryId)
  if (!source) return null
  const key = `experience:${source.id}` as const
  const current =
    (getCvSection(cv, key) as TailoredCvExperience | undefined) ??
    experienceFromProfile(source, profile, cv.language)
  // The paragraph is written from the selected bullets; it shows once the entry is in paragraph mode.
  return {
    key,
    value: {
      ...current,
      bullets,
      paragraph: result.paragraph ?? current.paragraph,
      technologies: result.technologies ? [...result.technologies] : current.technologies
    }
  }
}

// The external prompt has no contact details or layout, so the previewed candidate keeps the current ones.
// A reply without a headline (null, read as '') keeps the draft's rather than clearing it.
export const mergeExternalCandidate = (cv: TailoredCv, external: TailoredCv): TailoredCv => ({
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

// Sections where the external reply differs from the candidate, for review as suggestions.
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
  )
    .filter((key) => JSON.stringify(cv[key]) !== JSON.stringify(next[key]))
    .map((key) => ({ key, value: next[key] as unknown }))

// CVs are written in English, so dates use en-GB like the CV import review.
const range = (start?: string | null, end?: string | null, open?: string) =>
  formatMonthRange(start, end, open, 'en-GB')

const entryText = (
  heading: string,
  dates: string,
  contentStyle: TailoredCv['contentStyle'],
  content: {
    paragraph?: string | null
    bullets: TailoredCvBullet[]
    location?: string | null
    url?: string | null
    kind?: TailoredCvProject['kind']
    technologies?: string[] | null
  }
) => {
  const kind = content.kind && `${projectKindLabel(content.kind)} project`
  const detail = [dates, kind, content.location?.trim()].filter(Boolean).join(', ')
  const title = [detail ? `${heading} (${detail})` : heading, content.url?.trim()]
    .filter(Boolean)
    .join(' – ')
  const technologies = content.technologies?.length
    ? `Technologies: ${content.technologies.join(', ')}`
    : ''
  const body =
    contentStyle === 'PARAGRAPH'
      ? [content.paragraph?.trim()]
      : content.bullets.map((b) => `- ${b.text}`)
  return [title, ...body, technologies].filter(Boolean).join('\n')
}

export const proficiencyLabel = (value?: string | null) =>
  PROFICIENCY_OPTIONS.find((o) => o.value === value)?.label

// Plain text for one section; also what the suggestion compare view shows.
export const cvSectionText = (
  key: TailoredCvSectionKey,
  value: unknown,
  style: TailoredCv['contentStyle'] = 'BULLETS'
): string => {
  if (value == null) return ''
  if (key.startsWith('experience:')) return experienceText(value as TailoredCvExperience, style)
  if (key.startsWith('education:')) return educationText(value as TailoredCvEducation, style)
  if (key.startsWith('project:')) return projectText(value as TailoredCvProject, style)
  const cv = { [key]: value } as unknown as TailoredCv
  switch (key) {
    case 'headline':
    case 'summary':
      return (value as string).trim()
    case 'experiences':
      return cv.experiences.map((e) => experienceText(e, style)).join('\n\n')
    case 'educations':
      return cv.educations.map((e) => educationText(e, style)).join('\n\n')
    case 'certifications':
      return cv.certifications
        .map((c) =>
          entryText(
            [c.name, c.issuer].filter(Boolean).join(' – '),
            range(c.issuedMonth, c.expiresMonth),
            style,
            c
          )
        )
        .join('\n\n')
    case 'projects':
      return cv.projects.map((p) => projectText(p, style)).join('\n\n')
    case 'skills':
      return cv.skills.map((s) => s.name).join(', ')
    case 'languages':
      return cv.languages
        .map((l) => {
          const levels = [
            l.spoken && `spoken: ${proficiencyLabel(l.spoken)}`,
            l.written && `written: ${proficiencyLabel(l.written)}`
          ].filter(Boolean)
          return levels.length ? `${l.name} (${levels.join(', ')})` : l.name
        })
        .join(', ')
  }
  return ''
}

const educationText = (e: TailoredCvEducation, style: TailoredCv['contentStyle']) =>
  entryText(
    [[e.degree, e.field].filter(Boolean).join(', '), e.school].filter(Boolean).join(' – '),
    range(e.startMonth, e.endMonth),
    style,
    e
  )

const projectText = (p: TailoredCvProject, style: TailoredCv['contentStyle']) =>
  entryText(p.name, range(p.startMonth, p.endMonth), style, p)

const experienceText = (e: TailoredCvExperience, style: TailoredCv['contentStyle']) =>
  entryText(`${e.title} – ${e.employer}`, range(e.startMonth, e.endMonth, 'Present'), style, e)

// The whole draft as plain text for pasting into an application form or document.
export const tailoredCvToText = (cv: TailoredCv) => {
  const contact = [cv.email, cv.phone, cv.address].map((v) => v.trim()).filter(Boolean)
  const head = [
    cv.fullName.trim(),
    cv.headline.trim(),
    contact.join(' · '),
    ...cv.links.filter((l) => l.url.trim()).map((l) => `${l.label}: ${l.url}`)
  ].filter(Boolean)
  const sections = (
    [
      'summary',
      'experiences',
      'educations',
      'certifications',
      'projects',
      'skills',
      'languages'
    ] as const
  )
    .map((key) => ({
      title: CV_SECTION_TITLES[key]!.toUpperCase(),
      body: cvSectionText(key, cv[key], cv.contentStyle)
    }))
    .filter((s) => s.body)
    .map((s) => `${s.title}\n${s.body}`)
  return [head.join('\n'), ...sections].filter(Boolean).join('\n\n')
}
