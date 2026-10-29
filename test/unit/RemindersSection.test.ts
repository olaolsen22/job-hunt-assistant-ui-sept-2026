import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RemindersSection from '~/components/settings/RemindersSection.vue'

// The installed Android app: service worker, background sync and notifications all allowed.
const stubInstalledApp = (reply: unknown) => {
  const posted: string[] = []
  const worker = {
    postMessage: (message: { type: string }, [port]: MessagePort[]) => {
      posted.push(message.type)
      port!.postMessage(message.type === 'REMINDER_STATUS' ? { lastCheck: null } : reply)
    }
  }
  const registration = {
    active: worker,
    periodicSync: { getTags: async () => ['reminders'], register: vi.fn(), unregister: vi.fn() }
  }
  vi.stubGlobal('PeriodicSyncManager', vi.fn())
  vi.stubGlobal('Notification', { permission: 'granted' })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: async () => registration }
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: async () => ({ state: 'granted' }) }
  })
  return posted
}

describe('Settings reminders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    Reflect.deleteProperty(navigator, 'permissions')
  })

  it('explains where reminders work when the browser cannot run them', async () => {
    const wrapper = await mountSuspended(RemindersSection)
    await flushPromises()

    expect(wrapper.get('[data-testid="reminders-unavailable"]').text()).toContain(
      "Reminders aren't available in this browser"
    )
    expect(wrapper.find('[data-testid="reminders-switch"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('runs a check now and reports how many reminders were sent', async () => {
    const posted = stubInstalledApp({ sent: 2, lastCheck: '2026-10-29T08:12:00Z' })
    const wrapper = await mountSuspended(RemindersSection)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="reminders-check"]').exists()).toBe(true)
    )
    expect(wrapper.text()).toContain('On. Your device checks in the background')

    await wrapper.get('[data-testid="reminders-check"]').trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="reminders-result"]').text()).toBe(
        'Checked just now. 2 reminders sent.'
      )
    )
    expect(posted).toContain('CHECK_REMINDERS')
    wrapper.unmount()
  })
})
