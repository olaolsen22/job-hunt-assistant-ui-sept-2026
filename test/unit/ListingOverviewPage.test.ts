import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import OverviewPage from '~/pages/listings/v2/[id].vue'
import type { ListingOverview } from '~/composables/useListingOverview'
import type { SavedRequirementMap } from '~/composables/useRequirementMap'
import { requirementNeed, savedRequirementMap } from '../fixtures/requirementMap'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const dateIn = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}
const instantIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

const baseListing = (): ListingOverview => ({
  id: 5,
  kind: 'VACANCY',
  title: 'Senior Frontend Developer',
  status: 'APPLIED',
  statusChangedAt: '2026-11-02T09:00:00Z',
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  analyzedAt: null,
  reanalyzedAt: null,
  favoritedAt: '2026-11-01T10:00:00Z',
  archivedAt: null,
  url: 'https://jobs.example/5',
  description: 'Build Vue applications.',
  originalDescription: null,
  postingLanguage: 'ENGLISH',
  seniority: null,
  employmentType: 'PERMANENT',
  schedule: 'PART_TIME',
  positionPercent: 80,
  workMode: 'HYBRID',
  postedOn: dateIn(-3),
  deadlineType: 'DATE',
  deadlineOn: dateIn(10),
  dueOn: dateIn(10),
  jobRole: { name: 'Developer', category: null },
  company: {
    id: 3,
    name: 'Acme',
    industry: { name: 'Software' },
    kind: 'PRODUCT',
    sizeBand: 'MEDIUM',
    foundedYear: 2009,
    description: null,
    websiteUrl: 'https://acme.example',
    careersUrl: null,
    linkedInUrl: null,
    orgNumber: '123456789',
    favoritedAt: null,
    avoidedAt: null,
    listingCount: 4,
    applicationCount: 1
  },
  locations: [
    { location: { id: 1, city: 'Oslo', countryCode: 'NO', isTarget: true } },
    { location: { id: 2, city: 'Bergen', countryCode: 'NO', isTarget: false } }
  ],
  trainingProgram: null,
  skills: [
    { skill: { id: 2, name: 'Docker' }, level: 2, minYears: null, isRequired: false },
    { skill: { id: 1, name: 'Vue' }, level: 4, minYears: 3, isRequired: true }
  ],
  languages: [{ language: 'NORWEGIAN', level: 'B2', isRequired: true }],
  statusHistory: [],
  interviews: [],
  applicationQuestions: [],
  documents: [],
  contacts: []
})

let listing: ListingOverview | null
let map: SavedRequirementMap | null
let listingFails: boolean
let queries: string[]

registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const { query } = await readBody(event)
    queries.push(query)
    if (query.includes('query ListingOverview('))
      return listingFails
        ? { errors: [{ message: 'Listing service unavailable' }] }
        : { data: { listingById: listing } }
    if (query.includes('query RequirementMap(')) return { data: { requirementMap: map } }
    return { data: null }
  }
})

const reset = (overrides: Partial<ListingOverview> = {}) => {
  listing = { ...baseListing(), ...overrides }
  map = null
  listingFails = false
  queries = []
}
reset()

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const mountPage = async () => {
  wrapper = await mountSuspended(OverviewPage, { route: '/listings/v2/5' })
  await flushPromises()
  return wrapper
}
const text = (testid: string) => wrapper!.find(`[data-testid="${testid}"]`).text()
const all = (testid: string) => wrapper!.findAll(`[data-testid="${testid}"]`).map((e) => e.text())
const has = (testid: string) => wrapper!.find(`[data-testid="${testid}"]`).exists()

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  reset()
})

