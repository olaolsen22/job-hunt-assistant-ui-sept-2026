import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { USelectMenu, USelect, UCheckbox } from '#components'
import { VueDraggable } from 'vue-draggable-plus'
import ProfileSkillModal from '~/components/profile/SkillModal.vue'
import AppMonthField from '~/components/app/MonthField.vue'
import ProfilePage from '~/pages/profile.vue'
import ProfileNamesField from '~/components/profile/NamesField.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const emptyProfile = {
  id: 1,
  contentLanguage: 'NORWEGIAN',
  translations: [] as Record<string, unknown>[],
  fullName: null,
  headline: null,
  summary: null,
  email: null,
  phone: null,
  dateOfBirth: null,
  nationality: null,
  workAuthorization: null,
  hobbies: [],
  location: null,
  links: [],
  references: [],
  jobRoles: [],
  workModes: [],
  employmentTypes: [],
  minSalary: null,
  salaryCurrency: null,
  noticePeriodMonths: null,
  targetLocations: [],
  experiences: [],
  educations: [],
  certifications: [],
  projects: [],
  skills: [],
  languages: []
}

const bullet = (id: number, text: string, position: number) => ({
  id,
  text,
  position,
  translations: [] as Record<string, unknown>[]
})

const filledProfile = {
  ...emptyProfile,
  fullName: 'Ada Lovelace',
  headline: 'Engineer',
  summary: 'Writes **code**',
  email: 'ada@example.com',
  phone: '+47 123',
  dateOfBirth: '1990-05-17',
  nationality: 'Norwegian',
  workAuthorization: 'EU citizen',
  hobbies: ['Chess'],
  location: { city: 'Oslo', countryCode: 'NO' },
  links: [{ kind: 'GITHUB', label: 'GitHub', url: 'https://github.com/ada' }],
  references: [
    {
      id: 50,
      name: 'Grace Hopper',
      relationship: 'Former manager',
      company: 'Navy',
      email: null,
      phone: null,
      note: null,
      position: 0
    },
    {
      id: 51,
      name: 'Alan Turing',
      relationship: 'Colleague',
      company: null,
      email: null,
      phone: null,
      note: null,
      position: 1
    }
  ],
  jobRoles: [{ id: 1, name: 'Developer' }],
  workModes: ['REMOTE'],
  employmentTypes: ['PERMANENT'],
  minSalary: 700000,
  salaryCurrency: 'NOK',
  noticePeriodMonths: 3,
  targetLocations: [{ id: 5, city: 'Oslo', countryCode: 'NO' }],
  experiences: [
    {
      id: 10,
      employer: 'Acme',
      title: 'Developer',
      location: { city: 'Bergen', countryCode: 'NO' },
      startMonth: '2020-01-01',
      endMonth: null,
      skills: [{ id: 1, name: 'Vue' }],
      bullets: [bullet(100, 'Led a team', 0)]
    }
  ],
  educations: [
    {
      id: 20,
      school: 'NTNU',
      degree: 'BSc',
      field: 'CS',
      location: null,
      startMonth: '2015-08-01',
      endMonth: '2018-06-01',
      bullets: []
    }
  ],
  certifications: [
    {
      id: 30,
      name: 'AWS',
      issuer: 'Amazon',
      issuedMonth: '2022-05-01',
      expiresMonth: null,
      url: null,
      bullets: []
    }
  ],
  projects: [
    {
      id: 40,
      name: 'Side project',
      url: null,
      location: null,
      startMonth: null,
      endMonth: null,
      skills: [],
      bullets: []
    }
  ],
  skills: [{ level: 4, experienceMonths: 30, skill: { id: 1, name: 'Vue' } }],
  languages: [{ language: 'ENGLISH', level: 'C1' }]
}

// `input` is whatever the mutation under test sends; each test reads the fields it cares about.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { query: string; variables: { input: Record<string, any> } }
// Returns a response to stand in for the API, or undefined to fall through to the profile query.
type Respond = (body: Request, profile: typeof filledProfile) => Record<string, unknown> | undefined

const mountPage = async (profile: typeof emptyProfile = filledProfile, respond?: Respond) => {
  const requests: Request[] = []
  const current = structuredClone(profile) as typeof filledProfile
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const body: Request = await readBody(event)
      requests.push(body)
      return { data: respond?.(body, current) ?? { profile: current } }
    }
  })
  // useAsyncData keeps its data between mounts in the same file.
  clearNuxtData('profile')
  const wrapper = await mountSuspended(ProfilePage)
  await flushPromises()
  return { wrapper, requests, profile: current }
}

