import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ListingPage from '~/pages/listings/[id]/index.vue'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const listing = {
  id: 5,
  kind: 'VACANCY',
  title: 'Frontend Developer',
  company: { id: 3, name: 'Acme', applicationCount: 0, avoidedAt: null as string | null },
  jobRole: { name: 'Developer' },
  seniority: null,
  employmentType: null,
  schedule: null,
  workMode: null,
  description: null as string | null,
  originalDescription: null as string | null,
  url: 'https://example.com/job',
  postedOn: '2026-10-01',
  deadlineType: 'UNSPECIFIED',
  deadlineOn: null,
  dueOn: '2026-10-31',
  postingLanguage: null as string | null,
  favoritedAt: null,
  shortlistedAt: null,
  analyzedAt: null as string | null,
  reanalyzedAt: null as string | null,
  archivedAt: null,
  status: 'SAVED',
  statusHistory: [],
  interviews: [],
  applicationQuestions: [],
  documents: [],
  locations: [],
  languages: [],
  skills: [
    {
      skill: { id: 1, name: 'Vue', profileLevel: 3 as number | null },
      level: 4,
      minYears: null,
      isRequired: true
    },
    {
      skill: { id: 2, name: 'Docker', profileLevel: null },
      level: 2,
      minYears: null,
      isRequired: false
    }
  ],
  contacts: [] as { contact: Record<string, unknown> }[]
}

const compared = (id: number) => ({
  id,
  title: `Job ${id}`,
  url: `https://jobs.example/${id}`,
  postedOn: '2026-10-20',
  deadlineType: 'UNSPECIFIED' as const,
  deadlineOn: null,
  status: 'SAVED' as const,
  company: { name: 'Acme' },
  jobRole: { name: 'Developer' },
  locations: []
})

const queries: string[] = []
const mountPage = async (overrides: Partial<typeof listing> = {}) => {
  queries.length = 0
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      queries.push((await readBody(event)).query)
      return { data: { listingById: { ...listing, ...overrides } } }
    }
  })
  const wrapper = await mountSuspended(ListingPage, {
    route: '/listings/5',
    attachTo: document.body
  })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('[data-testid="listing-header"]').exists()).toBe(true))
  return wrapper
}

