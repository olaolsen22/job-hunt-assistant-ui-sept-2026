import { PROFICIENCY_OPTIONS, projectKindLabel } from '~/constants/listing'
import type {
  TailoredCv,
  TailoredCvBullet,
  TailoredCvEducation,
  TailoredCvExperience,
  TailoredCvProject,
  TailoredCvSectionKey
} from '~/utils/tailoredCv'

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
