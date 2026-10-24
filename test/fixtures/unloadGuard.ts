import { vi } from 'vitest'

// The app-wide leave-guard plugin always cancels beforeunload, so a dispatched event can't show
// whether a page asked for the warning. Track the handlers a page adds after this call instead.
export const trackUnloadGuards = () => {
  const handlers = new Set<EventListener>()
  const add = window.addEventListener.bind(window)
  const remove = window.removeEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'beforeunload') handlers.add(listener as EventListener)
    add(type, listener, options)
  })
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
    if (type === 'beforeunload') handlers.delete(listener as EventListener)
    remove(type, listener, options)
  })
  return () => {
    const event = new Event('beforeunload', { cancelable: true })
    handlers.forEach((handler) => handler(event))
    return event.defaultPrevented
  }
}
