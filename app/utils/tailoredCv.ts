import type { ProfileData } from '~/composables/useProfile'
import type {
  TailoredCvAnalysis,
  TailoredCvContent,
  TailoredCvContentInput
} from '~/composables/useTailoredCvDraft'
import { LINK_KIND_OPTIONS, PROFICIENCY_OPTIONS } from '~/constants/listing'

// The editable candidate: the save input with every field present, so forms bind without null checks.
// Blank strings go back to the API as null (see toTailoredCvInput).
export type TailoredCv = {
  [K in keyof TailoredCvContentInput]-?: NonNullable<TailoredCvContentInput[K]>
}
export type TailoredCvExperience = TailoredCv['experiences'][number]
export type TailoredCvEducation = TailoredCv['educations'][number]
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

// Entry keys point into a list by profile entry id.
const ENTRY_LISTS = { experience: 'experiences', education: 'educations' } as const
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

// Entries start as bullets; the paragraph is only written once the owner or AI switches the style.
const BULLET_CONTENT = { contentStyle: 'BULLETS', paragraph: null } as const

const bulletsOf = (bullets: readonly { id: number; text: string }[]) =>
  bullets.map((b) => ({ text: b.text, sourceBulletId: b.id }))

const linkLabel = (link: ProfileData['links'][number]) =>
  link.kind === 'OTHER' && link.label
    ? link.label
    : LINK_KIND_OPTIONS.find((o) => o.value === link.kind)!.label

// With no saved draft, the candidate starts as the whole profile, keeping source ids for attribution.
export const tailoredCvFromProfile = (profile: ProfileData): TailoredCv => ({
  fullName: profile.fullName ?? '',
  headline: profile.headline ?? '',
  email: profile.email ?? '',
  phone: profile.phone ?? '',
  address: profile.location ? formatLocation(profile.location) : '',
  language: profile.contentLanguage,
  dateOfBirth: profile.dateOfBirth ?? '',
  referencesOnRequest: false,
  links: profile.links.map((l) => ({ label: linkLabel(l), url: l.url })),
  summary: profile.summary ?? '',
  experiences: profile.experiences.map(experienceFromProfile),
  educations: profile.educations.map(educationFromProfile),
  certifications: profile.certifications.map((c) => ({
    name: c.name,
    issuer: c.issuer,
    issuedMonth: c.issuedMonth,
    expiresMonth: c.expiresMonth,
    url: c.url,
    ...BULLET_CONTENT,
    bullets: bulletsOf(c.bullets),
    sourceEntryId: c.id
  })),
  projects: profile.projects.map((p) => ({
    name: p.name,
    url: p.url,
    startMonth: p.startMonth,
    endMonth: p.endMonth,
    ...BULLET_CONTENT,
    bullets: bulletsOf(p.bullets),
    sourceEntryId: p.id
  })),
  skills: profile.skills.map(skillFromProfile),
  languages: profile.languages.map((l) => ({ name: l.name, spoken: l.spoken, written: l.written }))
})

const educationFromProfile = (e: ProfileData['educations'][number]): TailoredCvEducation => ({
  school: e.school,
  degree: e.degree,
  field: e.field,
  startMonth: e.startMonth,
  endMonth: e.endMonth,
  ...BULLET_CONTENT,
  bullets: bulletsOf(e.bullets),
  sourceEntryId: e.id
})

const experienceFromProfile = (e: ProfileData['experiences'][number]): TailoredCvExperience => ({
  employer: e.employer,
  title: e.title,
  startMonth: e.startMonth,
  endMonth: e.endMonth,
  ...BULLET_CONTENT,
  bullets: bulletsOf(e.bullets),
  sourceEntryId: e.id
})

const skillFromProfile = (s: ProfileData['skills'][number]) => ({
  name: s.skill.name,
  level: s.level,
  sourceSkillId: s.skill.id
})

const withBullets = <
  T extends { contentStyle?: 'BULLETS' | 'PARAGRAPH' | null; bullets: readonly unknown[] }
>(
  e: T
) => ({ ...e, contentStyle: e.contentStyle ?? 'BULLETS', bullets: [...e.bullets] })

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
  links: [...(content.links ?? [])],
  summary: content.summary ?? '',
  experiences: [...(content.experiences ?? [])].map(withBullets),
  educations: [...(content.educations ?? [])].map(withBullets),
  certifications: [...(content.certifications ?? [])].map(withBullets),
  projects: [...(content.projects ?? [])].map(withBullets),
  skills: [...(content.skills ?? [])],
  languages: [...(content.languages ?? [])]
})

const blankToNull = (value: string | null | undefined) => value?.trim() || null

