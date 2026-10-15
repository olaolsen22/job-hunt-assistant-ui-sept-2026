import type { ProfileData } from '../../app/composables/useProfile'
import type { CvCandidate } from '../../app/composables/useProfileCvImport'

export const cvProfile = (): ProfileData => ({
  id: 1,
  contentLanguage: 'ENGLISH',
  fullName: 'Existing owner',
  headline: 'Engineer',
  summary: null,
  email: null,
  phone: null,
  dateOfBirth: null,
  nationality: null,
  workAuthorization: null,
  streetAddress: null,
  postalCode: null,
  location: null,
  translations: [],
  links: [{ kind: 'GITHUB', label: null, url: 'https://github.com/owner' }],
  hobbies: ['Chess'],
  story: { origin: null, upbringing: null, careerJourney: null, motivation: null, values: null },
  references: [],
  jobRoles: [],
  workModes: [],
  employmentTypes: [],
  minSalary: null,
  salaryCurrency: null,
  noticePeriodMonths: null,
  targetLocations: [],
  experiences: [
    {
      id: 10,
      employer: 'Acme',
      title: 'Developer',
      startMonth: '2020-01-01',
      endMonth: '2022-01-01',
      location: { city: 'Oslo', countryCode: 'NO' },
      skills: [{ id: 1, name: 'Vue' }],
      bullets: [
        {
          id: 100,
          text: 'Existing bullet',
          position: 0,
          translations: [
            {
              id: 900,
              language: 'NORWEGIAN',
              text: 'Norsk',
              sourceText: 'Existing bullet',
              isStale: false,
              isMachine: false
            }
          ]
        }
      ]
    }
  ],
  educations: [],
  certifications: [],
  projects: [
    {
      id: 20,
      name: 'Portfolio',
      url: null,
      location: null,
      startMonth: null,
      endMonth: null,
      skills: [],
      bullets: [{ id: 200, text: 'Project bullet', position: 0, translations: [] }]
    }
  ],
  skills: [{ level: 4, experienceMonths: 24, skill: { id: 1, name: 'Vue', translations: [] } }],
  languages: [{ id: 1, name: 'Norwegian', spoken: 'NATIVE', written: 'VERY_GOOD' }]
})

export const cvCandidate = (overrides: Partial<CvCandidate> = {}): CvCandidate => ({
  schemaVersion: 1,
  contentLanguage: 'ENGLISH',
  basics: {
    fullName: null,
    headline: 'Staff engineer',
    summary: null,
    email: null,
    phone: null,
    location: null
  },
  links: [],
  hobbies: [],
  experiences: [],
  educations: [],
  certifications: [],
  projects: [],
  skills: [],
  languages: [],
  warnings: [],
  ...overrides
})

export const cvExperience = (
  overrides: Partial<CvCandidate['experiences'][number]> = {}
): CvCandidate['experiences'][number] => ({
  employer: 'Acme',
  title: 'Lead',
  startMonth: '2023-01-01',
  endMonth: '2024-01-01',
  location: null,
  skillNames: null,
  bullets: ['Incoming bullet'],
  ...overrides
})
