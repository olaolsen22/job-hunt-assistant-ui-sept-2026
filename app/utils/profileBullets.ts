import type { ProfileData } from '~/composables/useProfile'

// Every profile bullet by id, with the name of the entry it belongs to, so AI review rows can say
// where a bullet sits.
export const profileBullets = (profile: ProfileData) => {
  const entries = [
    ...profile.experiences.map((e) => ({
      name: [e.title, e.employer].filter(Boolean).join(', '),
      bullets: e.bullets
    })),
    ...profile.educations.map((e) => ({
      name: [e.degree, e.school].filter(Boolean).join(', '),
      bullets: e.bullets
    })),
    ...profile.certifications.map((e) => ({ name: e.name, bullets: e.bullets })),
    ...profile.projects.map((e) => ({ name: e.name, bullets: e.bullets }))
  ]
  return new Map(
    entries.flatMap(({ name, bullets }) => bullets.map((bullet) => [bullet.id, { name, bullet }]))
  )
}