// Modals render in the document body, outside the mounted wrapper.
const setInput = (testid: string, value: string) => {
  const el = document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
  const input = el instanceof HTMLInputElement ? el : el.querySelector('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
}

// For inputs inside the mounted page (not in a modal).
const setInputIn = (
  wrapper: { get: (s: string) => { element: Element } },
  selector: string,
  value: string
) => {
  const el = wrapper.get(selector).element
  const input = el instanceof HTMLInputElement ? el : el.querySelector('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
}

const clickConfirm = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()

describe('ProfilePage', () => {
  it('keeps the profile mounted when refreshing CV update targets fails', async () => {
    let failed = false
    const { wrapper } = await mountPage({ ...filledProfile, contentLanguage: 'ENGLISH' }, () => {
      if (failed) throw new Error('Refresh unavailable')
      return undefined
    })
    failed = true
    await expect(wrapper.vm.refreshCvProfile()).rejects.toThrow()
    expect(wrapper.get('[data-testid="profile-header"]').text()).toContain('Ada Lovelace')
    wrapper.unmount()
  })

  it('offers CV import on empty and populated English-primary profiles, including translated profiles', async () => {
    for (const profile of [
      { ...emptyProfile, contentLanguage: 'ENGLISH' },
      {
        ...filledProfile,
        contentLanguage: 'ENGLISH',
        translations: [
          {
            id: 1,
            language: 'NORWEGIAN',
            headline: 'Norsk',
            summary: null,
            sourceHeadline: 'Engineer',
            sourceSummary: null,
            isMachine: false,
            isHeadlineStale: false,
            isSummaryStale: false
          }
        ]
      }
    ]) {
      const { wrapper } = await mountPage(profile)
      expect(
        wrapper.get('[data-testid="profile-import-cv"]').attributes('disabled')
      ).toBeUndefined()
      expect(wrapper.find('[data-testid="profile-import-cv-hint"]').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('explains unavailable CV import for a Norwegian-primary profile', async () => {
    const { wrapper } = await mountPage(emptyProfile)
    expect(wrapper.get('[data-testid="profile-import-cv"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="profile-import-cv-hint"]').text()).toContain(
      'content language control'
    )
    wrapper.unmount()
  })

  it('shows every section of a filled profile', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('[data-testid="profile-header"]').text()).toContain('Ada Lovelace')
    expect(wrapper.get('[data-testid="profile-links"] a').attributes('target')).toBe('_blank')
    for (const section of [
      'summary',
      'experience',
      'projects',
      'education',
      'references',
      'hobbies',
      'skills',
      'languages',
      'certifications'
    ]) {
      expect(wrapper.find(`[data-testid="profile-${section}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="profile-${section}-empty"]`).exists()).toBe(false)
    }
  })

  it('shows an empty state with an add action for a new profile', async () => {
    const { wrapper } = await mountPage(emptyProfile)
    for (const section of [
      'summary',
      'experience',
      'projects',
      'education',
      'references',
      'hobbies',
      'skills',
      'languages',
      'certifications'
    ]) {
      expect(wrapper.find(`[data-testid="profile-${section}-empty"]`).exists()).toBe(true)
    }
    expect(wrapper.text()).toContain('Add experience')
  })

  it('saves the basics with every other field unchanged and updates without a refetch', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('updateProfile(')) return undefined
      const input = body.variables.input
      Object.assign(profile, { headline: input.headline })
      return { updateProfile: { profile, errors: null } }
    })

    await wrapper.get('[data-testid="profile-edit"]').trigger('click')
    await flushPromises()
    setInput('basics-headline', 'Staff engineer')
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-header"]').text()).toContain('Staff engineer')
    )
    expect(requests.find((r) => r.query.includes('updateProfile('))!.variables.input).toEqual({
      fullName: 'Ada Lovelace',
      headline: 'Staff engineer',
      email: 'ada@example.com',
      phone: '+47 123',
      summary: 'Writes **code**',
      dateOfBirth: '1990-05-17',
      nationality: 'Norwegian',
      workAuthorization: 'EU citizen',
      hobbies: ['Chess'],
      location: { countryCode: 'NO', city: 'Oslo' },
      links: [{ kind: 'GITHUB', label: null, url: 'https://github.com/ada' }]
    })
    expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('sends a new job role in the preferences and shows it after saving', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('updateProfilePreferences(')) return undefined
      const input = body.variables.input
      profile.jobRoles = input.jobRoleNames.map((name: string, id: number) => ({ id, name }))
      return { updateProfilePreferences: { profile, errors: null } }
    })

    await wrapper.get('[data-testid="profile-preferences-edit"]').trigger('click')
    await flushPromises()
    // Picking a name goes through the combobox, which has its own tests; drive its model directly.
    wrapper
      .findComponent(ProfileNamesField)
      .vm.$emit('update:modelValue', ['Developer', 'Designer'])
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-preferences-rows"]').text()).toContain('Designer')
    )
    expect(
      requests.find((r) => r.query.includes('updateProfilePreferences('))!.variables.input
    ).toMatchObject({
      jobRoleNames: ['Developer', 'Designer'],
      minSalary: 700000,
      salaryCurrency: 'NOK'
    })
    wrapper.unmount()
  })

  it('adds and removes a target location', async () => {
    const { wrapper, requests } = await mountPage()
    const saves = () => requests.filter((r) => r.query.includes('saveLocation('))

    // The only select menu on the page while the modals are closed.
    wrapper.getComponent(USelectMenu).vm.$emit('update:modelValue', 'SE')
    await flushPromises()
    await wrapper.get('[data-testid="profile-target-add"]').trigger('click')
    await vi.waitFor(() => expect(saves()).toHaveLength(1))
    expect(saves()[0]!.variables.input).toEqual({ countryCode: 'SE', city: null, isTarget: true })

    await wrapper.get('[aria-label="Remove Oslo, Norway"]').trigger('click')
    await vi.waitFor(() => expect(saves()).toHaveLength(2))
    expect(saves()[1]!.variables.input).toEqual({
      countryCode: 'NO',
      city: 'Oslo',
      isTarget: false
    })
    wrapper.unmount()
  })

  it('adds a current experience with only its own fields and refetches', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('addProfileExperience(')
        ? { addProfileExperience: { profileExperience: { id: 11 }, errors: null } }
        : undefined
    )

    await wrapper.get('[data-testid="profile-experience-add"]').trigger('click')
    await flushPromises()
    setInput('experience-employer', 'Globex')
    setInput('experience-title', 'Lead')
    wrapper.findComponent(AppMonthField).vm.$emit('update:modelValue', '2021-03-01')
    wrapper.findComponent(UCheckbox).vm.$emit('update:modelValue', true)
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    expect(
      requests.find((r) => r.query.includes('addProfileExperience('))!.variables.input
    ).toEqual({
      employer: 'Globex',
      title: 'Lead',
      location: null,
      startMonth: '2021-03-01',
      endMonth: null,
      skillNames: []
    })
    wrapper.unmount()
  })

  it('deletes an education only after confirming', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('deleteProfileEducation(')
        ? { deleteProfileEducation: { id: 20, errors: null } }
        : undefined
    )

    await wrapper
      .get('[data-testid="profile-education"] [data-testid="profile-entry-delete"]')
      .trigger('click')
    await flushPromises()
    expect(requests.some((r) => r.query.includes('deleteProfileEducation('))).toBe(false)
    clickConfirm()

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('deleteProfileEducation('))!.variables.input
      ).toEqual({
        id: 20
      })
    )
    wrapper.unmount()
  })

  it('refetches when an entry no longer exists', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('updateProfileExperience(')
        ? {
            updateProfileExperience: {
              profileExperience: null,
              errors: [{ __typename: 'ProfileEntryNotFoundError', message: 'Entry is gone' }]
            }
          }
        : undefined
    )

    await wrapper
      .get('[data-testid="profile-experience"] [data-testid="profile-entry-edit"]')
      .trigger('click')
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    wrapper.unmount()
  })
})

