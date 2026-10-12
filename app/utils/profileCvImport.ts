import type { InjectionKey, Ref } from 'vue'
import type { CvCandidate, CvSelection } from '~/composables/useProfileCvImport'
import type { ProfileData } from '~/composables/useProfile'
import { CEFR_LEVELS } from '~/constants/listing'
import { isHttpUrl } from '~/utils/isHttpUrl'
import { locationInput } from '~/utils/locationInput'

export const CV_HISTORY = ['experiences', 'educations', 'certifications', 'projects'] as const
export type CvHistory = (typeof CV_HISTORY)[number]
export type CvAction = 'add' | 'update' | 'skip'
// No country means no location, as in `ProfileLocationField`.
export type CvLocation = { countryCode?: string; city?: string }
export type CvBulletDraft = { action: CvAction; id?: number; text: string }
export type CvEntryDraft = {
  action: CvAction
  id?: number
  confirmedOngoing: boolean
  employer: string
  title: string
  school: string
  degree: string
  field: string
  name: string
  issuer: string
  url: string
  startMonth: string | null
  endMonth: string | null
  issuedMonth: string | null
  expiresMonth: string | null
  location: CvLocation
  skillNames: string[]
  bullets: CvBulletDraft[]
}
export const CV_BASIC_FIELDS = ['fullName', 'headline', 'summary', 'email', 'phone'] as const
// Warnings guide review without blocking Save; everything else is an error.
export type CvIssue = { path: string; message: string; severity?: 'warning' }
// The review's visible issues, read by every `ProfileCvField` without threading props through entries.
export const CV_ISSUES: InjectionKey<Readonly<Ref<CvIssue[]>>> = Symbol('cv-issues')

