// A user-requested refresh checks for a new worker before reloading the current page.
export async function refreshApp(
  serviceWorker: ServiceWorkerContainer | undefined,
  reload: () => void = () => window.location.reload()
): Promise<void> {
  const registration = await serviceWorker?.getRegistration().catch(() => undefined)
  if (registration) {
    // Offline checks may fail; refreshing the cached app should still work.
    await registration.update().catch(() => undefined)
    const installing = registration.installing
    if (installing && installing.state !== 'installed' && installing.state !== 'redundant') {
      await new Promise<void>((resolve) => {
        const changed = () => {
          if (installing.state === 'installed' || installing.state === 'redundant') {
            installing.removeEventListener('statechange', changed)
            resolve()
          }
        }
        installing.addEventListener('statechange', changed)
        changed()
      })
    }
    if (registration.waiting && serviceWorker) {
      serviceWorker.addEventListener('controllerchange', () => reload(), { once: true })
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }
  }
  reload()
}
