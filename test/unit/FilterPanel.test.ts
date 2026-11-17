import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UIcon } from '#components'
import FilterPanel from '~/components/listings/FilterPanel.vue'
import { emptyFacets, type ListingsFacets } from '~/composables/useListingsList'

const mount = (facets: Partial<ListingsFacets>) =>
  mountSuspended(FilterPanel, {
    props: {
      facets: reactive({ ...emptyFacets(), ...facets }),
      search: '',
      quickCounts
    },
    attachTo: document.body
  })

const quickCounts = {
  preferred: 3,
  norway: 7,
  it: 5,
  nonIt: 6,
  englishPosting: 2,
  englishMentioned: 4
}

// The facet sheet is a slideover, teleported out of the wrapper.
const inSheet = (testid: string) => document.body.querySelector(`[data-testid="${testid}"]`)

describe('FilterPanel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows fields below Clear all on desktop and preserves them when switching to the sheet', async () => {
    let desktop = true
    const listeners = new Set<(event: { matches: boolean }) => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === '(min-width: 96rem)' ? desktop : true
      },
      media: query,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.delete(listener)
    }))
    const wrapper = await mount({ favorites: true })
    expect(
      wrapper.get('[data-testid="listings-facet-englishMentioned"] span.truncate').classes()
    ).toContain('flex-1')
    const inline = wrapper.get('[data-testid="listings-inline-filters"]')
    expect(wrapper.find('[data-testid="listings-filters-toggle"]').exists()).toBe(false)
    expect(
      wrapper
        .get('[data-testid="listings-filters-clear"]')
        .element.compareDocumentPosition(inline.element) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(inline.find('[data-testid="listings-facet-status"]').exists()).toBe(true)
    await inline.get('[data-testid="listings-facet-rejected"]').trigger('click')
    await wrapper.get('[data-testid="listings-filters-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="listings-active"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="listings-inline-filters"]').exists()).toBe(true)
    await wrapper.get('[data-testid="listings-facet-rejected"]').trigger('click')
    desktop = false
    listeners.forEach((listener) => listener({ matches: desktop }))
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="listings-inline-filters"]').exists()).toBe(false)
    )
    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() =>
      expect(inSheet('listings-facet-rejected')?.getAttribute('aria-checked')).toBe('true')
    )
    desktop = true
    listeners.forEach((listener) => listener({ matches: desktop }))
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="listings-inline-filters"]').exists()).toBe(true)
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('uses single scrollable rows on mobile and grids from tablet upwards', async () => {
    const wrapper = await mount({})
    expect(wrapper.find('[data-testid="listings-facet-preferred"]').exists()).toBe(false)
    for (const kind of ['filters', 'presets']) {
      const heading = wrapper.get(`#listing-${kind}-heading`)
      expect(heading.classes()).toEqual(['text-xs', 'font-medium', 'text-muted'])
      const group = wrapper.get(`[role="group"][aria-labelledby="listing-${kind}-heading"]`)
      expect(group.classes()).toEqual(
        expect.arrayContaining([
          'quick-filter-row',
          'flex',
          'gap-1.5',
          'overflow-x-auto',
          'md:grid',
          'md:overflow-visible',
          kind === 'filters' ? 'md:grid-cols-3' : 'md:grid-cols-4',
          '2xl:grid-cols-2'
        ])
      )
      for (const button of group.findAll('button')) {
        expect(button.classes()).toEqual(
          expect.arrayContaining(['w-auto', 'shrink-0', 'whitespace-nowrap', 'md:w-full'])
        )
        const label = button.get('span.text-left')
        expect(label.classes()).toContain('min-w-0')
        expect(label.classes()).toContain('truncate')
      }
    }
    wrapper.unmount()
  })

  it('fades each overflowing row until it reaches the right edge', async () => {
    const wrapper = await mount({})
    for (const kind of ['filters', 'presets']) {
      const group = wrapper.get(`[role="group"][aria-labelledby="listing-${kind}-heading"]`)
      Object.defineProperties(group.element, {
        clientWidth: { configurable: true, value: 320 },
        scrollWidth: { configurable: true, value: 800 }
      })
      await group.trigger('scroll')
      expect(group.classes()).toContain('has-more')
      group.element.scrollLeft = 480
      await group.trigger('scroll')
      expect(group.classes()).not.toContain('has-more')
      group.element.scrollLeft = 100
      await group.trigger('scroll')
      expect(group.classes()).toContain('has-more')
      Object.defineProperty(group.element, 'scrollWidth', { configurable: true, value: 320 })
      group.element.scrollLeft = 0
      await group.trigger('scroll')
      expect(group.classes()).not.toContain('has-more')
    }
    wrapper.unmount()
  })

  it('keeps relevant quick-filter icons visible when toggled', async () => {
    const wrapper = await mount({})
    const icons = {
      favorites: 'i-lucide-star',
      shortlist: 'i-lucide-bookmark',
      norway: 'i-lucide-map-pin',
      it: 'i-lucide-code-xml',
      nonIt: 'i-lucide-briefcase-business',
      englishPosting: 'i-lucide-file-text',
      englishMentioned: 'i-lucide-languages'
    }
    for (const [key, icon] of Object.entries(icons)) {
      const button = wrapper.get(`[data-testid="listings-facet-${key}"]`)
      const identifyingIcon = () =>
        button.findAllComponents(UIcon).find((item) => item.props('name') === icon)
      expect(identifyingIcon()?.attributes('aria-hidden')).toBe('true')
      await button.trigger('click')
      expect(button.attributes('aria-pressed')).toBe('true')
      expect(identifyingIcon()).toBeDefined()
      if (key === 'favorites' || key === 'shortlist') {
        expect(identifyingIcon()?.classes()).toContain('[&_*]:fill-current')
      } else {
        expect(
          button.findAllComponents(UIcon).some((item) => item.props('name') === 'i-lucide-check')
        ).toBe(true)
      }
      await button.trigger('click')
      expect(button.attributes('aria-pressed')).toBe('false')
      expect(identifyingIcon()).toBeDefined()
      expect(
        button.findAllComponents(UIcon).some((item) => item.props('name') === 'i-lucide-check')
      ).toBe(false)
    }
    wrapper.unmount()
  })

  it('labels the presets and keeps their identifying icons visible when selected', async () => {
    const wrapper = await mount({})
    expect(wrapper.get('h3#listing-presets-heading').text()).toBe('Quick presets')
    const icons = {
      itIdeal: 'i-lucide-code-xml',
      genericLocal: 'i-lucide-map-pin',
      genericIdeal: 'i-lucide-briefcase-business',
      remote: 'i-lucide-globe'
    }
    for (const [preset, icon] of Object.entries(icons)) {
      const button = wrapper.get(`[data-testid="listings-quick-${preset}"]`)
      expect(button.findAllComponents(UIcon).some((item) => item.props('name') === icon)).toBe(true)
      await button.trigger('click')
      expect(button.findAllComponents(UIcon).some((item) => item.props('name') === icon)).toBe(true)
      expect(
        button.findAllComponents(UIcon).some((item) => item.props('name') === 'i-lucide-check')
      ).toBe(true)
    }
    wrapper.unmount()
  })

  it('switches combined presets, removes conflicting facets, and toggles off', async () => {
    const facets = reactive({
      ...emptyFacets(),
      itRoles: true,
      norwayOnly: true,
      locationIds: [12]
    })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    await wrapper.get('[data-testid="listings-quick-genericLocal"]').trigger('click')
    expect(facets).toMatchObject({
      quickPreset: 'genericLocal',
      itRoles: false,
      norwayOnly: false,
      locationIds: []
    })
    const remote = wrapper.get('[data-testid="listings-quick-remote"]')
    await remote.trigger('click')
    expect(facets.quickPreset).toBe('remote')
    expect(remote.attributes('aria-pressed')).toBe('true')
    await remote.trigger('click')
    expect(facets.quickPreset).toBeNull()
    wrapper.unmount()
  })

  it('counts only the sheet facets on Filters and opens the sheet', async () => {
    const wrapper = await mount({ statuses: ['APPLIED'], favorites: true })
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('1')
    expect(inSheet('listings-facet-status')).toBeNull()

    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() => expect(inSheet('listings-facet-status')).not.toBeNull())
    wrapper.unmount()
  })

  it('shows a removable chip per active facet and clears all of them', async () => {
    const facets = reactive<ListingsFacets>({
      ...emptyFacets(),
      statuses: ['APPLIED'],
      dueWithinDays: 7,
      favorites: true
    })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    expect(wrapper.get('[data-testid="listings-chip-status"]').text()).toBe('Status: Applied')

    await wrapper.get('[data-testid="listings-chip-due"]').trigger('click')
    expect(facets.dueWithinDays).toBeNull()
    expect(facets.statuses).toEqual(['APPLIED'])

    await wrapper.get('[data-testid="listings-filters-clear"]').trigger('click')
    expect(facets).toEqual(emptyFacets())
    expect(wrapper.find('[data-testid="listings-active"]').exists()).toBe(false)
  })

  it('shows the company from a dashboard link as a chip, outside the sheet count', async () => {
    const facets = reactive<ListingsFacets>({ ...emptyFacets(), companyId: 12 })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts, companyName: 'Bekk' }
    })
    expect(wrapper.get('[data-testid="listings-chip-company"]').text()).toBe('Company: Bekk')
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).not.toContain('1')

    await wrapper.get('[data-testid="listings-chip-company"]').trigger('click')
    expect(facets.companyId).toBeNull()
  })

  it('shows rejected applications from the sheet, with a chip to hide them again', async () => {
    const facets = reactive(emptyFacets())
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts },
      attachTo: document.body
    })
    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() => expect(inSheet('listings-facet-rejected')).not.toBeNull())
    ;(inSheet('listings-facet-rejected') as HTMLElement).click()
    await vi.waitFor(() => expect(facets.showRejected).toBe(true))

    await wrapper.get('[data-testid="listings-chip-rejected"]').trigger('click')
    expect(facets.showRejected).toBe(false)
    wrapper.unmount()
  })

  it('toggles favorites from the toolbar', async () => {
    const facets = reactive(emptyFacets())
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    const button = wrapper.get('[data-testid="listings-facet-favorites"]')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(facets.favorites).toBe(true)
  })

  it('counts the posted range once and shows it as one chip', async () => {
    const wrapper = await mount({ postedFrom: '2026-10-01', postedTo: '2026-10-07' })
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toContain('1')
    expect(wrapper.findAll('[data-testid^="listings-chip-"]')).toHaveLength(1)

    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() => expect(inSheet('listings-facet-postedFrom')).not.toBeNull())
    const from = inSheet('listings-facet-postedFrom')!
    const input = from.matches('input') ? from : from.querySelector('input')!
    expect((input as HTMLInputElement).value).toBe('2026-10-01')
    wrapper.unmount()
  })

  it('toggles a pill, showing its count, without a chip or a Filters badge', async () => {
    const facets = reactive(emptyFacets())
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    const button = wrapper.get('[data-testid="listings-facet-norway"]')
    expect(button.text()).toContain('7')
    expect(button.attributes('aria-pressed')).toBe('false')

    await button.trigger('click')
    expect(facets.norwayOnly).toBe(true)
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="listings-chip-norway"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).not.toContain('1')
  })

  it('turns IT roles off when non-IT roles is turned on, and back', async () => {
    const facets = reactive({ ...emptyFacets(), itRoles: true })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts }
    })
    await wrapper.get('[data-testid="listings-facet-nonIt"]').trigger('click')
    expect(facets).toMatchObject({ nonItRoles: true, itRoles: false })
    await wrapper.get('[data-testid="listings-facet-it"]').trigger('click')
    expect(facets).toMatchObject({ nonItRoles: false, itRoles: true })
  })

  it('keeps the pills on when the sheet clears, and resets them with Clear all', async () => {
    const facets = reactive<ListingsFacets>({
      ...emptyFacets(),
      itRoles: true,
      norwayOnly: true,
      favorites: true,
      preferredLocations: true,
      statuses: ['APPLIED']
    })
    const wrapper = await mountSuspended(FilterPanel, {
      props: { facets, search: '', quickCounts },
      attachTo: document.body
    })
    await wrapper.get('[data-testid="listings-filters-toggle"]').trigger('click')
    await vi.waitFor(() => expect(inSheet('listings-sheet-clear')).not.toBeNull())
    ;(inSheet('listings-sheet-clear') as HTMLElement).click()
    expect(facets).toEqual({
      ...emptyFacets(),
      itRoles: true,
      norwayOnly: true,
      favorites: true,
      preferredLocations: true
    })

    await wrapper.get('[data-testid="listings-filters-clear"]').trigger('click')
    expect(facets).toEqual(emptyFacets())
    wrapper.unmount()
  })
})

it('opens Shortlist independently of Favorites and clears it with Clear all', async () => {
  const wrapper = await mount({})
  await wrapper.get('[data-testid="listings-facet-shortlist"]').trigger('click')
  expect(wrapper.props('facets').shortlist).toBe(true)
  expect(wrapper.props('facets').favorites).toBe(false)
  expect(wrapper.get('[data-testid="listings-filters-toggle"]').text()).toBe('Filters')
  await wrapper.get('[data-testid="listings-filters-clear"]').trigger('click')
  expect(wrapper.props('facets').shortlist).toBe(false)
  wrapper.unmount()
})