describe('ProfilePage bullets', () => {
  const withBullets = (texts: string[]) => ({
    ...filledProfile,
    experiences: [
      {
        ...filledProfile.experiences[0]!,
        bullets: texts.map((text, i) => bullet(100 + i, text, i))
      }
    ]
  })
  const bulletTexts = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) =>
    wrapper
      .findAll('[data-testid="profile-experience"] [data-testid="profile-bullet"]')
      .map((li) => li.text())

  it('adds a bullet to the right entry kind', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('addProfileBullet(')
        ? { addProfileBullet: { profileBullet: { id: 101 }, errors: null } }
        : undefined
    )
    const section = '[data-testid="profile-experience"]'

    setInputIn(wrapper, `${section} [data-testid="profile-bullet-new"]`, ' Led a team of 4 ')
    await flushPromises()
    await wrapper.get(`${section} form`).trigger('submit')

    await vi.waitFor(() =>
      expect(requests.find((r) => r.query.includes('addProfileBullet('))!.variables.input).toEqual({
        kind: 'EXPERIENCE',
        entryId: 10,
        text: 'Led a team of 4'
      })
    )
    wrapper.unmount()
  })

  it('edits a bullet', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('updateProfileBullet(')
        ? { updateProfileBullet: { profileBullet: { id: 100 }, errors: null } }
        : undefined
    )
    const section = '[data-testid="profile-experience"]'

    await wrapper.get(`${section} [data-testid="profile-bullet-edit"]`).trigger('click')
    setInputIn(wrapper, `${section} [data-testid="profile-bullet-input"]`, 'Led a team of 5')
    await flushPromises()
    await wrapper
      .get(`${section} [data-testid="profile-bullet-input"]`)
      .element.closest('form')!
      .dispatchEvent(new Event('submit'))

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('updateProfileBullet('))!.variables.input
      ).toEqual({
        id: 100,
        text: 'Led a team of 5'
      })
    )
    wrapper.unmount()
  })

  it('sends the final index on a drop and shows the returned order', async () => {
    const { wrapper, requests } = await mountPage(withBullets(['one', 'two', 'three']), (body) =>
      body.query.includes('moveProfileBullet(')
        ? {
            moveProfileBullet: {
              bullets: [bullet(102, 'three', 0), bullet(100, 'one', 1), bullet(101, 'two', 2)],
              errors: null
            }
          }
        : undefined
    )

    // jsdom can't do a real pointer drag, so emit what SortableJS would for the third item going first.
    wrapper.getComponent(VueDraggable).vm.$emit('update', { oldIndex: 2, newIndex: 0 })

    await vi.waitFor(() => expect(bulletTexts(wrapper)).toEqual(['three', 'one', 'two']))
    expect(requests.find((r) => r.query.includes('moveProfileBullet('))!.variables.input).toEqual({
      id: 102,
      position: 0
    })
    // The returned list replaced the bullets; there was no refetch.
    expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('disables Add bullet at 20 bullets', async () => {
    const { wrapper } = await mountPage(withBullets(Array.from({ length: 20 }, (_, i) => `b${i}`)))
    setInputIn(
      wrapper,
      '[data-testid="profile-experience"] [data-testid="profile-bullet-new"]',
      'one more'
    )
    await flushPromises()
    expect(
      wrapper
        .get('[data-testid="profile-experience"] [data-testid="profile-bullet-add"]')
        .attributes('disabled')
    ).toBeDefined()
    wrapper.unmount()
  })
})

