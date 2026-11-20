import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import type { Component } from 'vue'
import { USelectMenu, USelect, UCheckbox, URadioGroup } from '#components'
import { VueDraggable } from 'vue-draggable-plus'
import ProfileExperienceModal from '~/components/profile/ExperienceModal.vue'
import ProfileProjectKindSelect from '~/components/profile/ProjectKindSelect.vue'
import ProfilePreferencesModal from '~/components/profile/PreferencesModal.vue'
import AppMonthField from '~/components/app/MonthField.vue'
import ProfilePage from '~/pages/profile.vue'
import ProfileNamesField from '~/components/profile/NamesField.vue'
import ProfileLanguageModal from '~/components/profile/LanguageModal.vue'
import ProfileTargetLocations from '~/components/profile/TargetLocations.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

// Simulate a tablet-up screen; `wide` switches on the two-column layout (from 1536px).
let wide = false
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === '(min-width: 768px)' || (wide && query === '(min-width: 1536px)'),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
  onchange: null,
  addListener: () => {},
  removeListener: () => {}
}))

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
  streetAddress: null,
  postalCode: null,
  hobbies: [],
  story: {
    origin: null,
    upbringing: null,
    careerJourney: null,
    motivation: null,
    values: null
  } as Record<string, string | null>,
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
      skills: [{ id: 1, name: 'Vue', translations: [] }],
      translations: [],
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
      translations: [],
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
      kind: null,
      url: null,
      location: null,
      startMonth: null,
      endMonth: null,
      skills: [],
      bullets: []
    }
  ],
  skills: [{ level: 4, experienceMonths: 30, skill: { id: 1, name: 'Vue', translations: [] } }],
  languages: [{ id: 1, name: 'English', spoken: 'NATIVE', written: 'GOOD' }]
}

// `input` is whatever the mutation under test sends; each test reads the fields it cares about.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { query: string; variables: { input: Record<string, any> } }
// Returns a response to stand in for the API, or undefined to fall through to the profile query.
type Respond = (body: Request, profile: typeof filledProfile) => Record<string, unknown> | undefined

// UTooltip needs the TooltipProvider that UApp gives the real app; the stub shows what it would say.
const TooltipStub = defineComponent({
  props: { text: String, disabled: Boolean },
  setup:
    (props, { slots }) =>
    () =>
      h('div', { 'data-tooltip': props.disabled ? undefined : props.text }, slots.default?.())
})

const mountPage = async (
  profile: typeof emptyProfile = filledProfile,
  respond?: Respond,
  stubs: Record<string, Component> = {}
) => {
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
  // useAsyncData keeps its data between mounts in the same file, and so does the route.
  clearNuxtData('profile')
  await useRouter().replace({ query: {} })
  const wrapper = await mountSuspended(ProfilePage, {
    global: { stubs: { UTooltip: TooltipStub, ...stubs } }
  })
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

// The test id sits on either the field or its wrapper, depending on the Nuxt UI component.
const fieldIn = (wrapper: { get: (s: string) => { element: Element } }, selector: string) => {
  const el = wrapper.get(selector).element
  return (el.matches('input, textarea') ? el : el.querySelector('input, textarea')!) as
    HTMLInputElement | HTMLTextAreaElement
}

// For inputs inside the mounted page (not in a modal).
const setInputIn = (
  wrapper: { get: (s: string) => { element: Element } },
  selector: string,
  value: string
) => {
  const input = fieldIn(wrapper, selector)
  input.value = value
  input.dispatchEvent(new Event('input'))
}

const contentLanguage = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  wrapper
    .findAllComponents(URadioGroup)
    .find((group) => group.vm.$attrs['data-testid'] === 'profile-content-language')!

// The language tabs (UTabs, Reka) switch on mousedown, as a pointer would.
const languageTabs = (wrapper: { element: Element }) => [
  ...wrapper.element.querySelectorAll<HTMLElement>(
    '[data-testid="profile-language-view"] [role="tab"]'
  )
]
const chooseView = async (wrapper: { element: Element }, label: string) => {
  languageTabs(wrapper)
    .find((tab) => tab.textContent?.includes(label))!
    .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  await flushPromises()
}

const EXPERIENCE_ACTIONS =
  '[data-testid="profile-experience"] [data-testid="profile-entry-actions"]'

const clickConfirm = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()

// Opens a row's actions menu from the keyboard (Reka opens it on pointerdown, not click) and picks an item.
const chooseAction = async (
  wrapper: { get: (s: string) => { trigger: (e: string, o?: object) => Promise<void> } },
  trigger: string,
  label: string
) => {
  await wrapper.get(trigger).trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (el) => el.textContent?.trim() === label
  )!
  item.click()
  await flushPromises()
}

// Save in the open form modal; closed modals render nothing, so there is only one.
const clickSave = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="form-modal-save"]')!.click()

