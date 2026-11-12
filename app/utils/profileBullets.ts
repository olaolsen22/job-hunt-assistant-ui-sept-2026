import type { ProfileData } from '~/composables/useProfile'

// Kind is part of the key: ids from different profile entry tables can overlap.
export const profileEntries = (profile: ProfileData) => {
  const entries = [
    ...profile.experiences.map((e) => ({
      kind: 'EXPERIENCE' as const,
      id: e.id,
      name: [e.title, e.employer].filter(Boolean).join(', '),
      bullets: e.bullets
    })),
    ...profile.educations.map((e) => ({
      kind: 'EDUCATION' as const,
      id: e.id,
      name: [e.degree, e.school].filter(Boolean).join(', '),
      bullets: e.bullets
    })),
    ...profile.certifications.map((e) => ({
      kind: 'CERTIFICATION' as const,
      id: e.id,
      name: e.name,
      bullets: e.bullets
    })),
    ...profile.projects.map((e) => ({
      kind: 'PROJECT' as const,
      id: e.id,
      name: e.name,
      bullets: e.bullets
    }))
  ]
  return new Map(entries.map((e) => [`${e.kind}:${e.id}`, e]))
}

export const profileBullets = (profile: ProfileData) =>
  new Map(
    [...profileEntries(profile).values()].flatMap(({ name, bullets }) =>
      bullets.map((bullet) => [bullet.id, { name, bullet }])
    )
  )