describe('ProfilePage skills and languages', () => {
  it('changes a skill level by name', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('setProfileSkill(')) return undefined
      profile.skills[0]!.level = body.variables.input.level
      return {
        setProfileSkill: { profileSkill: { level: body.variables.input.level }, errors: null }
      }
    })

    await wrapper.get('[data-testid="profile-skill-edit"]').trigger('click')
    await flushPromises()
    wrapper.getComponent(ProfileSkillModal).getComponent(USelect).vm.$emit('update:modelValue', 5)
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-skill"]').text()).toContain('Level 5/5')
    )
    expect(requests.find((r) => r.query.includes('setProfileSkill('))!.variables.input).toEqual({
      name: 'Vue',
      level: 5
    })
    wrapper.unmount()
  })

  it('adds Norwegian and then offers no more languages', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('setProfileLanguage(')) return undefined
      profile.languages.push(body.variables.input)
      return { setProfileLanguage: { profileLanguage: body.variables.input } }
    })
    expect(wrapper.find('[data-testid="profile-language-add-row"]').exists()).toBe(true)

    await wrapper.get('[data-testid="profile-language-add"]').trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="profile-language-add-row"]').exists()).toBe(false)
    )
    expect(requests.find((r) => r.query.includes('setProfileLanguage('))!.variables.input).toEqual({
      language: 'NORWEGIAN',
      level: 'B2'
    })
    expect(wrapper.findAll('[data-testid="profile-language"]')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('ProfilePage references, hobbies and links', () => {
  it('shows hobbies, the link kind and the personal details', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('[data-testid="profile-hobbies"]').text()).toContain('Chess')
    expect(wrapper.get('[data-testid="profile-header"]').text()).toContain('EU citizen')
    expect(wrapper.get('[data-testid="profile-links"]').text()).toContain('GitHub')
    wrapper.unmount()
  })

  it('sends no label for a non-OTHER link and drops rows without a URL', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) =>
      body.query.includes('updateProfile(')
        ? { updateProfile: { profile, errors: null } }
        : undefined
    )
    await wrapper.get('[data-testid="profile-edit"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="basics-add-link"]')!.click()
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(requests.some((r) => r.query.includes('updateProfile('))).toBe(true)
    )
    expect(requests.find((r) => r.query.includes('updateProfile('))!.variables.input.links).toEqual(
      [{ kind: 'GITHUB', label: null, url: 'https://github.com/ada' }]
    )
    wrapper.unmount()
  })

  it('moves a reference and shows the returned order without a refetch', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) =>
      body.query.includes('moveProfileReference(')
        ? {
            moveProfileReference: {
              references: [
                { ...profile.references[1]!, position: 0 },
                { ...profile.references[0]!, position: 1 }
              ],
              errors: null
            }
          }
        : undefined
    )
    const names = () => wrapper.findAll('[data-testid="profile-reference"]').map((li) => li.text())

    wrapper
      .getComponent('[data-testid="profile-references"]')
      .getComponent(VueDraggable)
      .vm.$emit('update', { oldIndex: 1, newIndex: 0 })

    await vi.waitFor(() => expect(names()[0]).toContain('Alan Turing'))
    expect(
      requests.find((r) => r.query.includes('moveProfileReference('))!.variables.input
    ).toEqual({
      id: 51,
      position: 0
    })
    expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('adds a reference', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('addProfileReference(')
        ? { addProfileReference: { profileReference: { id: 52 }, errors: null } }
        : undefined
    )
    await wrapper.get('[data-testid="profile-references-add"]').trigger('click')
    await flushPromises()
    setInput('reference-name', 'Ken Thompson')
    setInput('reference-relationship', 'Mentor')
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('addProfileReference('))!.variables.input
      ).toEqual({
        name: 'Ken Thompson',
        relationship: 'Mentor',
        company: null,
        email: null,
        phone: null,
        note: null
      })
    )
    wrapper.unmount()
  })
})

