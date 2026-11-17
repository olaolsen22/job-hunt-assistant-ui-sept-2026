import { describe, expect, it, vi } from 'vitest'
import { createError, readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import AddPage from '~/pages/listings/add.vue'
import EditPage from '~/pages/listings/[id]/edit.vue'
import ListingForm from '~/components/listings/Form.vue'

const { navigateTo, toastAdd } = vi.hoisted(() => ({ navigateTo: vi.fn(), toastAdd: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
mockNuxtImport('useToast', () => () => ({ add: toastAdd, remove: vi.fn(), toasts: ref([]) }))
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

describe('Leaving a listing form after saving', () => {
  it('replaces the add form in history so Back does not reopen it', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: { createListing: { listing: { id: 7 }, previousAttempts: [], errors: null } }
      })
    })
    const wrapper = await mountSuspended(AddPage, { attachTo: document.body })
    await flushPromises()

    Object.assign(wrapper.vm.state, {
      title: 'Frontend Developer',
      companyName: 'Acme',
      jobRoleName: 'Developer',
      url: 'https://example.com/job'
    })
    wrapper.vm.confirmOpen = true
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('/listings/7', { replace: true })
    )
    wrapper.unmount()
  })

  it('hands possible duplicates over to the new listing page', async () => {
    const match = { id: 8, title: 'Frontend Developer', archivedAt: null }
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          createListing: {
            listing: { id: 7, title: 'Frontend Developer' },
            previousAttempts: [],
            possibleDuplicates: [match],
            errors: null
          }
        }
      })
    })
    const wrapper = await mountSuspended(AddPage, { attachTo: document.body })
    await flushPromises()

    Object.assign(wrapper.vm.state, {
      title: 'Frontend Developer',
      companyName: 'Acme',
      jobRoleName: 'Developer',
      url: 'https://example.com/job'
    })
    wrapper.vm.confirmOpen = true
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() =>
      expect(usePossibleDuplicates().value).toMatchObject({
        listing: { id: 7 },
        matches: [match]
      })
    )
    usePossibleDuplicates().value = null
    wrapper.unmount()
  })

  it('links to the existing listing in a toast when the ad URL is already saved', async () => {
    navigateTo.mockClear()
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          createListing: {
            listing: null,
            previousAttempts: null,
            errors: [
              {
                __typename: 'DuplicateListingError',
                message: 'A listing with this URL already exists (890).',
                existingListingId: 890
              }
            ]
          }
        }
      })
    })
    const wrapper = await mountSuspended(AddPage, { attachTo: document.body })
    await flushPromises()

    Object.assign(wrapper.vm.state, {
      title: 'Frontend Developer',
      companyName: 'Acme',
      jobRoleName: 'Developer',
      url: 'https://example.com/job'
    })
    wrapper.vm.confirmOpen = true
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'error',
          actions: [expect.objectContaining({ to: '/listings/890' })]
        })
      )
    )
    expect(wrapper.find('[data-testid="add-listing-error"]').exists()).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('replaces the edit form in history so Back goes to the list, not the form', async () => {
    navigateTo.mockClear()
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        return query.includes('UpdateListing')
          ? { data: { updateListing: { listing: { id: 5 }, errors: null } } }
          : { data: { listingById: null } }
      }
    })
    // The listing itself is not needed: the confirm modal sits outside the form.
    const wrapper = await mountSuspended(EditPage, {
      route: '/listings/5/edit',
      attachTo: document.body
    })
    await flushPromises()

    wrapper.vm.confirmOpen = true
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('/listings/5', { replace: true })
    )
    wrapper.unmount()
  })

  it('reads the listing again after saving, so the detail page is not stale', async () => {
    navigateTo.mockClear()
    let listingReads = 0
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        if (query.includes('UpdateListing')) {
          return { data: { updateListing: { listing: { id: 5 }, errors: null } } }
        }
        listingReads++
        return { data: { listingById: null } }
      }
    })
    const wrapper = await mountSuspended(EditPage, {
      route: '/listings/5/edit',
      attachTo: document.body
    })
    await flushPromises()
    const readsBeforeSave = listingReads

    wrapper.vm.confirmOpen = true
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalled())
    expect(listingReads).toBe(readsBeforeSave + 1)
    wrapper.unmount()
  })

  it('goes back to the detail page it was opened from instead of adding another entry', async () => {
    navigateTo.mockClear()
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        return query.includes('UpdateListing')
          ? { data: { updateListing: { listing: { id: 5 }, errors: null } } }
          : { data: { listingById: null } }
      }
    })
    const router = useRouter()
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    vi.spyOn(router.options.history, 'state', 'get').mockReturnValue({ back: '/listings/5' })
    const wrapper = await mountSuspended(EditPage, {
      route: '/listings/5/edit',
      attachTo: document.body
    })
    await flushPromises()

    wrapper.vm.confirmOpen = true
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-testid="confirm-modal-confirm"]')!.click()

    await vi.waitFor(() => expect(back).toHaveBeenCalled())
    expect(navigateTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps Back when the listing fails to load', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 500 })
      }
    })
    const wrapper = await mountSuspended(EditPage, { route: '/listings/1/edit' })

    // The installed app has no browser Back, so this is the only way out.
    await vi.waitFor(() => expect(wrapper.text()).toContain('Something went wrong'))
    // Back sits in the layout's navbar; the listing's header card needs a loaded listing.
    expect(useBackLinkState().value).toEqual({
      path: '/listings/1/edit',
      to: '/listings/1',
      label: 'Listing'
    })
    expect(wrapper.find('[data-testid="edit-listing-header"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="parse-open"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('Edit listing header', () => {
  it('shows the saved title in a desktop-sticky card, with Back in the navbar', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        if (!query.includes('listingById')) return { data: {} }
        return {
          data: {
            listingById: {
              id: 1,
              kind: 'VACANCY',
              title: 'Frontend Developer',
              company: { id: 3, name: 'Acme', applicationCount: 0, avoidedAt: null },
              jobRole: { name: 'Developer' },
              seniority: null,
              employmentType: null,
              schedule: null,
              workMode: null,
              description: null,
              originalDescription: null,
              url: 'https://example.com/job',
              postedOn: '2026-10-01',
              deadlineType: 'UNSPECIFIED',
              deadlineOn: null,
              dueOn: null,
              postingLanguage: null,
              favoritedAt: null,
              shortlistedAt: null,
              analyzedAt: null,
              reanalyzedAt: null,
              archivedAt: null,
              status: 'SAVED',
              statusHistory: [],
              interviews: [],
              applicationQuestions: [],
              documents: [],
              locations: [],
              languages: [],
              skills: [],
              contacts: []
            }
          }
        }
      }
    })
    const wrapper = await mountSuspended(EditPage, { route: '/listings/1/edit' })

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="edit-listing-header"]').exists()).toBe(true)
    )
    const header = wrapper.get('[data-testid="edit-listing-header"]')
    expect(header.classes()).toEqual(
      expect.arrayContaining(['lg:sticky', 'lg:top-0', 'rounded-lg', 'bg-default'])
    )
    expect(header.get('h1').text()).toBe('Frontend Developer')
    expect(header.text()).toContain('Acme')
    expect(header.find('[data-testid="parse-open"]').text()).toBe('Analyze ad')
    expect(useBackLinkState().value).toEqual({
      path: '/listings/1/edit',
      to: '/listings/1',
      label: 'Listing'
    })
    wrapper.unmount()
  })
})

describe('Wide listing form', () => {
  it('expands into two columns when requested by the edit page', async () => {
    const { state, validate } = useListingForm()
    const wrapper = await mountSuspended(ListingForm, {
      props: {
        modelValue: state,
        validate,
        submitLabel: 'Save changes',
        cancelTo: '/listings/5',
        wide: true,
        stickyActions: true
      }
    })
    expect(wrapper.classes()).toContain('2xl:max-w-none')
    expect(wrapper.classes()).toContain('2xl:grid-cols-2')
    const actions = wrapper.get('[data-testid="listing-form-actions"]')
    expect(actions.classes()).toEqual(
      expect.arrayContaining([
        'lg:sticky',
        'lg:bottom-0',
        'rounded-lg',
        'bg-default',
        '2xl:col-span-2'
      ])
    )
    expect(actions.text()).toContain('Cancel')
    expect(actions.text()).toContain('Save changes')
    await wrapper.setProps({ stickyActions: false })
    expect(wrapper.get('[data-testid="listing-form-actions"]').classes()).not.toContain('lg:sticky')
    wrapper.unmount()
  })
})
