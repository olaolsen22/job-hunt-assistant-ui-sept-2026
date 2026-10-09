import type { ResultOf } from 'gql.tada'

// Also used by moveProfileBullet, so a reorder returns the same bullet shape (with translations).
export const BULLET_FIELDS = graphql(`
  fragment BulletFields on ProfileBullet {
    id
    text
    position
    translations {
      id
      language
      text
      sourceText
      isMachine
      isStale
    }
  }
`)

// Shared by the query and the two full-replace mutations, which return the whole profile.
// Target locations skip `isTarget` and `listingCount` (the latter costs 10 per item).
export const PROFILE_FIELDS = graphql(
  `
    fragment ProfileFields on Profile {
      id
      contentLanguage
      fullName
      headline
      summary
      translations {
        id
        language
        headline
        summary
        sourceHeadline
        sourceSummary
        isMachine
        isHeadlineStale
        isSummaryStale
      }
      email
      phone
      dateOfBirth
      nationality
      workAuthorization
      hobbies
      location {
        city
        countryCode
      }
      links {
        kind
        label
        url
      }
      jobRoles {
        id
        name
      }
      workModes
      employmentTypes
      minSalary
      salaryCurrency
      noticePeriodMonths
      targetLocations {
        id
        city
        countryCode
      }
      experiences {
        id
        employer
        title
        location {
          city
          countryCode
        }
        startMonth
        endMonth
        skills {
          id
          name
        }
        bullets {
          ...BulletFields
        }
      }
      educations {
        id
        school
        degree
        field
        location {
          city
          countryCode
        }
        startMonth
        endMonth
        bullets {
          ...BulletFields
        }
      }
      certifications {
        id
        name
        issuer
        issuedMonth
        expiresMonth
        url
        bullets {
          ...BulletFields
        }
      }
      projects {
        id
        name
        url
        location {
          city
          countryCode
        }
        startMonth
        endMonth
        skills {
          id
          name
        }
        bullets {
          ...BulletFields
        }
      }
      skills {
        level
        experienceMonths
        skill {
          id
          name
        }
      }
      languages {
        language
        level
      }
      references {
        id
        name
        relationship
        company
        email
        phone
        note
        position
      }
    }
  `,
  [BULLET_FIELDS]
)

export const PROFILE = graphql(
  `
    query Profile {
      profile {
        ...ProfileFields
      }
    }
  `,
  [PROFILE_FIELDS]
)

export type ProfileData = ResultOf<typeof PROFILE>['profile']
export type ProfileExperience = ProfileData['experiences'][number]
export type ProfileEducation = ProfileData['educations'][number]
export type ProfileCertification = ProfileData['certifications'][number]
export type ProfileProject = ProfileData['projects'][number]
export type ProfileSkill = ProfileData['skills'][number]
export type ProfileLanguage = ProfileData['languages'][number]
export type ProfileReference = ProfileData['references'][number]
export type ProfileLink = ProfileData['links'][number]
export type ProfileBullet = ProfileExperience['bullets'][number]
export type ProfileTranslation = ProfileData['translations'][number]
export type ProfileBulletTranslation = ProfileBullet['translations'][number]

// Client-only like the other pages: it needs the session cookie.
export const useProfile = () => {
  const { data, status, error, refresh } = useAsyncData(
    'profile',
    () => gql(PROFILE).then((r) => r.profile),
    { server: false }
  )
  return {
    profile: data,
    loading: computed(() => status.value === 'idle' || status.value === 'pending'),
    error,
    refresh
  }
}
