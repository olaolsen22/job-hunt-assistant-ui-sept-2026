import type { ResultOf, VariablesOf } from 'gql.tada'

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
          category
          translations {
            language
            name
          }
        }
      }
      languages {
        id
        name
        spoken
        written
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

const UPDATE_PROFILE = graphql(
  `
    mutation UpdateProfile($input: UpdateProfileInput!) {
      updateProfile(input: $input) {
        profile {
          ...ProfileFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [PROFILE_FIELDS]
)

type UpdateProfileInput = VariablesOf<typeof UPDATE_PROFILE>['input']

// updateProfile replaces every field, so the current values go out for whatever a form doesn't edit.
export const profileUpdateInput = (profile: ProfileData): UpdateProfileInput => ({
  fullName: profile.fullName,
  headline: profile.headline,
  email: profile.email,
  phone: profile.phone,
  summary: profile.summary,
  dateOfBirth: profile.dateOfBirth,
  nationality: profile.nationality,
  workAuthorization: profile.workAuthorization,
  hobbies: [...profile.hobbies],
  location:
    profile.location &&
    locationInput(profile.location.countryCode, profile.location.city ?? undefined),
  links: profile.links.map((l) => ({
    kind: l.kind,
    label: l.kind === 'OTHER' ? l.label : null,
    url: l.url
  }))
})

// Saves part of the basics (details, summary or hobbies); resolves to the returned profile, or null
// when the API rejected it (its message is already shown).
export const useProfileUpdate = (onStale: () => void) => {
  const { run, loading } = useMutation(onStale)
  const save = async (
    profile: ProfileData,
    changes: Partial<UpdateProfileInput>
  ): Promise<ProfileData | null> => {
    let saved: ProfileData | null = null
    const ok = await run(async () => {
      const { updateProfile } = await gql(UPDATE_PROFILE, {
        input: { ...profileUpdateInput(profile), ...changes }
      })
      saved = updateProfile.profile
      return updateProfile.errors
    })
    return ok ? saved : null
  }
  return { save, loading }
}

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