describe('Listing page', () => {
  it('puts Back to the remembered listings view in the navbar', async () => {
    useListingsView().value = '/listings?status=APPLIED'
    const wrapper = await mountPage()
    expect(useBackLinkState().value).toEqual({
      path: '/listings/5',
      to: '/listings?status=APPLIED',
      label: 'Listings'
    })
    useListingsView().value = '/listings'
    wrapper.unmount()
  })

  it.each(['SAVED', 'APPLIED'])(
    'shows one requirements card in the agreed %s order',
    async (status) => {
      const wrapper = await mountPage({ status })
      expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
        'false'
      )
      expect(wrapper.findAll('[data-testid="requirement-map-card"]')).toHaveLength(1)
      const text = wrapper.text()
      const requirements = text.indexOf('Requirements')
      const cv = text.indexOf('Tailored CV')
      expect(requirements).toBeLessThan(cv)
      expect(text.indexOf('Application')).toBeLessThan(requirements)
      const workspace = wrapper.get('[data-testid="listing-workspace"]')
      const details = wrapper.get('[data-testid="listing-details"]')
      expect(workspace.find('[data-testid="listing-header"]').exists()).toBe(true)
      expect(workspace.find('[data-testid="requirement-map-card"]').exists()).toBe(true)
      expect(workspace.text()).toContain('Tailored CV')
      expect(workspace.text()).not.toContain('Summary')
      expect(details.text()).toContain('Summary')
      expect(details.text()).toContain('Skills')
      expect(details.find('[data-testid="requirement-map-card"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="listing-columns"]').classes()).toContain('2xl:grid-cols-2')
      expect(
        wrapper
          .get('[data-testid="listing-columns"]')
          .element.parentElement?.classList.contains('2xl:max-w-none')
      ).toBe(true)
      expect(wrapper.find('[data-testid="listing-more"]').exists()).toBe(true)
      expect(text).toContain('Analyze ad')
      wrapper.unmount()
    }
  )

  it('shows the position share only when the ad states one', async () => {
    const stated = await mountPage({ positionPercent: 80 } as Partial<typeof listing>)
    expect(stated.get('[data-testid="listing-key-facts"]').text()).toContain('80%')
    stated.unmount()

    const silent = await mountPage()
    expect(silent.get('[data-testid="listing-key-facts"]').text()).not.toContain('Position')
    silent.unmount()
  })

  describe('possible duplicates from the add page', () => {
    afterEach(() => {
      usePossibleDuplicates().value = null
      navigateTo.mockReset()
    })
    const pending = (listingId = 5) => {
      usePossibleDuplicates().value = { listing: compared(listingId), matches: [compared(8)] }
    }

    it('stays until the owner keeps both', async () => {
      pending()
      const wrapper = await mountPage()
      const notice = wrapper.get('[data-testid="listing-duplicates"]')
      expect(notice.text()).toContain('Job 8')
      await notice
        .findAll('button')
        .find((b) => b.text() === 'Keep both')!
        .trigger('click')
      expect(wrapper.find('[data-testid="listing-duplicates"]').exists()).toBe(false)
      expect(usePossibleDuplicates().value).toBeNull()
      wrapper.unmount()
    })

    it('only shows on the listing it is about', async () => {
      pending(99)
      const wrapper = await mountPage()
      expect(wrapper.find('[data-testid="listing-duplicates"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('removes the new listing after confirming, then leaves its page', async () => {
      pending()
      const wrapper = await mountPage()
      const deleted: unknown[] = []
      registerEndpoint('/graphql', {
        method: 'POST',
        handler: async (event) => {
          const { query, variables } = await readBody(event)
          if (query.includes('mutation DeleteListing')) {
            deleted.push(variables.id)
            return { data: { deleteListing: { errors: null } } }
          }
          return { data: { listingById: listing } }
        }
      })
      await wrapper.get('[data-testid="listing-remove-duplicate"]').trigger('click')
      await flushPromises()
      expect(deleted).toEqual([])
      document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()
      await vi.waitFor(() => expect(navigateTo).toHaveBeenCalled())
      expect(deleted).toEqual([5])
      expect(usePossibleDuplicates().value).toBeNull()
      wrapper.unmount()
    })
  })

  // The CV card, its reset and the Apply modal all read one draft; they used to fetch it each.
  it('fetches the tailored CV draft once', async () => {
    const wrapper = await mountPage()
    await flushPromises()
    expect(queries.filter((q) => q.includes('query TailoredCvDraft('))).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows the listing type only when it is not a vacancy', async () => {
    const vacancy = await mountPage()
    expect(vacancy.find('[data-testid="listing-kind"]').exists()).toBe(false)
    vacancy.unmount()

    const invitation = await mountPage({ kind: 'OPEN_INVITATION' })
    expect(invitation.get('[data-testid="listing-kind"]').text()).toBe('Open invitation')
    invitation.unmount()
  })

  it('shows the title and status badges in the workspace header', async () => {
    const wrapper = await mountPage()
    const header = wrapper.get('[data-testid="listing-header"]')

    expect(header.text()).toContain('Frontend Developer')
    expect(header.get('[data-testid="listing-status"]').text()).toBe('Saved')
    expect(header.get('[data-testid="listing-analyzed"]').text()).toBe('To analyze')
    expect(header.find('[data-testid="company-avoided"]').exists()).toBe(false)
    expect(header.get('[data-testid="listing-company"]').attributes('href')).toBe('/companies/3')
    wrapper.unmount()
  })

  it('shows the analysis date on the badge once the listing is analyzed', async () => {
    const wrapper = await mountPage({ analyzedAt: '2026-10-12T12:00:00Z' })

    expect(wrapper.get('[data-testid="listing-analyzed"]').text()).toMatch(/^Analyzed · .*2026/)
    wrapper.unmount()
  })

  it('shows the latest re-analysis date instead of the first analysis', async () => {
    const wrapper = await mountPage({
      analyzedAt: '2026-09-01T12:00:00Z',
      reanalyzedAt: '2026-10-12T12:00:00Z'
    })

    expect(wrapper.get('[data-testid="listing-analyzed"]').text()).toMatch(/^Re-analyzed · .*2026/)
    wrapper.unmount()
  })

  it('records the application from the Application card, not the header', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="listing-record-application"]').exists()).toBe(false)
    expect(
      wrapper.get('[data-testid="listing-header"]').find('[data-testid="listing-apply"]').exists()
    ).toBe(false)

    await wrapper.get('[data-testid="listing-apply"]').trigger('click')
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Apply through the original ad')
    )
    expect(
      document.body.querySelector('[data-testid="confirm-modal-confirm"]')?.textContent
    ).toContain('Record application')
    wrapper.unmount()
  })

  it('badges a listing whose company is avoided', async () => {
    const wrapper = await mountPage({
      company: { ...listing.company, avoidedAt: '2026-10-07T10:00:00Z' }
    })

    expect(wrapper.get('[data-testid="company-avoided"]').text()).toBe('Avoided company')
    wrapper.unmount()
  })

  it('offers Mark analyzed and Archive in the More menu for an unanalyzed listing', async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="listing-more"]').trigger('click')
    await flushPromises()

    const menu = document.body.textContent
    expect(menu).toContain('Mark analyzed')
    expect(menu).toContain('Archive')
    wrapper.unmount()
  })

  it('lists only the sent documents on the Applied row', async () => {
    const wrapper = await mountPage({
      status: 'APPLIED',
      statusHistory: [
        { id: 1, status: 'APPLIED', occurredAt: '2026-10-14T10:00:00Z', note: null }
      ] as unknown as typeof listing.statusHistory,
      documents: [
        { id: 1, kind: 'CV', fileName: 'cv.pdf', createdAt: '2026-10-13T10:00:00Z', sentAt: null },
        {
          id: 2,
          kind: 'COVER_LETTER',
          fileName: 'letter.pdf',
          createdAt: '2026-10-13T10:00:00Z',
          sentAt: '2026-10-14T10:00:00Z'
        }
      ] as unknown as typeof listing.documents
    })

    const documents = wrapper.get('[data-testid="listing-documents"]').text()
    expect(documents).toContain('letter.pdf')
    expect(documents).not.toContain('cv.pdf')
    wrapper.unmount()
  })

  it('archives a finished application from the card', async () => {
    const wrapper = await mountPage({
      status: 'REJECTED',
      statusHistory: [
        { id: 1, status: 'APPLIED', occurredAt: '2026-10-14T10:00:00Z', note: null },
        { id: 2, status: 'REJECTED', occurredAt: '2026-10-20T10:00:00Z', note: null }
      ] as unknown as typeof listing.statusHistory
    })
    const inputs: Record<string, unknown>[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (query.includes('mutation')) {
          inputs.push(variables)
          return { data: { setListingArchived: { listing: { id: 5 }, errors: null } } }
        }
        return { data: { listingById: listing } }
      }
    })

    await wrapper.get('[data-testid="application-archive"]').trigger('click')
    await vi.waitFor(() => expect(inputs).toHaveLength(1))
    expect(inputs[0]).toEqual({ input: { id: 5, isArchived: true } })
    await vi.waitFor(() => expect(useToast().toasts.value.at(-1)?.title).toBe('Archived'))
    wrapper.unmount()
  })

  it('groups skills into Required and Nice to have', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()

    expect(text.indexOf('Required')).toBeLessThan(text.indexOf('Vue'))
    expect(text.indexOf('Vue')).toBeLessThan(text.indexOf('Nice to have'))
    expect(text.indexOf('Nice to have')).toBeLessThan(text.indexOf('Docker'))
    wrapper.unmount()
  })

  it('shows the linked contacts', async () => {
    const wrapper = await mountPage({
      contacts: [
        {
          contact: {
            id: 5,
            name: 'Kari Nordmann',
            title: 'Recruiter',
            email: null,
            phone: '+47 123',
            url: null,
            notes: null
          }
        }
      ]
    })

    const contact = wrapper.get('[data-testid="contact"]')
    expect(contact.text()).toContain('Kari Nordmann')
    expect(contact.find('a[href="tel:+47 123"]').exists()).toBe(true)
    expect(contact.find('[data-testid="contact-edit"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('Listing skills on the profile', () => {
  type Request = { query: string; variables: { input?: Record<string, unknown> } }

  const profile = {
    experiences: [
      {
        id: 10,
        employer: 'Acme',
        title: 'Developer',
        skills: [{ id: 1, name: 'Vue', translations: [] }]
      },
      { id: 11, employer: 'Globex', title: 'Engineer', skills: [] }
    ],
    projects: [{ id: 20, name: 'Side project', skills: [] }]
  }

  const mountWithProfile = async () => {
    const requests: Request[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const body: Request = await readBody(event)
        requests.push(body)
        if (body.query.includes('addSkillToProfile('))
          return {
            data: {
              addSkillToProfile: { profileSkill: { level: 2, skill: { id: 2 } }, errors: null }
            }
          }
        if (body.query.includes('query Profile')) return { data: { profile } }
        return { data: { listingById: listing } }
      }
    })
    clearNuxtData('profile')
    const wrapper = await mountSuspended(ListingPage, {
      route: '/listings/5',
      attachTo: document.body
    })
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="listing-header"]').exists()).toBe(true)
    )
    return { wrapper, requests }
  }

  const skillRow = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, name: string) =>
    wrapper.findAll('[data-testid="listing-skill"]').find((row) => row.text().includes(name))!

  const checkbox = (label: string) =>
    document.body.querySelector<HTMLButtonElement>(`[role="checkbox"][aria-label="${label}"]`)!

  const clickSave = () =>
    document.body.querySelector<HTMLButtonElement>('[data-testid="form-modal-save"]')!.click()

  it('marks skills on the profile and offers to add the others', async () => {
    const { wrapper } = await mountWithProfile()

    expect(skillRow(wrapper, 'Vue').text()).toContain('On your profile')
    expect(skillRow(wrapper, 'Vue').text()).toContain('You: 3/5')
    expect(skillRow(wrapper, 'Docker').text()).toContain('Add to profile')
    expect(skillRow(wrapper, 'Docker').text()).not.toContain('On your profile')
    wrapper.unmount()
  })

  it('adds a missing skill at the listing level, tagged on the ticked entries', async () => {
    const { wrapper, requests } = await mountWithProfile()
    await skillRow(wrapper, 'Docker').get('button').trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Add Docker to profile'))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Side project'))

    clickSave()
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Tick at least one experience or project.')
    )
    expect(requests.some((r) => r.query.includes('addSkillToProfile('))).toBe(false)

    checkbox('Side project').click()
    await flushPromises()
    const listingLoads = requests.filter((r) => r.query.includes('ListingById')).length
    clickSave()
    await vi.waitFor(() =>
      expect(requests.find((r) => r.query.includes('addSkillToProfile('))?.variables.input).toEqual(
        {
          skillId: 2,
          level: 2,
          experienceIds: [],
          projectIds: [20]
        }
      )
    )
    await vi.waitFor(() =>
      expect(requests.filter((r) => r.query.includes('ListingById')).length).toBeGreaterThan(
        listingLoads
      )
    )
    wrapper.unmount()
  })

  it('keeps already-tagged entries ticked so an owned skill can change only its level', async () => {
    const { wrapper, requests } = await mountWithProfile()
    await skillRow(wrapper, 'Vue')
      .get('button[aria-label="Edit Vue on your profile"]')
      .trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Edit Vue on profile'))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Already tagged'))

    expect(checkbox('Acme').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('Acme').disabled).toBe(true)

    clickSave()
    await vi.waitFor(() =>
      expect(requests.find((r) => r.query.includes('addSkillToProfile('))?.variables.input).toEqual(
        {
          skillId: 1,
          level: 3,
          experienceIds: [10],
          projectIds: []
        }
      )
    )
    wrapper.unmount()
  })

  describe('summary language switch', () => {
    const switchOf = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
      wrapper.find('[data-testid="listing-description-language"]')
    const summary = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
      wrapper.get('[data-testid="listing-description-text"]')

    it('shows the English summary alone when there is no original', async () => {
      const wrapper = await mountPage({
        description: 'Build Vue apps.',
        postingLanguage: 'ENGLISH'
      })
      expect(switchOf(wrapper).exists()).toBe(false)
      expect(summary(wrapper).text()).toBe('Build Vue apps.')
      expect(summary(wrapper).attributes('lang')).toBe('en')
      wrapper.unmount()
    })

    it('hides the switch when the original is only whitespace', async () => {
      const wrapper = await mountPage({
        description: 'Build Vue apps.',
        originalDescription: '  ',
        postingLanguage: 'NORWEGIAN'
      })
      expect(switchOf(wrapper).exists()).toBe(false)
      expect(summary(wrapper).text()).toBe('Build Vue apps.')
      wrapper.unmount()
    })

    it('switches between the English and the Norwegian summary', async () => {
      const wrapper = await mountPage({
        description: 'Build Vue apps.',
        originalDescription: 'Bygg Vue-apper.',
        postingLanguage: 'NORWEGIAN'
      })
      const tabs = switchOf(wrapper).findAll('[role="tab"]')
      expect(tabs.map((t) => t.text())).toEqual(['English', 'Norwegian'])
      expect(summary(wrapper).text()).toBe('Build Vue apps.')
      expect(summary(wrapper).attributes('lang')).toBe('en')

      await tabs[1]!.trigger('mousedown', { button: 0 })
      await vi.waitFor(() => expect(summary(wrapper).text()).toBe('Bygg Vue-apper.'))
      expect(summary(wrapper).attributes('lang')).toBe('nb')

      await tabs[0]!.trigger('mousedown', { button: 0 })
      await vi.waitFor(() => expect(summary(wrapper).text()).toBe('Build Vue apps.'))
      expect(summary(wrapper).attributes('lang')).toBe('en')
      wrapper.unmount()
    })

    it('does not clamp the summary on the full listing page', async () => {
      const wrapper = await mountPage({ description: 'Build Vue apps.' })
      expect(summary(wrapper).classes()).not.toContain('line-clamp-12')
      expect(wrapper.find('[data-testid="listing-description-toggle"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