describe('listing overview (v2)', () => {
  it('puts Back to the remembered listings view in the navbar', async () => {
    useListingsView().value = '/listings?status=APPLIED'
    await mountPage()
    expect(useBackLinkState().value).toEqual({
      path: '/listings/v2/5',
      to: '/listings?status=APPLIED',
      label: 'Listings'
    })
    useListingsView().value = '/listings'
  })

  it('starts the listing and requirement map requests together', async () => {
    await mountPage()
    expect(queries.some((q) => q.includes('query ListingOverview('))).toBe(true)
    expect(queries.some((q) => q.includes('query RequirementMap('))).toBe(true)
  })

  it('shows the header with badges, deadline and posting link', async () => {
    await mountPage()
    expect(text('overview-title')).toBe('Senior Frontend Developer')
    expect(text('overview-badges')).toContain('Applied')
    expect(text('overview-badges')).toContain('Favorite')
    expect(wrapper!.find('[data-testid="overview-posting-link"]').attributes('href')).toBe(
      'https://jobs.example/5'
    )
    expect(text('overview-deadline')).toContain('10 days left')
  })

  it('marks a deadline two days away with the list urgency colour', async () => {
    reset({ deadlineOn: dateIn(2), dueOn: dateIn(2) })
    await mountPage()
    const deadline = wrapper!.find('[data-testid="overview-deadline"]')
    expect(deadline.text()).toContain('2 days left')
    expect(deadline.classes().join(' ')).toContain('text-orange')
  })

  it('shows an ASAP deadline as an estimate and hides a missing posting link', async () => {
    reset({ deadlineType: 'ASAP', deadlineOn: null, dueOn: dateIn(5), url: null })
    await mountPage()
    expect(text('overview-deadline')).toContain('ASAP')
    expect(text('overview-deadline')).toContain('~')
    expect(has('overview-posting-link')).toBe(false)
  })

  it('shows only the facts that are set, with target locations marked', async () => {
    await mountPage()
    expect(text('fact-locations')).toContain('Oslo, Norway')
    expect(text('fact-locations')).toContain('Target')
    expect(text('fact-schedule')).toBe('Part time, 80 %')
    expect(text('fact-work-mode')).toBe('Hybrid')
    expect(has('fact-seniority')).toBe(false)
    expect(text('overview-facts')).not.toContain('Not stated')
  })

  it('keeps an archived listing visible with a notice', async () => {
    reset({ archivedAt: '2026-11-05T10:00:00Z' })
    await mountPage()
    expect(has('overview-archived')).toBe(true)
    expect(text('overview-badges')).toContain('Archived')
    expect(text('overview-title')).toBe('Senior Frontend Developer')
  })

  it('shows a training program only when the listing has one', async () => {
    await mountPage()
    expect(has('overview-training')).toBe(false)
    wrapper!.unmount()

    reset({
      trainingProgram: {
        endCompany: { name: 'Bank AS' },
        startsOn: null,
        endsOn: null,
        isPaid: true,
        jobOffer: 'GUARANTEED'
      }
    })
    await mountPage()
    expect(text('overview-training')).toContain('Paid')
    expect(text('overview-training')).toContain('Job guaranteed')
  })

  it('lists saved requirement needs with gaps first and a summary', async () => {
    map = savedRequirementMap([
      requirementNeed({ text: 'Vue 3' }),
      requirementNeed({ text: 'GraphQL', match: 'GAP' }),
      requirementNeed({ text: 'Testing' }),
      requirementNeed({ text: 'Accessibility', match: 'PARTIAL' }),
      requirementNeed({ text: 'TypeScript' }),
      requirementNeed({ text: 'Mentoring', importance: 'PREFERRED', match: 'GAP' })
    ])
    await mountPage()
    const needs = all('requirement-need')
    expect(needs[0]).toContain('GraphQL')
    expect(needs[0]).toContain('Gap')
    expect(needs[1]).toContain('Accessibility')
    expect(needs.at(-1)).toContain('Mentoring')
    expect(text('requirements-summary-REQUIRED')).toBe('1 gap, 1 partial, 3 evidenced')
    expect(has('requirements-stale')).toBe(false)
  })

  it('warns when the listing changed after the map was saved', async () => {
    reset({ updatedAt: '2026-11-10T10:00:00Z' })
    map = savedRequirementMap()
    await mountPage()
    expect(has('requirements-stale')).toBe(true)
  })

  it('falls back to the skill and language list without a map', async () => {
    await mountPage()
    expect(has('requirements-no-map')).toBe(true)
    expect(all('requirements-skill')).toEqual([
      'Vue · Level 4 of 5 · 3+ years · Must-have',
      'Docker · Level 2 of 5 · Nice-to-have'
    ])
    expect(all('requirements-language')).toEqual(['Norwegian · B2 · Must-have'])
  })

  it('says requirements were not extracted for a never-analyzed listing', async () => {
    reset({ skills: [], languages: [] })
    await mountPage()
    expect(text('requirements-empty')).toContain('No requirements extracted yet')
  })

  it('points to the posting when no description is saved', async () => {
    reset({ description: null })
    await mountPage()
    const empty = wrapper!.find('[data-testid="overview-no-description"]')
    expect(empty.text()).toContain('No description saved')
    expect(empty.find('a').attributes('href')).toBe('https://jobs.example/5')
  })

  describe('about the role', () => {
    const summary = () => wrapper!.get('[data-testid="listing-description-text"]')
    const tabs = () =>
      wrapper!.findAll(
        '[data-testid="overview-description"] [data-testid="listing-description-language"] [role="tab"]'
      )

    it('shows the English summary without a switch when there is no original', async () => {
      await mountPage()
      expect(has('listing-description-language')).toBe(false)
      expect(summary().text()).toBe('Build Vue applications.')
      expect(summary().attributes('lang')).toBe('en')
    })

    it('marks the English summary of a Norwegian ad as English', async () => {
      reset({ postingLanguage: 'NORWEGIAN' })
      await mountPage()
      expect(has('listing-description-language')).toBe(false)
      expect(summary().attributes('lang')).toBe('en')
    })

    it('switches to the Norwegian summary from the card header', async () => {
      reset({ postingLanguage: 'NORWEGIAN', originalDescription: 'Bygg Vue-applikasjoner.' })
      await mountPage()
      expect(tabs().map((t) => t.text())).toEqual(['English', 'Norwegian'])
      expect(summary().text()).toBe('Build Vue applications.')

      await tabs()[1]!.trigger('mousedown', { button: 0 })
      await vi.waitFor(() => expect(summary().text()).toBe('Bygg Vue-applikasjoner.'))
      expect(summary().attributes('lang')).toBe('nb')
    })

    it('hides the switch when only an original exists, showing the empty state', async () => {
      reset({ description: null, postingLanguage: 'NORWEGIAN', originalDescription: 'Bygg.' })
      await mountPage()
      expect(has('listing-description-language')).toBe(false)
      expect(has('overview-no-description')).toBe(true)
    })

    describe('clamp', () => {
      afterEach(() => vi.restoreAllMocks())
      // happy-dom has no layout, so pretend the 12-line box hides text (or not).
      const overflow = (hidden: boolean) => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(hidden ? 600 : 100)
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
      }

      it('clamps a long summary and toggles it open and closed', async () => {
        overflow(true)
        await mountPage()
        expect(summary().classes()).toContain('line-clamp-12')
        await vi.waitFor(() => expect(has('listing-description-toggle')).toBe(true))
        const toggle = () => wrapper!.get('[data-testid="listing-description-toggle"]')
        expect(toggle().text()).toBe('Show full description')
        expect(toggle().attributes('aria-expanded')).toBe('false')

        await toggle().trigger('click')
        expect(summary().classes()).not.toContain('line-clamp-12')
        expect(toggle().text()).toBe('Show less')
        expect(toggle().attributes('aria-expanded')).toBe('true')

        await toggle().trigger('click')
        expect(summary().classes()).toContain('line-clamp-12')
      })

      it('shows no toggle when the summary fits', async () => {
        overflow(false)
        await mountPage()
        await flushPromises()
        expect(summary().classes()).toContain('line-clamp-12')
        expect(has('listing-description-toggle')).toBe(false)
      })

      it('measures again after switching to a longer original', async () => {
        reset({ postingLanguage: 'NORWEGIAN', originalDescription: 'Bygg Vue-applikasjoner.' })
        const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100)
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
        await mountPage()
        await flushPromises()
        expect(has('listing-description-toggle')).toBe(false)

        scroll.mockReturnValue(600)
        await tabs()[1]!.trigger('mousedown', { button: 0 })
        await vi.waitFor(() => expect(has('listing-description-toggle')).toBe(true))
      })

      it('drops the toggle when collapsing after switching to a short original while open', async () => {
        reset({ postingLanguage: 'NORWEGIAN', originalDescription: 'Bygg Vue-applikasjoner.' })
        const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(600)
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
        await mountPage()
        await vi.waitFor(() => expect(has('listing-description-toggle')).toBe(true))
        await wrapper!.get('[data-testid="listing-description-toggle"]').trigger('click')

        scroll.mockReturnValue(100)
        await tabs()[1]!.trigger('mousedown', { button: 0 })
        await vi.waitFor(() => expect(summary().text()).toBe('Bygg Vue-applikasjoner.'))
        await wrapper!.get('[data-testid="listing-description-toggle"]').trigger('click')
        await vi.waitFor(() => expect(has('listing-description-toggle')).toBe(false))
      })
    })
  })

  it('lists upcoming interviews first and unanswered questions', async () => {
    reset({
      interviews: [
        { id: 1, title: 'Screening', scheduledAt: instantIn(-5), notes: null },
        { id: 2, title: 'Technical', scheduledAt: instantIn(3), notes: null }
      ],
      applicationQuestions: [
        { id: 1, question: 'Why us?', charLimit: 500, answer: null, notes: null }
      ]
    })
    await mountPage()
    const interviews = all('overview-interview')
    expect(interviews[0]).toContain('Technical')
    expect(interviews[1]).toContain('Screening')
    expect(text('overview-question')).toContain('Not answered yet')
    expect(text('overview-progress')).toContain('No status changes yet')
  })

  it('shows sent documents and hides empty contacts', async () => {
    reset({
      documents: [
        {
          id: 1,
          kind: 'CV',
          fileName: 'cv-acme.pdf',
          sizeBytes: 120_000,
          createdAt: '2026-12-01T10:00:00Z',
          sentAt: '2026-12-03T10:00:00Z',
          origin: 'TAILORED',
          baseCvVersion: null
        }
      ]
    })
    await mountPage()
    expect(text('overview-document')).toContain('Tailored for this listing')
    expect(text('overview-document')).toContain('Sent')
    expect(has('overview-contacts')).toBe(false)
  })

  it('leaves out record dates that are not set', async () => {
    await mountPage()
    expect(text('overview-record-dates')).toContain('Created')
    expect(text('overview-record-dates')).not.toContain('Analyzed')
  })

  it('shows not found for a missing listing', async () => {
    listing = null
    await mountPage()
    expect(has('overview-not-found')).toBe(true)
  })

  it('shows the error and reloads on Try again', async () => {
    listingFails = true
    await mountPage()
    expect(text('overview-error')).toContain('Listing service unavailable')

    listingFails = false
    const retry = wrapper!
      .findAll('[data-testid="overview-error"] button')
      .find((b) => b.text() === 'Try again')!
    await retry.trigger('click')
    await vi.waitFor(() => expect(has('overview-title')).toBe(true))
    expect(queries.filter((q) => q.includes('query ListingOverview(')).length).toBe(2)
  })
})
