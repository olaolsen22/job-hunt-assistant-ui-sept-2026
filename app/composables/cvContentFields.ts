// The tailored CV and CV template (base CV) documents hold the same content, so they share this.
export const CV_CONTENT_FIELDS = graphql(`
  fragment TailoredCvContentFields on TailoredCvContent {
    fullName
    headline
    email
    phone
    address
    language
    dateOfBirth
    referencesOnRequest
    sectionOrder
    contentStyle
    template
    links {
      label
      url
    }
    summary
    experiences {
      employer
      title
      location
      startMonth
      endMonth
      sourceEntryId
      paragraph
      technologies
      bullets {
        text
        sourceBulletId
      }
    }
    educations {
      school
      degree
      field
      location
      startMonth
      endMonth
      sourceEntryId
      paragraph
      bullets {
        text
        sourceBulletId
      }
    }
    certifications {
      name
      issuer
      issuedMonth
      expiresMonth
      url
      sourceEntryId
      paragraph
      bullets {
        text
        sourceBulletId
      }
    }
    projects {
      name
      url
      location
      startMonth
      endMonth
      sourceEntryId
      paragraph
      kind
      technologies
      bullets {
        text
        sourceBulletId
      }
    }
    skills {
      name
      level
      sourceSkillId
      categoryId
      group
    }
    languages {
      name
      spoken
      written
    }
  }
`)
