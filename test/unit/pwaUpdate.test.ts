import { describe, expect, it, vi } from 'vitest'
import { refreshApp } from '~/utils/pwaUpdate'

describe('Manual app refresh', () => {
  it('reloads without service worker support', async () => {
    const reload = vi.fn()
    await refreshApp(undefined, reload)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('checks for updates and reloads when none is waiting, including offline', async () => {
    for (const offline of [false, true]) {
      const reload = vi.fn()
      const update = vi.fn(() =>
        offline ? Promise.reject(new Error('Offline')) : Promise.resolve()
      )
      const sw = { getRegistration: vi.fn().mockResolvedValue({ update }) }
      await refreshApp(sw as unknown as ServiceWorkerContainer, reload)
      expect(update).toHaveBeenCalledOnce()
      expect(reload).toHaveBeenCalledOnce()
    }
  })

  it('activates a waiting update and reloads only once it takes control', async () => {
    const reload = vi.fn()
    const sw = new EventTarget() as ServiceWorkerContainer
    const postMessage = vi.fn()
    sw.getRegistration = vi
      .fn()
      .mockResolvedValue({ update: vi.fn().mockResolvedValue(undefined), waiting: { postMessage } })
    await refreshApp(sw, reload)
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    sw.dispatchEvent(new Event('controllerchange'))
    sw.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('waits for an update being downloaded before activating it', async () => {
    const reload = vi.fn()
    const installing = Object.assign(new EventTarget(), { state: 'installing' })
    const postMessage = vi.fn()
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
      installing,
      waiting: null as null | { postMessage: typeof postMessage }
    }
    const sw = new EventTarget() as ServiceWorkerContainer
    sw.getRegistration = vi.fn().mockResolvedValue(registration)
    const result = refreshApp(sw, reload)
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled())
    registration.waiting = { postMessage }
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))
    await result
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
  })
})
