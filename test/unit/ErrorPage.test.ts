import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ErrorPage from '~/error.vue'

const { clearError } = vi.hoisted(() => ({ clearError: vi.fn() }))
mockNuxtImport('clearError', () => clearError)
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

describe('Error page', () => {
  it('names a missing page and leads back to the dashboard', async () => {
    const wrapper = await mountSuspended(ErrorPage, {
      props: { error: createError({ statusCode: 404 }) }
    })

    expect(wrapper.text()).toContain('Page not found')
    await wrapper.get('[data-testid="error-home"]').trigger('click')
    expect(clearError).toHaveBeenCalledWith({ redirect: '/' })
    wrapper.unmount()
  })

  it('says when the app is offline and retries the same page', async () => {
    clearError.mockClear()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const wrapper = await mountSuspended(ErrorPage, {
      route: '/listings/5',
      props: { error: createError({ statusCode: 500 }) }
    })
    await flushPromises()

    expect(wrapper.text()).toContain("You're offline")
    expect(wrapper.find('[data-testid="error-home"]').exists()).toBe(false)
    await wrapper.get('[data-testid="error-retry"]').trigger('click')
    expect(clearError).toHaveBeenCalledWith({ redirect: '/listings/5' })
    vi.restoreAllMocks()
    wrapper.unmount()
  })
})
