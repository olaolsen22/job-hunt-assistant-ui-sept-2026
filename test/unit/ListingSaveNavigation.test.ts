import { describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import AddPage from '~/pages/listings/add.vue'
import EditPage from '~/pages/listings/[id]/edit.vue'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
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

    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/listings', { replace: true }))
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
})