export const cvPathWithin = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`)

const ENTRY_FIELDS: Record<CvHistory, readonly string[]> = {
  experiences: ['employer', 'title', 'startMonth', 'endMonth', 'location', 'skillNames'],
  educations: ['school', 'degree', 'field', 'startMonth', 'endMonth', 'location'],
  certifications: ['name', 'issuer', 'url', 'issuedMonth', 'expiresMonth'],
  projects: ['name', 'url', 'startMonth', 'endMonth', 'location', 'skillNames']
}

// Whether the review renders a field, item or section for this path, so an issue there is visible.
export const cvPathRenderable = (path: string) => {
  const entry = path.match(
    /^(experiences|educations|certifications|projects)(?:\[\d+\](?:\.(\w+)(.*))?)?$/
  )
  if (entry) {
    const [, kind, field, rest = ''] = entry
    if (!field) return true
    if (field === 'id') return !rest
    if (field === 'bullets') return /^(?:\[\d+\](?:\.(?:id|text))?)?$/.test(rest)
    return (
      ENTRY_FIELDS[kind as CvHistory].includes(field) &&
      (!rest || field === 'location' || field === 'skillNames')
    )
  }
  return /^(?:basics\.(?:fullName|headline|summary|email|phone)|basics\.location(?:\.\w+)?|links(?:\[\d+\](?:\.(?:kind|label|url))?)?|hobbies(?:\[\d+\])?|skills(?:\[\d+\](?:\.(?:name|level))?)?|languages(?:\[\d+\](?:\.(?:language|level))?)?)$/.test(
    path
  )
}

const normalizeName = (name: string | null | undefined) => name?.trim().toLowerCase() ?? ''
export const cvSavedSkill = (profile: ProfileData, name: string | null | undefined) =>
  profile.skills.find((saved) => normalizeName(saved.skill.name) === normalizeName(name))

export const normalizeCvPath = (path: string) =>
  path
    .replace(/^(?:\$\.?|selection\.)/i, '')
    .replace(/(^|\.)([A-Z])/g, (_, prefix: string, letter: string) => prefix + letter.toLowerCase())

export const cvValueSnapshot = (draft: CvDraft, path: string): string => {
  const keys = normalizeCvPath(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
  let value: unknown = draft
  if (CV_HISTORY.includes(keys[0] as CvHistory)) value = draft.entries
  if (keys[0] === 'basics' && keys[1] === 'location')
    return JSON.stringify(draft.location.value) ?? ''
  for (const key of keys) {
    if (value == null || typeof value !== 'object') return ''
    value = (value as Record<string, unknown>)[key]
  }
  if (keys[0] === 'basics' && value && typeof value === 'object' && 'value' in value)
    value = value.value
  return JSON.stringify(value) ?? ''
}

export const cvPathIncluded = (draft: CvDraft, path: string) => {
  const normalized = normalizeCvPath(path)
  const row = normalized.match(
    /^(experiences|educations|certifications|projects)\[(\d+)\](?:\.bullets\[(\d+)\])?/
  )
  if (row) {
    const entry = draft.entries[row[1] as CvHistory][Number(row[2])]
    return (
      !!entry &&
      entry.action !== 'skip' &&
      (row[3] == null || entry.bullets[Number(row[3])]?.action !== 'skip')
    )
  }
  const item = normalized.match(/^(skills|languages)\[(\d+)\]/)
  if (item) return !!draft[item[1] as 'skills' | 'languages'][Number(item[2])]?.include
  if (normalized.startsWith('links')) return draft.replaceLinks
  if (normalized.startsWith('hobbies')) return draft.replaceHobbies
  if (normalized === 'basics.location' || normalized.startsWith('basics.location.'))
    return draft.location.include
  const basic = normalized.match(/^basics\.(fullName|headline|summary|email|phone)/)
  return basic ? draft.basics[basic[1] as (typeof CV_BASIC_FIELDS)[number]].include : true
}

const ENTRY_PATH = /^(?:experiences|educations|certifications|projects)\[\d+\]$/

export const cvFeedback = (draft: CvDraft, errors: CvIssue[]) => {
  const warnings: CvIssue[] = []
  const notes: CvIssue[] = []
  for (const warning of draft.warnings) {
    if (!cvPathIncluded(draft, warning.path)) continue
    if (errors.some((error) => error.path === warning.path)) continue
    // An edit resolves a field's warning; a note about a whole entry stays until it is skipped.
    if (
      !ENTRY_PATH.test(warning.path) &&
      draft.sourceValues[warning.path] !== cvValueSnapshot(draft, warning.path)
    )
      continue
    // A valid level default resolves missing-level notices, but not source ambiguity.
    if (
      /^skills\[\d+\]\.level$/.test(warning.path) &&
      /missing|required|no level/i.test(warning.message)
    )
      continue
    const issue: CvIssue = {
      path: warning.path,
      severity: 'warning',
      message:
        warning.message
          .replace(
            /(?:selection\.)?(?:\w+\[\d+\](?:\.\w+)*|\b(?:basics|links|hobbies)\.\w+)\s*:?\s*/g,
            ''
          )
          .trim() || 'Check this value against your CV.'
    }
    if (!cvPathRenderable(issue.path)) notes.push(issue)
    else if (!warnings.some((w) => w.path === issue.path)) warnings.push(issue)
  }
  return { warnings, notes }
}

// API array indices refer to the filtered submission, not the full review draft.
export const cvSubmissionPaths = (draft: CvDraft): Record<string, string> => {
  const paths: Record<string, string> = {}
  for (const kind of CV_HISTORY) {
    let sent = 0
    draft.entries[kind].forEach((entry, i) => {
      if (entry.action === 'skip') return
      const request = `${kind}[${sent++}]`
      paths[request] = `${kind}[${i}]`
      let sentBullet = 0
      entry.bullets.forEach((bullet, j) => {
        if (bullet.action !== 'skip')
          paths[`${request}.bullets[${sentBullet++}]`] = `${kind}[${i}].bullets[${j}]`
      })
    })
  }
  for (const kind of ['skills', 'languages'] as const) {
    let sent = 0
    draft[kind].forEach((item, i) => {
      if (item.include) paths[`${kind}[${sent++}]`] = `${kind}[${i}]`
    })
  }
  return paths
}

export const cvServerIssue = (
  message: string,
  paths: Record<string, string>
): CvIssue | undefined => {
  const match = message.match(
    /(?:selection\.)?(?:basics(?:\.[A-Za-z]+)+|(?:experiences|educations|certifications|projects|skills|languages|links)\[\d+\](?:\.[A-Za-z]+(?:\[\d+\])?)*|hobbies)/i
  )
  if (!match) return
  const sent = normalizeCvPath(match[0])
  const prefix = Object.keys(paths)
    .sort((a, b) => b.length - a.length)
    .find((key) => sent === key || sent.startsWith(`${key}.`))
  const path = prefix ? paths[prefix] + sent.slice(prefix.length) : sent
  const reason = message
    .replace(match[0], '')
    .replace(/^[\s:.'"-]+|[\s'"-]+$/g, '')
    .trim()
  return { path, message: reason || 'Check this value and try saving again.' }
}
export type CvDraft = {
  basics: Record<(typeof CV_BASIC_FIELDS)[number], { include: boolean; value: string }>
  location: { include: boolean; value: CvEntryDraft['location'] }
  replaceLinks: boolean
  links: { kind: CvCandidate['links'][number]['kind']; label: string; url: string }[]
  replaceHobbies: boolean
  hobbies: string[]
  entries: Record<CvHistory, CvEntryDraft[]>
  skills: { include: boolean; name: string; level: number | null; defaultNote?: string }[]
  languages: {
    include: boolean
    language: CvCandidate['languages'][number]['language']
    level: CvCandidate['languages'][number]['level']
  }[]
  warnings: CvCandidate['warnings']
  sourceValues: Record<string, string>
}

const entryDraft = (entry: CvCandidate[CvHistory][number]): CvEntryDraft => ({
  action: 'add',
  confirmedOngoing: false,
  employer: 'employer' in entry ? (entry.employer ?? '') : '',
  title: 'title' in entry ? (entry.title ?? '') : '',
  school: 'school' in entry ? (entry.school ?? '') : '',
  degree: 'degree' in entry ? (entry.degree ?? '') : '',
  field: 'field' in entry ? (entry.field ?? '') : '',
  name: 'name' in entry ? (entry.name ?? '') : '',
  issuer: 'issuer' in entry ? (entry.issuer ?? '') : '',
  url: 'url' in entry ? (entry.url ?? '') : '',
  startMonth: 'startMonth' in entry ? entry.startMonth : null,
  endMonth: 'endMonth' in entry ? entry.endMonth : null,
  issuedMonth: 'issuedMonth' in entry ? entry.issuedMonth : null,
  expiresMonth: 'expiresMonth' in entry ? entry.expiresMonth : null,
  location: {
    countryCode: ('location' in entry && entry.location?.countryCode?.toUpperCase()) || undefined,
    city: ('location' in entry && entry.location?.city) || undefined
  },
  skillNames: 'skillNames' in entry ? [...(entry.skillNames ?? [])] : [],
  bullets: (entry.bullets ?? []).map((text) => ({ action: 'add', text }))
})

export const createCvDraft = (candidate: CvCandidate, profile: ProfileData): CvDraft => {
  const draft: CvDraft = {
    basics: Object.fromEntries(
      CV_BASIC_FIELDS.map((key) => [
        key,
        { include: candidate.basics?.[key] != null, value: candidate.basics?.[key] ?? '' }
      ])
    ) as CvDraft['basics'],
    location: {
      include: !!candidate.basics?.location,
      value: {
        countryCode: candidate.basics?.location?.countryCode?.toUpperCase() || undefined,
        city: candidate.basics?.location?.city || undefined
      }
    },
    replaceLinks: false,
    links: [...profile.links, ...candidate.links].map((link) => ({
      kind: link.kind,
      label: link.label ?? '',
      url: link.url ?? ''
    })),
    replaceHobbies: false,
    hobbies: [...profile.hobbies, ...candidate.hobbies],
    entries: Object.fromEntries(
      CV_HISTORY.map((kind) => [kind, candidate[kind].map(entryDraft)])
    ) as CvDraft['entries'],
    skills: candidate.skills.map((skill) => {
      const saved = cvSavedSkill(profile, skill.name)
      return {
        include: true,
        name: skill.name ?? '',
        level: skill.level ?? saved?.level ?? 1,
        ...(skill.level == null
          ? {
              defaultNote: saved
                ? 'Keeping your saved level.'
                : 'No level in the CV; using level 1. You can change it.'
            }
          : {})
      }
    }),
    languages: candidate.languages.map((language) => ({ include: true, ...language })),
    warnings: candidate.warnings.map((warning) => ({
      ...warning,
      path: normalizeCvPath(warning.path).replace(
        /^links\[(\d+)\]/,
        (_, index) => `links[${Number(index) + profile.links.length}]`
      )
    })),
    sourceValues: {}
  }
  for (const warning of draft.warnings)
    draft.sourceValues[warning.path] = cvValueSnapshot(draft, warning.path)
  return draft
}

// Accepts a saved entry or a draft, whose unused fields are empty strings.
export const cvEntryLabel = (entry: {
  employer?: string
  title?: string
  school?: string
  name?: string
}) => [entry.employer, entry.title].filter(Boolean).join(' · ') || entry.school || entry.name || ''

export const selectCvTarget = (
  draft: CvEntryDraft,
  kind: CvHistory,
  id: number | undefined,
  profile: ProfileData
) => {
  draft.id = id
  draft.bullets.forEach((b) => {
    b.id = undefined
    if (b.action === 'update') b.action = 'add'
  })
  const target = profile[kind].find((entry) => entry.id === id)
  if (!target) return
  // Retain existing optional structure where the incoming CV provides no value.
  for (const key of [
    'employer',
    'title',
    'school',
    'degree',
    'field',
    'name',
    'issuer',
    'url',
    'startMonth',
    'endMonth',
    'issuedMonth',
    'expiresMonth'
  ] as const) {
    if (!draft[key] && key in target)
      Object.assign(draft, { [key]: target[key as keyof typeof target] })
  }
  if ('location' in target && !draft.location.countryCode && target.location)
    draft.location = {
      countryCode: target.location.countryCode,
      city: target.location.city ?? undefined
    }
  if ('skills' in target && !draft.skillNames.length)
    draft.skillNames = target.skills.map((skill) => skill.name)
  draft.confirmedOngoing = false
}

const text = (value: string | null) => value?.trim() || null
const location = (value: CvLocation) => locationInput(value.countryCode, value.city)
const validMonth = (value: string | null) =>
  value == null || /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])-01$/.test(value)

export const reviewCvSelection = (
  draft: CvDraft,
  profile: ProfileData
): { selection: CvSelection; errors: { path: string; message: string }[]; count: number } => {
  const selection: CvSelection = { contentLanguage: 'ENGLISH' }
  const errors: { path: string; message: string }[] = []
  let count = 0
  const error = (path: string, message: string) => errors.push({ path, message })
  const basics: NonNullable<CvSelection['basics']> = {}
  for (const key of CV_BASIC_FIELDS)
    if (draft.basics[key].include) {
      basics[key] = text(draft.basics[key].value)
      count++
    }
  if (draft.location.include) {
    basics.location = location(draft.location.value)
    count++
  }
  if (Object.keys(basics).length) selection.basics = basics
  // Only imported values can reach these states; the picker sets valid codes and clears the city.
  const checkLocation = (value: CvLocation, path: string) => {
    if (value.countryCode ? !/^[A-Z]{2}$/.test(value.countryCode) : !!value.city?.trim())
      error(path, 'Choose a country for this location.')
  }
  if (draft.location.include) checkLocation(draft.location.value, 'basics.location')
  if (draft.replaceLinks) {
    selection.links = draft.links.map((link) => ({
      ...link,
      url: link.url.trim(),
      label: text(link.label)
    }))
    count++
    if (draft.links.length > 10) error('links', 'At most 10 links are allowed.')
    draft.links.forEach((link, i) => {
      if (!isHttpUrl(link.url))
        error(`links[${i}].url`, 'Enter a web address starting with https:// or http://.')
    })
  }
  if (draft.replaceHobbies) {
    selection.hobbies = draft.hobbies.map((hobby) => hobby.trim())
    count++
    if (draft.hobbies.length > 20 || draft.hobbies.some((h) => !h.trim()))
      error('hobbies', 'Use up to 20 nonempty hobbies.')
  }
  for (const kind of CV_HISTORY) {
    const used = new Set<number>()
    const rows = draft.entries[kind].filter((row) => row.action !== 'skip')
    if (rows.length > 100) error(kind, 'At most 100 entries can be selected.')
    const values = rows.map((row) => {
      const index = draft.entries[kind].indexOf(row)
      const path = `${kind}[${index}]`
      const target =
        row.action === 'update' ? profile[kind].find((e) => e.id === row.id) : undefined
      if (row.action === 'update' && (!target || used.has(row.id!)))
        error(
          `${path}.id`,
          !target
            ? 'Choose the saved entry to update.'
            : 'This entry is already selected for an update.'
        )
      if (row.action === 'update' && row.id != null) used.add(row.id)
      const bulletIds = new Set<number>()
      const bullets = row.bullets
        .filter((b) => b.action !== 'skip')
        .map((b) => {
          const bp = `${path}.bullets[${row.bullets.indexOf(b)}]`
          if (!b.text.trim() || b.text.trim().length > 500)
            error(
              `${bp}.text`,
              !b.text.trim()
                ? 'Enter the bullet text or skip it.'
                : 'Shorten this bullet to 500 characters or fewer.'
            )
          if (
            b.action === 'update' &&
            (!target?.bullets.some((old) => old.id === b.id) || bulletIds.has(b.id!))
          )
            error(`${bp}.id`, 'Choose a different saved bullet from this entry.')
          if (b.action === 'update' && b.id != null) bulletIds.add(b.id)
          return { text: b.text.trim(), ...(b.action === 'update' ? { id: b.id } : {}) }
        })
      const appended = row.bullets.filter((b) => b.action === 'add').length
      if ((target?.bullets.length ?? 0) + appended > 20)
        error(`${path}.bullets`, 'An entry can have at most 20 bullets.')
      for (const field of kind === 'certifications'
        ? (['issuedMonth', 'expiresMonth'] as const)
        : (['startMonth', 'endMonth'] as const)) {
        if (!validMonth(row[field])) error(`${path}.${field}`, 'Choose a complete month and year.')
      }
      if (kind === 'experiences' || kind === 'educations') {
        if (!row.startMonth) error(`${path}.startMonth`, 'Choose a start month and year.')
        if (!row.endMonth && !row.confirmedOngoing)
          error(`${path}.endMonth`, 'Confirm this is current or choose an end month.')
      }
      if (row.startMonth && row.endMonth && row.endMonth < row.startMonth)
        error(`${path}.endMonth`, 'Choose an end month after the start month.')
      if (kind !== 'certifications') checkLocation(row.location, `${path}.location`)
      if (row.url && !isHttpUrl(row.url) && (kind === 'projects' || kind === 'certifications'))
        error(`${path}.url`, 'Enter a web address starting with https:// or http://.')
      if (row.skillNames.length > 200)
        error(`${path}.skillNames`, 'At most 200 skill tags are allowed.')
      const required =
        kind === 'experiences'
          ? (['employer', 'title'] as const)
          : kind === 'educations'
            ? (['school'] as const)
            : (['name'] as const)
      for (const field of required)
        if (!row[field]?.trim()) error(`${path}.${field}`, 'This field is required.')
      const common = {
        ...(row.action === 'update' ? { id: row.id } : {}),
        ...(bullets.length ? { bullets } : {})
      }
      count++
      if (kind === 'experiences')
        return {
          ...common,
          employer: row.employer.trim(),
          title: row.title.trim(),
          startMonth: row.startMonth,
          endMonth: row.endMonth,
          location: location(row.location),
          skillNames: row.skillNames
        } satisfies NonNullable<CvSelection['experiences']>[number]
      if (kind === 'educations')
        return {
          ...common,
          school: row.school.trim(),
          degree: text(row.degree),
          field: text(row.field),
          startMonth: row.startMonth,
          endMonth: row.endMonth,
          location: location(row.location)
        } satisfies NonNullable<CvSelection['educations']>[number]
      if (kind === 'certifications')
        return {
          ...common,
          name: row.name.trim(),
          issuer: text(row.issuer),
          issuedMonth: row.issuedMonth,
          expiresMonth: row.expiresMonth,
          url: text(row.url)
        } satisfies NonNullable<CvSelection['certifications']>[number]
      return {
        ...common,
        name: row.name.trim(),
        url: text(row.url),
        startMonth: row.startMonth,
        endMonth: row.endMonth,
        location: location(row.location),
        skillNames: row.skillNames
      } satisfies NonNullable<CvSelection['projects']>[number]
    })
    // Each branch checks its structural fields against the schema-derived input.
    if (values.length) Object.assign(selection, { [kind]: values })
  }
  const skills = draft.skills.filter((skill) => skill.include)
  if (skills.length) {
    selection.skills = skills.map((skill) => ({ name: skill.name.trim(), level: skill.level }))
    count += skills.length
    if (skills.length > 200) error('skills', 'At most 200 skills are allowed.')
    const names = new Set<string>()
    skills.forEach((skill) => {
      const path = `skills[${draft.skills.indexOf(skill)}]`
      if (!skill.name.trim() || names.has(skill.name.trim().toLowerCase()))
        error(
          `${path}.name`,
          !skill.name.trim()
            ? 'Enter the skill name or skip it.'
            : 'This skill is already included. Skip one copy.'
        )
      names.add(skill.name.trim().toLowerCase())
      if (
        skill.level == null ||
        !Number.isInteger(skill.level) ||
        skill.level < 1 ||
        skill.level > 5
      )
        error(`${path}.level`, 'Choose a skill level from 1 to 5.')
    })
  }
  const languages = draft.languages.filter((lang) => lang.include)
  if (languages.length) {
    selection.languages = languages.map(({ language, level }) => ({ language, level }))
    count += languages.length
    const seen = new Set<string>()
    languages.forEach((lang) => {
      const path = `languages[${draft.languages.indexOf(lang)}]`
      if (!lang.level || !CEFR_LEVELS.includes(lang.level))
        error(`${path}.level`, 'Choose your language proficiency or skip this language.')
      if (seen.has(lang.language))
        error(`${path}.language`, 'This language is already included. Skip one copy.')
      seen.add(lang.language)
    })
  }
  return { selection, errors, count }
}