describe('ProfilePage translations', () => {
  const tr = (over: Record<string, unknown> = {}) => ({
    id: 900,
    language: 'ENGLISH',
    text: 'Led a team',
    sourceText: 'Ledet et team',
    isMachine: false,
    isStale: false,
    ...over
  })
  const withTranslation = (translation?: Record<string, unknown>) => ({
    ...filledProfile,
    contentLanguage: 'NORWEGIAN',
    experiences: [
      {
        ...filledProfile.experiences[0]!,
        bullets: [
          { ...bullet(100, 'Ledet et team', 0), translations: translation ? [translation] : [] }
        ]
      }
    ]
  })
  const bulletTr = '[data-testid="profile-bullet-translation"]'

  const startTranslating = async (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) => {
    await wrapper.get('[data-testid="profile-translate-toggle"]').trigger('click')
    await flushPromises()
  }

  it('adds a bullet translation in the language that is not the content language', async () => {
    const { wrapper, requests } = await mountPage(withTranslation(), (body) =>
      body.query.includes('setProfileBulletTranslation(')
        ? { setProfileBulletTranslation: { profileBulletTranslation: { id: 1 }, errors: null } }
        : undefined
    )
    await startTranslating(wrapper)

    await wrapper.get('[data-testid="profile-bullet-translation-add"]').trigger('click')
    setInputIn(wrapper, '[data-testid="profile-bullet-translation-input"]', ' Led a team ')
    await flushPromises()
    await wrapper.get(`${bulletTr} form`).trigger('submit')

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('setProfileBulletTranslation('))!.variables.input
      ).toEqual({ bulletId: 100, language: 'ENGLISH', text: 'Led a team', isMachine: false })
    )
    wrapper.unmount()
  })

  it('shows stale and machine badges only when flagged', async () => {
    const { wrapper } = await mountPage(withTranslation(tr()))
    await startTranslating(wrapper)
    expect(wrapper.find('[data-testid="profile-bullet-translation-stale"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-bullet-translation-machine"]').exists()).toBe(false)
    wrapper.unmount()

    const flagged = await mountPage(withTranslation(tr({ isStale: true, isMachine: true })))
    await startTranslating(flagged.wrapper)
    expect(flagged.wrapper.find('[data-testid="profile-bullet-translation-stale"]').exists()).toBe(
      true
    )
    expect(
      flagged.wrapper.find('[data-testid="profile-bullet-translation-machine"]').exists()
    ).toBe(true)
    await flagged.wrapper.get('[data-testid="profile-bullet-translation-changes"]').trigger('click')
    expect(flagged.wrapper.get('[data-testid="profile-bullet-translation-diff"]').text()).toContain(
      'Ledet et team'
    )
    flagged.wrapper.unmount()
  })

  it('keeps the draft when the API rejects the translation', async () => {
    const { wrapper, requests } = await mountPage(withTranslation(), (body) =>
      body.query.includes('setProfileBulletTranslation(')
        ? {
            setProfileBulletTranslation: {
              profileBulletTranslation: null,
              errors: [{ __typename: 'InvalidProfileError', message: 'Too long' }]
            }
          }
        : undefined
    )
    await startTranslating(wrapper)
    await wrapper.get('[data-testid="profile-bullet-translation-add"]').trigger('click')
    setInputIn(wrapper, '[data-testid="profile-bullet-translation-input"]', 'Led')
    await flushPromises()
    await wrapper.get(`${bulletTr} form`).trigger('submit')
    await flushPromises()

    expect(
      (wrapper.get('[data-testid="profile-bullet-translation-input"]').element as HTMLInputElement)
        .value
    ).toBe('Led')
    expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('refetches when a translation no longer exists', async () => {
    const { wrapper, requests } = await mountPage(withTranslation(tr()), (body) =>
      body.query.includes('deleteProfileBulletTranslation(')
        ? {
            deleteProfileBulletTranslation: {
              id: null,
              errors: [{ __typename: 'ProfileEntryNotFoundError', message: 'Gone' }]
            }
          }
        : undefined
    )
    await startTranslating(wrapper)
    await wrapper.get('[data-testid="profile-bullet-translation-delete"]').trigger('click')

    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    expect(
      requests.find((r) => r.query.includes('deleteProfileBulletTranslation('))!.variables.input
    ).toEqual({ id: 900 })
    wrapper.unmount()
  })

  it('disables the content language once a translation exists', async () => {
    const { wrapper } = await mountPage(withTranslation(tr()))
    expect(wrapper.getComponent(USelect).props('disabled')).toBe(true)
    expect(wrapper.get('[data-testid="profile-content-language-hint"]').text()).toContain(
      'Delete all translations'
    )
    wrapper.unmount()
  })

  it('changes the content language and refetches', async () => {
    const { wrapper, requests } = await mountPage(withTranslation(), (body) =>
      body.query.includes('setProfileContentLanguage(')
        ? { setProfileContentLanguage: { profile: { contentLanguage: 'ENGLISH' }, errors: null } }
        : undefined
    )
    const select = wrapper.get('[data-testid="profile-content-language"]')
    expect(wrapper.getComponent(USelect).props('disabled')).toBe(false)
    wrapper.getComponent(USelect).vm.$emit('update:modelValue', 'ENGLISH')

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('setProfileContentLanguage('))!.variables.input
      ).toEqual({ language: 'ENGLISH' })
    )
    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    expect(select.exists()).toBe(true)
    wrapper.unmount()
  })

  it('sends both headline and summary when only one was edited', async () => {
    const profile = {
      ...withTranslation(),
      translations: [
        {
          id: 1,
          language: 'ENGLISH',
          headline: 'Engineer EN',
          summary: 'Summary EN',
          sourceHeadline: 'Engineer',
          sourceSummary: 'Writes **code**',
          isMachine: false,
          isHeadlineStale: false,
          isSummaryStale: false
        }
      ]
    }
    const { wrapper, requests } = await mountPage(profile, (body) =>
      body.query.includes('setProfileTranslation(')
        ? { setProfileTranslation: { profileTranslation: { id: 1 }, errors: null } }
        : undefined
    )
    await startTranslating(wrapper)
    await wrapper.get('[data-testid="profile-translation-edit"]').trigger('click')
    await flushPromises()
    setInput('profile-translation-headline-input', 'Engineer II')
    await flushPromises()
    clickConfirm()

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('setProfileTranslation('))!.variables.input
      ).toEqual({
        language: 'ENGLISH',
        headline: 'Engineer II',
        summary: 'Summary EN',
        isMachine: false
      })
    )
    wrapper.unmount()
  })
})
