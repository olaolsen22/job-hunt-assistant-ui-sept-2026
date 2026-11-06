import type { ProfileData } from '../../app/composables/useProfile'
import { LINK_KIND_OPTIONS, type Language } from '../../app/constants/listing'
import { formatLocation } from '../../app/utils/formatLocation'
import type {
  TailoredCv,
  TailoredCvEducation,
  TailoredCvExperience,
  TailoredCvProject
} from '../../app/utils/tailoredCv'

// Stands in for the API's tailoredCvDraftFromProfile / baseCvFromProfile in tests: the app takes
// that content from the API, tests build it from a profile fixture.

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