// The API replaces the whole draft, so every section goes out; empty bullets are dropped.
export const toTailoredCvInput = (cv: TailoredCv): TailoredCvContentInput => {
  const bullets = (list: TailoredCvBullet[]) =>
    list.filter((b) => b.text.trim()).map((b) => ({ ...b, text: b.text.trim() }))
  // The paragraph only goes out in paragraph mode, so the PDF never prints a stale one.
  const paragraph = (e: { contentStyle?: string | null; paragraph?: string | null }) =>
    e.contentStyle === 'PARAGRAPH' ? blankToNull(e.paragraph) : null
  return {
    fullName: blankToNull(cv.fullName),
    headline: blankToNull(cv.headline),
    email: blankToNull(cv.email),
    phone: blankToNull(cv.phone),
    address: blankToNull(cv.address),
    language: cv.language,
    dateOfBirth: blankToNull(cv.dateOfBirth),
    referencesOnRequest: cv.referencesOnRequest,
    summary: blankToNull(cv.summary),
    links: cv.links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    experiences: cv.experiences.map((e) => ({
      ...e,
      bullets: bullets(e.bullets),
      paragraph: paragraph(e)
    })),
    educations: cv.educations.map((e) => ({
      ...e,
      degree: blankToNull(e.degree),
      field: blankToNull(e.field),
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
      url: blankToNull(p.url),
      bullets: bullets(p.bullets),
      paragraph: paragraph(p)
    })),
    skills: cv.skills.filter((s) => s.name.trim()),
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

// Turns one built-in analysis result into the section value it suggests, or null when it failed.
// Only the selected profile bullets/skills are kept, in profile order; the owner's edits to an
// entry's other fields (title, employer, school...) stay.
export const cvSectionFromAnalysis = (
  cv: TailoredCv,
  profile: ProfileData,
  result: TailoredCvAnalysis
): { key: TailoredCvSectionKey; value: unknown } | null => {
  if (result.status !== 'SUCCEEDED') return null
  if (result.section === 'SUMMARY') return { key: 'summary', value: result.summary ?? '' }
  if (result.section === 'SKILLS') {
    const selected = new Set(result.selectedSkillIds)
    return {
      key: 'skills',
      value: profile.skills.filter((s) => selected.has(s.skill.id)).map(skillFromProfile)
    }
  }
  const selected = new Set(result.selectedBulletIds)
  const pick = (bullets: readonly { id: number; text: string }[]) =>
    bulletsOf(bullets.filter((b) => selected.has(b.id)))
  if (result.section === 'EDUCATION') {
    const source = profile.educations.find((e) => e.id === result.sourceEntryId)
    if (!source) return null
    const key = `education:${source.id}` as const
    const current =
      (getCvSection(cv, key) as TailoredCvEducation | undefined) ?? educationFromProfile(source)
    return {
      key,
      value: {
        ...current,
        bullets: pick(source.bullets),
        paragraph: result.paragraph ?? current.paragraph
      }
    }
  }
  const source = profile.experiences.find((e) => e.id === result.sourceEntryId)
  if (!source) return null
  const key = `experience:${source.id}` as const
  const current =
    (getCvSection(cv, key) as TailoredCvExperience | undefined) ?? experienceFromProfile(source)
  // The paragraph is written from the selected bullets; it shows once the entry is in paragraph mode.
  return {
    key,
    value: {
      ...current,
      bullets: pick(source.bullets),
      paragraph: result.paragraph ?? current.paragraph
    }
  }
}

// The external prompt has no contact details, so the previewed candidate keeps the current ones.
export const mergeExternalCandidate = (cv: TailoredCv, external: TailoredCv): TailoredCv => ({
  ...external,
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
  content: { contentStyle?: string | null; paragraph?: string | null; bullets: TailoredCvBullet[] }
) => {
  const title = dates ? `${heading} (${dates})` : heading
  if (content.contentStyle === 'PARAGRAPH') {
    return [title, content.paragraph?.trim()].filter(Boolean).join('\n')
  }
  return [title, ...content.bullets.map((b) => `- ${b.text}`)].join('\n')
}

const proficiencyLabel = (value?: string | null) =>
  PROFICIENCY_OPTIONS.find((o) => o.value === value)?.label

// Plain text for one section; also what the suggestion compare view shows.
export const cvSectionText = (key: TailoredCvSectionKey, value: unknown): string => {
  if (value == null) return ''
  if (key.startsWith('experience:')) return experienceText(value as TailoredCvExperience)
  if (key.startsWith('education:')) return educationText(value as TailoredCvEducation)
  const cv = { [key]: value } as unknown as TailoredCv
  switch (key) {
    case 'headline':
    case 'summary':
      return (value as string).trim()
    case 'experiences':
      return cv.experiences.map(experienceText).join('\n\n')
    case 'educations':
      return cv.educations.map(educationText).join('\n\n')
    case 'certifications':
      return cv.certifications
        .map((c) =>
          entryText(
            [c.name, c.issuer].filter(Boolean).join(' – '),
            range(c.issuedMonth, c.expiresMonth),
            c
          )
        )
        .join('\n\n')
    case 'projects':
      return cv.projects
        .map((p) => entryText(p.name, range(p.startMonth, p.endMonth), p))
        .join('\n\n')
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

const educationText = (e: TailoredCvEducation) =>
  entryText(
    [[e.degree, e.field].filter(Boolean).join(', '), e.school].filter(Boolean).join(' – '),
    range(e.startMonth, e.endMonth),
    e
  )

const experienceText = (e: TailoredCvExperience) =>
  entryText(`${e.title} – ${e.employer}`, range(e.startMonth, e.endMonth, 'Present'), e)

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
      body: cvSectionText(key, cv[key])
    }))
    .filter((s) => s.body)
    .map((s) => `${s.title}\n${s.body}`)
  return [head.join('\n'), ...sections].filter(Boolean).join('\n\n')
}

// The newest CV still free to send. The API doesn't mark generated PDFs, so an uploaded CV counts too.
export const latestCvDocument = <
  T extends { kind: string; createdAt: string; sentAt?: string | null }
>(
  documents: T[]
): T | undefined =>
  documents
    .filter((d) => d.kind === 'CV' && !d.sentAt)
    .reduce<T | undefined>(
      (latest, d) =>
        !latest || Date.parse(d.createdAt) > Date.parse(latest.createdAt) ? d : latest,
      undefined
    )