describe('ProfilePage', () => {
  it('keeps the profile mounted when refreshing CV update targets fails', async () => {
    let failed = false
    const { wrapper } = await mountPage({ ...filledProfile, contentLanguage: 'ENGLISH' }, () => {
      if (failed) throw new Error('Refresh unavailable')
      return undefined
    })
    failed = true
    await expect(wrapper.vm.refreshCvProfile()).rejects.toThrow()
    expect(wrapper.get('[data-testid="profile-contact"]').text()).toContain('Ada Lovelace')
    wrapper.unmount()
  })

  it('offers CV import in the overflow menu on English-primary profiles but not Norwegian', async () => {
    const english = await mountPage({ ...filledProfile, contentLanguage: 'ENGLISH' })
    await english.wrapper.get('[data-testid="profile-menu"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const englishItems = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(englishItems.some((el) => el.textContent?.trim() === 'Import CV')).toBe(true)
    english.wrapper.unmount()

    const norwegian = await mountPage(filledProfile)
    await norwegian.wrapper.get('[data-testid="profile-menu"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const norwegianItems = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(norwegianItems.some((el) => el.textContent?.trim() === 'Import CV')).toBe(false)
    norwegian.wrapper.unmount()
  })

  it('shows every section of a filled profile', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('[data-testid="profile-contact"]').text()).toContain('Ada Lovelace')
    expect(wrapper.get('[data-testid="profile-link"]').attributes('target')).toBe('_blank')
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

  it('formats profile dates in the content language', async () => {
    const english = await mountPage({ ...filledProfile, contentLanguage: 'ENGLISH' })
    expect(english.wrapper.get('[data-testid="profile-experience"]').text()).toContain(
      'Jan 2020 – Present'
    )
    expect(english.wrapper.get('[data-testid="profile-dob"]').text()).toBe('17 May 1990')
    english.wrapper.unmount()

    const norwegian = await mountPage()
    expect(norwegian.wrapper.get('[data-testid="profile-experience"]').text()).toMatch(
      /jan\.? 2020 – Present/
    )
    expect(norwegian.wrapper.get('[data-testid="profile-dob"]').text()).toContain('mai 1990')
    norwegian.wrapper.unmount()
  })

  const order = (html: string, ids: string[]) =>
    ids.map((id) => html.indexOf(`data-testid="profile-${id}"`))
  const ascending = (positions: number[]) =>
    positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]!))

  it('shows one column in reading order, with the off-CV zone last', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-testid="profile-columns"]').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('CV profile')
    const positions = order(wrapper.html(), [
      'settings',
      'contact',
      'summary',
      'experience',
      'skills',
      'education',
      'certifications',
      'projects',
      'languages',
      'hobbies',
      'references',
      'off-cv',
      'preferences',
      'address',
      'story'
    ])
    expect(ascending(positions)).toBe(true)
    expect(wrapper.get('[data-testid="profile-preferences"] h2').text()).toBe('Job preferences')
    wrapper.unmount()
  })

  it('splits the cards into a main and a side column from 1536px', async () => {
    wide = true
    try {
      const { wrapper } = await mountPage()
      const [main, side] = wrapper.get('[data-testid="profile-columns"]').findAll(':scope > div')
      expect(
        ascending(
          order(main!.html(), ['contact', 'summary', 'experience', 'projects', 'references'])
        )
      ).toBe(true)
      expect(
        ascending(
          order(side!.html(), [
            'settings',
            'skills',
            'education',
            'certifications',
            'languages',
            'hobbies'
          ])
        )
      ).toBe(true)
      expect(main!.find('[data-testid="profile-skills"]').exists()).toBe(false)
      // The off-CV zone stays full width below both columns.
      expect(
        wrapper
          .get('[data-testid="profile-columns"]')
          .find('[data-testid="profile-off-cv"]')
          .exists()
      ).toBe(false)
      expect(wrapper.find('[data-testid="profile-off-cv"]').exists()).toBe(true)
      wrapper.unmount()
    } finally {
      wide = false
    }
  })

  it('shows an empty state with an add action for a new profile', async () => {
    const { wrapper } = await mountPage(emptyProfile)
    for (const section of [
      'contact',
      'summary',
      'experience',
      'projects',
      'education',
      'skills',
      'languages',
      'certifications',
      'references',
      'hobbies'
    ]) {
      expect(wrapper.find(`[data-testid="profile-${section}-empty"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="profile-onboarding"]').exists()).toBe(true)
    // Nothing to translate yet, so no language strip.
    expect(wrapper.find('[data-testid="profile-settings"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Add experience')
    wrapper.unmount()
  })

  it('skips the onboarding card and shows the language strip for a filled profile', async () => {
    const { wrapper } = await mountPage(filledProfile)
    expect(wrapper.find('[data-testid="profile-onboarding"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-settings"]').exists()).toBe(true)
    wrapper.unmount()
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
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-contact"]').text()).toContain('Staff engineer')
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

  it('edits only the summary in its own form and keeps the other basics', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('updateProfile(')) return undefined
      Object.assign(profile, { summary: body.variables.input.summary })
      return { updateProfile: { profile, errors: null } }
    })

    await wrapper.get('[data-testid="profile-summary-edit"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="basics-headline"]')).toBeNull()
    const textarea = document.body.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!
    textarea.value = 'New summary'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-summary"]').text()).toContain('New summary')
    )
    expect(requests.find((r) => r.query.includes('updateProfile('))!.variables.input).toMatchObject(
      { summary: 'New summary', headline: 'Engineer', hobbies: ['Chess'] }
    )
    wrapper.unmount()
  })

  it('saves a typed hobby that was not added yet, keeping the other basics', async () => {
    const { wrapper, requests } = await mountPage(emptyProfile, (body, profile) => {
      if (!body.query.includes('updateProfile(')) return undefined
      Object.assign(profile, { hobbies: body.variables.input.hobbies })
      return { updateProfile: { profile, errors: null } }
    })

    await wrapper.get('[data-testid="profile-hobbies-add"]').trigger('click')
    await flushPromises()
    setInput('names-field-input', 'Climbing')
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-hobbies"]').text()).toContain('Climbing')
    )
    expect(requests.find((r) => r.query.includes('updateProfile('))!.variables.input).toMatchObject(
      { hobbies: ['Climbing'], summary: null, links: [] }
    )
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
      .getComponent(ProfilePreferencesModal)
      .getComponent(ProfileNamesField)
      .vm.$emit('update:modelValue', ['Developer', 'Designer'])
    await flushPromises()
    clickSave()

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

  it('adds and removes a target location in the preferences form, with the card read-only', async () => {
    const { wrapper, requests } = await mountPage()
    const saves = () => requests.filter((r) => r.query.includes('saveLocation('))
    expect(wrapper.find('[data-testid="profile-target-add"]').exists()).toBe(false)

    await wrapper.get('[data-testid="profile-preferences-edit"]').trigger('click')
    await flushPromises()
    wrapper
      .getComponent(ProfileTargetLocations)
      .getComponent(USelectMenu)
      .vm.$emit('update:modelValue', 'SE')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="profile-target-add"]')!.click()
    await vi.waitFor(() => expect(saves()).toHaveLength(1))
    expect(saves()[0]!.variables.input).toEqual({ countryCode: 'SE', city: null, isTarget: true })

    document.body.querySelector<HTMLButtonElement>('[aria-label="Remove Oslo, Norway"]')!.click()
    await flushPromises()
    expect(saves()).toHaveLength(1)
    clickConfirm()
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
    wrapper
      .getComponent(ProfileExperienceModal)
      .getComponent(AppMonthField)
      .vm.$emit('update:modelValue', '2021-03-01')
    wrapper
      .getComponent(ProfileExperienceModal)
      .getComponent(UCheckbox)
      .vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(document.body.textContent).toContain('You can add bullets after saving.')
    clickSave()

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

    await chooseAction(
      wrapper,
      '[data-testid="profile-education"] [data-testid="profile-entry-actions"]',
      'Delete'
    )
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

  it('always sends the project type, set or cleared, since the update replaces the project', async () => {
    const profile = {
      ...filledProfile,
      projects: [{ ...filledProfile.projects[0]!, kind: 'OPEN_SOURCE' as const }]
    }
    const { wrapper, requests } = await mountPage(profile, (body) =>
      body.query.includes('updateProfileProject(')
        ? { updateProfileProject: { profileProject: { id: 40 }, errors: null } }
        : undefined
    )
    expect(wrapper.get('[data-testid="profile-projects"]').text()).toContain('Open source project')

    const projectActions = '[data-testid="profile-projects"] [data-testid="profile-entry-actions"]'
    const saveWith = async (kind: unknown) => {
      await chooseAction(wrapper, projectActions, 'Edit')
      if (kind !== undefined)
        wrapper.getComponent(ProfileProjectKindSelect).vm.$emit('update:modelValue', kind)
      await flushPromises()
      clickSave()
      await flushPromises()
    }
    const sentKinds = () =>
      requests
        .filter((r) => r.query.includes('updateProfileProject('))
        .map((r) => r.variables.input.kind)

    await saveWith(undefined)
    await vi.waitFor(() => expect(sentKinds()).toEqual(['OPEN_SOURCE']))
    await saveWith(null)
    await vi.waitFor(() => expect(sentKinds()).toEqual(['OPEN_SOURCE', null]))
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

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    clickSave()

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
  const cardBullets = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) =>
    wrapper
      .findAll('[data-testid="profile-experience"] [data-testid="profile-bullet"]')
      .map((li) => li.text())
  const inModal = (testid: string) =>
    document.body.querySelector<HTMLElement>(`[role="dialog"] [data-testid="${testid}"]`)!
  const pressEnter = (testid: string) =>
    inModal(testid).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

  it('shows bullets on the card as plain text, without editing controls', async () => {
    const { wrapper } = await mountPage()
    expect(cardBullets(wrapper)).toEqual(['Led a team'])
    const card = wrapper.get('[data-testid="profile-experience"]')
    expect(card.find('[data-testid="profile-bullet-new"]').exists()).toBe(false)
    expect(card.find('[data-testid="profile-bullet-edit"]').exists()).toBe(false)
    expect(card.find('.drag-handle').exists()).toBe(false)
    wrapper.unmount()
  })

  it('adds a bullet from the entry form and shows it in the open form', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('addProfileBullet(')) return undefined
      profile.experiences[0]!.bullets.push(bullet(101, body.variables.input.text, 1))
      return { addProfileBullet: { profileBullet: { id: 101 }, errors: null } }
    })

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('profile-bullet-new', ' Led a team of 4 ')
    await flushPromises()
    pressEnter('profile-bullet-new')

    await vi.waitFor(() =>
      expect(requests.find((r) => r.query.includes('addProfileBullet('))!.variables.input).toEqual({
        kind: 'EXPERIENCE',
        entryId: 10,
        text: 'Led a team of 4'
      })
    )
    await vi.waitFor(() =>
      expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain(
        'Led a team of 4'
      )
    )
    expect(cardBullets(wrapper)).toEqual(['Led a team', 'Led a team of 4'])
    wrapper.unmount()
  })

  it('keeps the typed text when the API rejects a bullet', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('addProfileBullet(')
        ? {
            addProfileBullet: {
              profileBullet: null,
              errors: [{ __typename: 'ValidationError', message: 'Too long' }]
            }
          }
        : undefined
    )
    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('profile-bullet-new', 'Way too long')
    await flushPromises()
    pressEnter('profile-bullet-new')

    await vi.waitFor(() =>
      expect(requests.some((r) => r.query.includes('addProfileBullet('))).toBe(true)
    )
    await flushPromises()
    expect(inModal('profile-bullet-new')).toHaveProperty('value', 'Way too long')
    wrapper.unmount()
  })

  it('edits a bullet with Enter', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('updateProfileBullet(')
        ? { updateProfileBullet: { profileBullet: { id: 100 }, errors: null } }
        : undefined
    )

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    inModal('profile-bullet-edit').click()
    await flushPromises()
    setInput('profile-bullet-input', 'Led a team of 5')
    await flushPromises()
    pressEnter('profile-bullet-input')

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

  it('deletes a bullet only after confirming, and cancelling the form keeps it deleted', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('deleteProfileBullet(')) return undefined
      profile.experiences[0]!.bullets = []
      return { deleteProfileBullet: { id: 100, errors: null } }
    })
    const deletes = () => requests.filter((r) => r.query.includes('deleteProfileBullet('))

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    inModal('profile-bullet-delete').click()
    await flushPromises()
    expect(deletes()).toHaveLength(0)
    clickConfirm()

    await vi.waitFor(() => expect(deletes()).toHaveLength(1))
    await vi.waitFor(() => expect(cardBullets(wrapper)).toEqual([]))
    // Nothing else changed, so Cancel closes without asking and the delete stays.
    inModal('form-modal-cancel').click()
    await flushPromises()
    expect(document.body.textContent).not.toContain('Discard changes?')
    expect(cardBullets(wrapper)).toEqual([])
    wrapper.unmount()
  })

  it('sends the final index on a drop and refetches the card', async () => {
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

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    // happy-dom can't do a real pointer drag, so emit what SortableJS would for the third item going first.
    wrapper.getComponent(VueDraggable).vm.$emit('update', { oldIndex: 2, newIndex: 0 })

    await vi.waitFor(() =>
      expect(requests.find((r) => r.query.includes('moveProfileBullet('))!.variables.input).toEqual(
        { id: 102, position: 0 }
      )
    )
    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    wrapper.unmount()
  })

  it('adds a typed but not yet added bullet when the form is saved', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (body.query.includes('addProfileBullet(')) {
        profile.experiences[0]!.bullets.push(bullet(101, body.variables.input.text, 1))
        return { addProfileBullet: { profileBullet: { id: 101 }, errors: null } }
      }
      if (body.query.includes('updateProfileExperience('))
        return { updateProfileExperience: { profileExperience: { id: 10 }, errors: null } }
      return undefined
    })

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('profile-bullet-new', 'Shipped the app')
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(requests.some((r) => r.query.includes('updateProfileExperience('))).toBe(true)
    )
    expect(
      requests.find((r) => r.query.includes('addProfileBullet('))!.variables.input
    ).toMatchObject({ entryId: 10, text: 'Shipped the app' })
    await vi.waitFor(() => expect(cardBullets(wrapper)).toEqual(['Led a team', 'Shipped the app']))
    wrapper.unmount()
  })

  it('keeps the form open and skips the entry save when the typed bullet fails', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('addProfileBullet(')
        ? {
            addProfileBullet: {
              profileBullet: null,
              errors: [{ __typename: 'ValidationError', message: 'Too long' }]
            }
          }
        : undefined
    )

    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('profile-bullet-new', 'Way too long')
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(requests.some((r) => r.query.includes('addProfileBullet('))).toBe(true)
    )
    await flushPromises()
    expect(requests.some((r) => r.query.includes('updateProfileExperience('))).toBe(false)
    expect(inModal('profile-bullet-new')).toHaveProperty('value', 'Way too long')
    wrapper.unmount()
  })

  it('disables Add bullet at 20 bullets', async () => {
    const { wrapper } = await mountPage(withBullets(Array.from({ length: 20 }, (_, i) => `b${i}`)))
    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('profile-bullet-new', 'one more')
    await flushPromises()
    expect(inModal('profile-bullet-add').hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })
})

describe('ProfilePage entry forms', () => {
  it('shows an inline error and sends nothing when the employer is missing', async () => {
    const { wrapper, requests } = await mountPage()
    await wrapper.get('[data-testid="profile-experience-add"]').trigger('click')
    await flushPromises()
    setInput('experience-title', 'Lead')
    wrapper
      .getComponent(ProfileExperienceModal)
      .getComponent(AppMonthField)
      .vm.$emit('update:modelValue', '2021-03-01')
    await flushPromises()
    clickSave()
    await flushPromises()

    expect(document.body.textContent).toContain('Enter an employer.')
    expect(requests.some((r) => r.query.includes('addProfileExperience('))).toBe(false)
    wrapper.unmount()
  })

  it('saves when Enter submits the form', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('updateProfileExperience(')
        ? { updateProfileExperience: { profileExperience: { id: 10 }, errors: null } }
        : undefined
    )
    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('experience-title', 'Lead')
    await flushPromises()
    // A browser submits the form on Enter in a field; happy-dom needs the event itself.
    document.body.querySelector('[role="dialog"] form')!.dispatchEvent(new Event('submit'))

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('updateProfileExperience('))!.variables.input
      ).toMatchObject({ id: 10, title: 'Lead', employer: 'Acme' })
    )
    wrapper.unmount()
  })

  it('asks before discarding unsaved changes', async () => {
    const { wrapper } = await mountPage()
    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('experience-title', 'Lead')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="form-modal-cancel"]')!.click()
    await flushPromises()

    expect(document.body.textContent).toContain('Discard changes?')
    expect(document.body.querySelector('[data-testid="experience-title"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('asks before discarding a typed bullet that was not added yet', async () => {
    const { wrapper } = await mountPage(filledProfile)
    await chooseAction(wrapper, EXPERIENCE_ACTIONS, 'Edit')
    setInput('profile-bullet-new', 'Shipped the app')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-testid="form-modal-cancel"]')!.click()
    await flushPromises()

    expect(document.body.textContent).toContain('Discard changes?')
    expect(
      document.body.querySelector('[role="dialog"] [data-testid="profile-bullet-new"]')
    ).toHaveProperty('value', 'Shipped the app')
    wrapper.unmount()
  })
})

describe('ProfilePage skills and languages', () => {
  it('offers the AI skill tidy-ups in the section menu, before Clear section', async () => {
    // The AI modals have their own tests; here only which one opens matters.
    const modalStub = (name: string) =>
      defineComponent({
        props: { open: Boolean },
        setup: (props) => () => (props.open ? h('div', { 'data-testid': name }) : null)
      })
    const { wrapper } = await mountPage(filledProfile, undefined, {
      ProfileSkillCleanupModal: modalStub('cleanup-modal'),
      ProfileSkillWordingModal: modalStub('wording-modal')
    })
    expect(wrapper.find('[data-testid="profile-skills-edit"]').exists()).toBe(true)
    await wrapper.get('[data-testid="profile-skills-menu"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.map((el) => el.textContent?.trim())).toEqual([
      'Clean up skills with AI',
      'Fix skill wording',
      'Clear section…'
    ])
    items[1]!.click()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="wording-modal"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="cleanup-modal"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('has no skills menu while there are no skills', async () => {
    const { wrapper } = await mountPage(emptyProfile)
    expect(wrapper.find('[data-testid="profile-skills-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-skills-menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('changes a skill level with one tap in the bulk form', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('setProfileSkill(')) return undefined
      profile.skills[0]!.level = body.variables.input.level
      return {
        setProfileSkill: { profileSkill: { level: body.variables.input.level }, errors: null }
      }
    })

    await wrapper.get('[data-testid="profile-skills-edit"]').trigger('click')
    await flushPromises()
    document.body
      .querySelector<HTMLButtonElement>('[aria-label="Vue level"] button:nth-child(5)')!
      .click()
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-skill"]').text()).toContain('Level 5/5')
    )
    expect(requests.find((r) => r.query.includes('setProfileSkill('))!.variables.input).toEqual({
      name: 'Vue',
      level: 5
    })
    wrapper.unmount()
  })

  it('removes a marked skill after one confirm and keeps a failed row open', async () => {
    const profile = {
      ...filledProfile,
      skills: [
        ...filledProfile.skills,
        { level: 1, experienceMonths: 0, skill: { id: 2, name: 'Go', translations: [] } }
      ]
    }
    const { wrapper, requests } = await mountPage(profile, (body) => {
      if (body.query.includes('removeProfileSkill('))
        return { removeProfileSkill: { skillId: 2, errors: null } }
      if (body.query.includes('setProfileSkill('))
        return {
          setProfileSkill: {
            profileSkill: null,
            errors: [{ __typename: 'InvalidProfileError', message: 'Level rejected' }]
          }
        }
      return undefined
    })

    await wrapper.get('[data-testid="profile-skills-edit"]').trigger('click')
    await flushPromises()
    document.body
      .querySelector<HTMLButtonElement>('[aria-label="Vue level"] button:nth-child(2)')!
      .click()
    document.body.querySelector<HTMLButtonElement>('[aria-label="Remove Go"]')!.click()
    await flushPromises()
    clickSave()
    await flushPromises()
    expect(document.body.textContent).toContain('Remove 1 skill?')
    expect(requests.some((r) => r.query.includes('removeProfileSkill('))).toBe(false)
    clickConfirm()

    await vi.waitFor(() => expect(document.body.textContent).toContain('Level rejected'))
    expect(requests.find((r) => r.query.includes('removeProfileSkill('))!.variables.input).toEqual({
      skillId: 2
    })
    expect(document.body.querySelector('[data-testid="skills-failed"]')!.textContent).toContain(
      "1 change didn't save"
    )
    expect(document.body.querySelectorAll('[data-testid="skills-row"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('adds a language by name in the language form', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('setProfileLanguage(')) return undefined
      profile.languages.push({ id: 2, ...body.variables.input })
      return { setProfileLanguage: { profileLanguage: body.variables.input, errors: null } }
    })

    await wrapper.get('[data-testid="profile-languages-add"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLInputElement>('[data-testid="language-name"]')!.value =
      'Norwegian'
    document.body
      .querySelector('[data-testid="language-name"]')!
      .dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="profile-language"]')).toHaveLength(2)
    )
    expect(requests.find((r) => r.query.includes('setProfileLanguage('))!.variables.input).toEqual({
      name: 'Norwegian',
      spoken: 'GOOD',
      written: 'GOOD'
    })
    expect(wrapper.get('[data-testid="profile-languages"]').text()).toContain('Norwegian')
    wrapper.unmount()
  })

  it('changes a language written level', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('setProfileLanguage(')) return undefined
      profile.languages[0]!.written = body.variables.input.written
      return { setProfileLanguage: { profileLanguage: body.variables.input, errors: null } }
    })

    await chooseAction(wrapper, '[data-testid="profile-language-actions"]', 'Edit')
    wrapper
      .getComponent(ProfileLanguageModal)
      .findAllComponents(USelect)[1]!
      .vm.$emit('update:modelValue', 'NATIVE')
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-language"]').text()).toContain('Written: Native')
    )
    expect(requests.find((r) => r.query.includes('setProfileLanguage('))!.variables.input).toEqual({
      name: 'English',
      spoken: 'NATIVE',
      written: 'NATIVE'
    })
    wrapper.unmount()
  })

  it('removes a language only after confirming', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body) =>
      body.query.includes('removeProfileLanguage(')
        ? { removeProfileLanguage: { name: 'English', errors: null } }
        : undefined
    )
    const removes = () => requests.filter((r) => r.query.includes('removeProfileLanguage('))

    await chooseAction(wrapper, '[data-testid="profile-language-actions"]', 'Remove')
    expect(removes()).toHaveLength(0)
    expect(document.body.textContent).toContain('Remove this language?')
    clickConfirm()

    await vi.waitFor(() => expect(removes()).toHaveLength(1))
    expect(removes()[0]!.variables.input).toEqual({ name: 'English' })
    wrapper.unmount()
  })
})

describe('ProfilePage references, hobbies and links', () => {
  it('shows hobbies, the link kind and the personal details', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('[data-testid="profile-hobbies"]').text()).toContain('Chess')
    expect(wrapper.get('[data-testid="profile-contact"]').text()).toContain('EU citizen')
    expect(wrapper.get('[data-testid="profile-link"]').text()).toContain('GitHub')
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
    clickSave()

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
    clickSave()

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

  // These profiles are written in Norwegian, so the translated view is English.
  const startTranslating = async (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) => {
    await chooseView(wrapper, 'English')
    await vi.waitFor(() => expect(useRoute().query.lang).toBe('english'))
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

  it('opens the next bullet without a translation after saving one', async () => {
    const profile = {
      ...filledProfile,
      contentLanguage: 'NORWEGIAN',
      experiences: [
        {
          ...filledProfile.experiences[0]!,
          bullets: [
            { ...bullet(100, 'Ledet et team', 0), translations: [] },
            { ...bullet(101, 'Bygde appen', 1), translations: [tr({ id: 901, text: 'Built it' })] },
            { ...bullet(102, 'Lanserte appen', 2), translations: [] }
          ]
        }
      ]
    }
    const { wrapper } = await mountPage(profile, (body) =>
      body.query.includes('setProfileBulletTranslation(')
        ? { setProfileBulletTranslation: { profileBulletTranslation: { id: 1 }, errors: null } }
        : undefined
    )
    await startTranslating(wrapper)

    await wrapper.get('[data-testid="profile-bullet-translation-add"]').trigger('click')
    setInputIn(wrapper, '[data-testid="profile-bullet-translation-input"]', 'Led a team')
    await flushPromises()
    await wrapper.get(`${bulletTr} form`).trigger('submit')

    // The translated second bullet is skipped; the third opens, empty, for the next one.
    await vi.waitFor(() =>
      expect(
        wrapper.get('[data-testid="profile-bullet-translation-input"]').attributes('aria-label')
      ).toContain('Lanserte appen')
    )
    expect(wrapper.findAll('[data-testid="profile-bullet-translation-input"]')).toHaveLength(1)
    expect(
      (
        wrapper.get('[data-testid="profile-bullet-translation-input"]')
          .element as HTMLTextAreaElement
      ).value
    ).toBe('')
    wrapper.unmount()
  })

  it('translates a job title and then opens the entry’s first untranslated bullet', async () => {
    const { wrapper, requests } = await mountPage(withTranslation(), (body) =>
      body.query.includes('setProfileExperienceTranslation(')
        ? {
            setProfileExperienceTranslation: {
              profileExperienceTranslation: { id: 1 },
              errors: null
            }
          }
        : undefined
    )
    await startTranslating(wrapper)

    const [title] = wrapper.findAll('[data-testid="profile-entry-translation-add"]')
    await title!.trigger('click')
    setInputIn(wrapper, '[data-testid="profile-entry-translation-title"]', ' Developer ')
    await flushPromises()
    await wrapper.get('[data-testid="profile-entry-translation"] form').trigger('submit')

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('setProfileExperienceTranslation('))!.variables.input
      ).toEqual({ experienceId: 10, language: 'ENGLISH', title: 'Developer', isMachine: false })
    )
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="profile-bullet-translation-input"]').exists()).toBe(true)
    )
    wrapper.unmount()
  })

  it('sends both education fields when editing one, and shows what changed per field', async () => {
    const profile = {
      ...withTranslation(),
      educations: [
        {
          ...filledProfile.educations[0]!,
          translations: [
            {
              id: 950,
              language: 'ENGLISH',
              degree: 'Bachelor',
              field: 'Computer science',
              sourceDegree: 'Bachelorgrad',
              sourceField: 'CS',
              isMachine: true,
              isDegreeStale: true,
              isFieldStale: false
            }
          ]
        }
      ]
    }
    const { wrapper, requests } = await mountPage(profile, (body) =>
      body.query.includes('setProfileEducationTranslation(')
        ? {
            setProfileEducationTranslation: {
              profileEducationTranslation: { id: 950 },
              errors: null
            }
          }
        : undefined
    )
    await startTranslating(wrapper)

    // Only the stale degree is compared; the job title row has no translation, so this is the education's.
    await wrapper.get('[data-testid="profile-entry-translation-changes"]').trigger('click')
    const diffs = wrapper.findAll('[data-testid="profile-entry-translation-diff"]')
    expect(diffs).toHaveLength(1)
    expect(diffs[0]!.text()).toContain('Bachelorgrad')

    // Full replace: the untouched field goes out too, so it isn't cleared.
    await chooseAction(wrapper, '[data-testid="profile-entry-translation-actions"]', 'Edit')
    setInputIn(wrapper, '[data-testid="profile-entry-translation-degree"]', 'BSc')
    await flushPromises()
    await wrapper.get('[data-testid="profile-entry-translation"] form').trigger('submit')

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('setProfileEducationTranslation('))!.variables.input
      ).toEqual({
        educationId: 20,
        language: 'ENGLISH',
        degree: 'BSc',
        field: 'Computer science',
        isMachine: false
      })
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

    expect(fieldIn(wrapper, '[data-testid="profile-bullet-translation-input"]').value).toBe('Led')
    expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('asks before deleting a translation, then refetches when it no longer exists', async () => {
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
    await chooseAction(wrapper, '[data-testid="profile-bullet-translation-actions"]', 'Delete')
    expect(requests.some((r) => r.query.includes('deleteProfileBulletTranslation('))).toBe(false)
    expect(document.body.textContent).toContain('Delete this translation?')
    clickConfirm()

    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    expect(
      requests.find((r) => r.query.includes('deleteProfileBulletTranslation('))!.variables.input
    ).toEqual({ id: 900 })
    wrapper.unmount()
  })

  it('switches between the written and translated views through ?lang', async () => {
    const { wrapper } = await mountPage(withTranslation(tr()))
    expect(languageTabs(wrapper).map((t) => t.textContent?.trim())).toEqual([
      'Norwegian',
      'English2'
    ])
    expect(wrapper.find(bulletTr).exists()).toBe(false)

    await startTranslating(wrapper)
    expect(wrapper.find(bulletTr).exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-translate-progress"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-translate-ai"]').exists()).toBe(true)

    await chooseView(wrapper, 'Norwegian')
    await vi.waitFor(() => expect(useRoute().query.lang).toBeUndefined())
    expect(wrapper.find(bulletTr).exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-translate-progress"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the translated view from the URL, but not for the written language', async () => {
    const { wrapper } = await mountPage(withTranslation(tr()))
    await useRouter().replace({ query: { lang: 'norwegian' } })
    await flushPromises()
    expect(wrapper.find(bulletTr).exists()).toBe(false)

    await useRouter().replace({ query: { lang: 'english' } })
    await vi.waitFor(() => expect(wrapper.find(bulletTr).exists()).toBe(true))
    const selected = languageTabs(wrapper).find((t) => t.getAttribute('aria-selected') === 'true')
    expect(selected?.textContent).toContain('English')
    wrapper.unmount()
  })

  it('stays in the written view on an empty profile, which has no tabs to switch back', async () => {
    const { wrapper } = await mountPage(emptyProfile)
    await useRouter().replace({ query: { lang: 'english' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="profile-settings"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-off-cv"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-summary-add"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('says there is nothing to translate when only untranslated sections have content', async () => {
    const { wrapper } = await mountPage({ ...emptyProfile, hobbies: ['Chess'] })
    expect(wrapper.get('[data-testid="profile-settings-summary"]').text()).toBe(
      'Written in Norwegian · English: nothing to translate yet'
    )
    await startTranslating(wrapper)
    expect(wrapper.find('[data-testid="profile-translate-progress"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('hides every editing action and the off-CV zone in the translated view', async () => {
    const { wrapper } = await mountPage({ ...withTranslation(tr()), references: [] })
    const editing = [
      'profile-menu',
      'profile-edit',
      'profile-summary-edit',
      'profile-experience-menu',
      'profile-skills-edit',
      'profile-skills-menu',
      'profile-hobbies-edit',
      'profile-references-add',
      'profile-entry-actions',
      'profile-settings-open',
      'profile-off-cv'
    ]
    for (const id of editing) expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(true)

    await startTranslating(wrapper)
    for (const id of editing) expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
    // The cards and their content stay, read only.
    expect(wrapper.find('[data-testid="profile-references-empty"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="profile-experience"]').text()).toContain('Acme')
    wrapper.unmount()
  })

  it('keeps the Summary card open in the translated view when there is no summary', async () => {
    const { wrapper } = await mountPage({ ...withTranslation(), summary: null })
    expect(wrapper.find('[data-testid="profile-summary-empty"]').exists()).toBe(true)

    await startTranslating(wrapper)
    expect(wrapper.find('[data-testid="profile-summary-empty"]').exists()).toBe(false)
    expect(
      wrapper
        .get('[data-testid="profile-summary"]')
        .find('[data-testid="profile-translation"]')
        .exists()
    ).toBe(true)
    wrapper.unmount()
  })

  it('shows translation progress in the summary line, the tab badge and the bar', async () => {
    const { wrapper } = await mountPage(withTranslation(tr()))
    // Job title, the bullet and the BSc degree; only the bullet is translated.
    expect(wrapper.get('[data-testid="profile-settings-summary"]').text()).toBe(
      'Written in Norwegian · English: 1 of 3 translated'
    )
    expect(languageTabs(wrapper)[1]!.textContent?.trim()).toBe('English2')
    expect(wrapper.find('[data-testid="profile-settings-stale"]').exists()).toBe(false)

    await startTranslating(wrapper)
    expect(wrapper.get('[data-testid="profile-settings-summary"]').text()).toBe(
      'English: 1 of 3 translated'
    )
    const bar = wrapper.findAllComponents({ name: 'UProgress' })[0]!
    expect(bar.props('modelValue')).toBe(1)
    expect(bar.props('max')).toBe(3)
    wrapper.unmount()
  })

  it('counts outdated translations, and drops the badge when everything is translated', async () => {
    const done = {
      ...withTranslation(tr({ isStale: true })),
      experiences: [
        {
          ...withTranslation(tr({ isStale: true })).experiences[0]!,
          translations: [
            {
              id: 1,
              language: 'ENGLISH',
              title: 'Developer',
              sourceTitle: 'Utvikler',
              isMachine: false,
              isStale: false
            }
          ]
        }
      ],
      educations: [{ ...filledProfile.educations[0]!, degree: null, field: null }]
    }
    const { wrapper } = await mountPage(done)
    expect(wrapper.get('[data-testid="profile-settings-summary"]').text()).toBe(
      'Written in Norwegian · English: all 2 translated · 1 outdated'
    )
    expect(wrapper.get('[data-testid="profile-settings-stale"]').text()).toBe('· 1 outdated')
    expect(languageTabs(wrapper)[1]!.textContent?.trim()).toBe('English')
    wrapper.unmount()
  })

  it('disables the content language once a translation exists', async () => {
    const { wrapper } = await mountPage(withTranslation(tr()))
    await wrapper.get('[data-testid="profile-settings-open"]').trigger('click')
    await flushPromises()
    expect(contentLanguage(wrapper).props('disabled')).toBe(true)
    expect(document.body.textContent).toContain(
      'Delete all translations before changing the language the profile is written in.'
    )
    wrapper.unmount()
  })

  it('changes the content language and refetches', async () => {
    const { wrapper, requests } = await mountPage(withTranslation(), (body) =>
      body.query.includes('setProfileContentLanguage(')
        ? { setProfileContentLanguage: { profile: { contentLanguage: 'ENGLISH' }, errors: null } }
        : undefined
    )
    await wrapper.get('[data-testid="profile-settings-open"]').trigger('click')
    await flushPromises()
    expect(contentLanguage(wrapper).props('disabled')).toBe(false)
    contentLanguage(wrapper).vm.$emit('update:modelValue', 'ENGLISH')

    await vi.waitFor(() =>
      expect(
        requests.find((r) => r.query.includes('setProfileContentLanguage('))!.variables.input
      ).toEqual({ language: 'ENGLISH' })
    )
    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(2)
    )
    expect(wrapper.find('[data-testid="profile-settings"]').exists()).toBe(true)
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

describe('ProfilePage clearing sections', () => {
  const cleared = (profile: typeof filledProfile, over: Record<string, unknown>) => ({
    clearProfileSections: { profile: { ...profile, ...over }, errors: null }
  })
  const clearRequest = (requests: Request[]) =>
    requests.find((r) => r.query.includes('clearProfileSections('))

  it('clears one section after naming what goes, using the returned profile', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) =>
      body.query.includes('clearProfileSections(')
        ? cleared(profile, { experiences: [] })
        : undefined
    )
    await chooseAction(wrapper, '[data-testid="profile-experience-menu"]', 'Clear section…')
    expect(document.body.textContent).toContain(
      'This permanently deletes 1 experience, with their bullets and translations.'
    )
    expect(clearRequest(requests)).toBeUndefined()

    clickConfirm()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="profile-experience-empty"]').exists()).toBe(true)
    )
    expect(clearRequest(requests)!.variables.input).toEqual({ sections: ['EXPERIENCES'] })
    expect(wrapper.find('[data-testid="profile-experience-menu"]').exists()).toBe(false)
    expect(requests.filter((r) => r.query.includes('query Profile'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('clears all CV content from the header menu', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) =>
      body.query.includes('clearProfileSections(')
        ? cleared(profile, {
            headline: null,
            summary: null,
            hobbies: [],
            experiences: [],
            educations: [],
            certifications: [],
            projects: [],
            skills: [],
            languages: [],
            references: []
          })
        : undefined
    )
    await chooseAction(wrapper, '[data-testid="profile-menu"]', 'Clear CV content…')
    const details = document.body.querySelector('[data-testid="profile-clear-all-details"]')!
    expect(details.textContent).toContain('2 references')
    expect(details.textContent).toContain('Kept: your name')

    clickConfirm()
    await vi.waitFor(() => expect(clearRequest(requests)).toBeDefined())
    expect(clearRequest(requests)!.variables.input.sections).toHaveLength(9)
    expect(wrapper.get('[data-testid="profile-contact"]').text()).toContain('Ada Lovelace')
    wrapper.unmount()
  })

  it('keeps the profile and the confirmation when the API rejects the clear', async () => {
    const { wrapper } = await mountPage(filledProfile, (body) =>
      body.query.includes('clearProfileSections(')
        ? {
            clearProfileSections: {
              profile: null,
              errors: [{ __typename: 'InvalidProfileError', message: 'Nothing to clear' }]
            }
          }
        : undefined
    )
    await chooseAction(wrapper, '[data-testid="profile-skills-menu"]', 'Clear section…')
    clickConfirm()
    await flushPromises()

    expect(document.body.textContent).toContain('Clear Skills?')
    expect(wrapper.find('[data-testid="profile-skills-empty"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

// UTextarea puts the test id on its wrapper or the textarea, depending on the attribute.
const setText = (testid: string, value: string) => {
  const el = document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
  const textarea = el instanceof HTMLTextAreaElement ? el : el.querySelector('textarea')!
  textarea.value = value
  textarea.dispatchEvent(new Event('input'))
}

describe('ProfilePage address', () => {
  it('saves street and postcode together, sending a blank one as null', async () => {
    const { wrapper, requests } = await mountPage(filledProfile, (body, profile) => {
      if (!body.query.includes('updateProfileAddress(')) return undefined
      Object.assign(profile, body.variables.input)
      return { updateProfileAddress: { profile, errors: null } }
    })
    await wrapper.get('[data-testid="profile-address-empty"] button').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="address-town"]')!.textContent).toContain(
      'Oslo'
    )
    const street = document.body.querySelector<HTMLInputElement>(
      'input[data-testid="address-street"]'
    )!
    street.value = ' Storgata 1 '
    street.dispatchEvent(new Event('input'))
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-address"]').text()).toContain('Storgata 1')
    )
    expect(wrapper.get('[data-testid="profile-address"]').text()).toContain('Oslo')
    expect(
      requests.find((r) => r.query.includes('updateProfileAddress('))!.variables.input
    ).toEqual({ streetAddress: 'Storgata 1', postalCode: null })
    wrapper.unmount()
  })
})

describe('ProfilePage story', () => {
  it('saves all five story parts together, sending a blank one as null', async () => {
    const story = { ...emptyProfile.story, origin: 'Bergen', values: 'Calm' }
    const { wrapper, requests } = await mountPage({ ...filledProfile, story }, (body, profile) => {
      if (!body.query.includes('updateProfileStory(')) return undefined
      profile.story = body.variables.input
      return { updateProfileStory: { profile, errors: null } }
    })
    await wrapper.get('[data-testid="profile-story-edit"]').trigger('click')
    await flushPromises()
    setText('story-careerJourney', 'Started in support')
    setText('story-values', '  ')
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="profile-story"]').text()).toContain('Started in support')
    )
    expect(requests.find((r) => r.query.includes('updateProfileStory('))!.variables.input).toEqual({
      origin: 'Bergen',
      upbringing: null,
      careerJourney: 'Started in support',
      motivation: null,
      values: null
    })
    wrapper.unmount()
  })

  it('clears only the story from its section menu', async () => {
    const story = { ...emptyProfile.story, motivation: 'Shipping' }
    const { wrapper, requests } = await mountPage({ ...filledProfile, story }, (body, profile) =>
      body.query.includes('clearProfileSections(')
        ? {
            clearProfileSections: {
              profile: { ...profile, story: emptyProfile.story },
              errors: null
            }
          }
        : undefined
    )
    await chooseAction(wrapper, '[data-testid="profile-story-menu"]', 'Clear section…')
    expect(document.body.textContent).toContain('This permanently deletes your story')
    clickConfirm()

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="profile-story-empty"]').exists()).toBe(true)
    )
    expect(
      requests.find((r) => r.query.includes('clearProfileSections('))!.variables.input
    ).toEqual({ sections: ['STORY'] })
    wrapper.unmount()
  })
})

describe('ProfilePage writing samples', () => {
  const sample = (id: number, title = `Sample ${id}`) => ({
    id,
    title,
    text: 'Kjære rekrutterer',
    language: 'NORWEGIAN',
    kind: 'COVER_LETTER',
    updatedAt: '2026-10-01T10:00:00Z'
  })
  // The list fetches on its own once the profile has rendered it.
  const mountWithSamples = async (samples: ReturnType<typeof sample>[], respond?: Respond) => {
    clearNuxtData('writing-samples')
    const mounted = await mountPage(filledProfile, (body, profile) =>
      body.query.includes('query WritingSamples')
        ? { writingSamples: { nodes: samples } }
        : respond?.(body, profile)
    )
    await vi.waitFor(() =>
      expect(mounted.wrapper.get('[data-testid="profile-writing-samples"]').text()).toMatch(
        /\(\d+\/20\)/
      )
    )
    return mounted
  }

  it('adds a sample and lists it after the refetch', async () => {
    const samples = [sample(1)]
    const { wrapper, requests } = await mountWithSamples(samples, (body) => {
      if (!body.query.includes('addWritingSample(')) return undefined
      samples.push({ ...sample(2), ...body.variables.input })
      return { addWritingSample: { writingSample: { id: 2 }, errors: null } }
    })
    expect(wrapper.get('[data-testid="profile-writing-samples"]').text()).toContain(
      'Writing samples (1/20)'
    )
    await wrapper.get('[data-testid="profile-writing-samples-add"]').trigger('click')
    await flushPromises()
    setInput('writing-sample-title', 'Letter to Acme')
    setText('writing-sample-text', 'Dear Acme')
    await flushPromises()
    clickSave()

    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="profile-writing-sample"]')).toHaveLength(2)
    )
    expect(requests.find((r) => r.query.includes('addWritingSample('))!.variables.input).toEqual({
      title: 'Letter to Acme',
      text: 'Dear Acme',
      language: 'NORWEGIAN',
      kind: 'COVER_LETTER'
    })
    wrapper.unmount()
  })

  it('deletes a sample only after confirming', async () => {
    const samples = [sample(1), sample(2)]
    const { wrapper, requests } = await mountWithSamples(samples, (body) => {
      if (!body.query.includes('deleteWritingSample(')) return undefined
      samples.splice(0, 1)
      return { deleteWritingSample: { id: 1, errors: null } }
    })
    await chooseAction(wrapper, '[data-testid="profile-writing-sample-actions"]', 'Delete')
    expect(requests.some((r) => r.query.includes('deleteWritingSample('))).toBe(false)
    clickConfirm()

    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="profile-writing-sample"]')).toHaveLength(1)
    )
    expect(requests.find((r) => r.query.includes('deleteWritingSample('))!.variables.input).toEqual(
      { id: 1 }
    )
    wrapper.unmount()
  })

  it('stops offering Add at the 20-sample limit', async () => {
    const { wrapper } = await mountWithSamples(Array.from({ length: 20 }, (_, i) => sample(i + 1)))
    const card = wrapper.get('[data-testid="profile-writing-samples"]')
    expect(card.text()).toContain('Limit reached (20).')
    expect(card.find('[data-testid="profile-writing-samples-add"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an empty state explaining what samples are for', async () => {
    const { wrapper } = await mountWithSamples([])
    expect(wrapper.get('[data-testid="profile-writing-samples-empty"]').text()).toContain(
      'Samples in the language you apply in teach the AI your style best.'
    )
    wrapper.unmount()
  })
})
