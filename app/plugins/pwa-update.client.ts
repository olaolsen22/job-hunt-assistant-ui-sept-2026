// Offers a new version instead of reloading on its own (registerType 'prompt'), so a reload never
// throws away a half-filled form without the leave guard's "Leave site?" asking first.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const pwa = nuxtApp.$pwa
    // Undefined when the module is disabled (unit tests).
    if (!pwa) return
    const toast = useToast()

    const reload = async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      // Activates the waiting worker; vite-pwa reloads the page once it takes over.
      if (registration?.waiting) await pwa.updateServiceWorker()
      else window.location.reload()
      // Still here: "Leave site?" was cancelled, so keep offering the update.
      setTimeout(show, 1000)
    }
    const show = () =>
      toast.add({
        id: 'sw-update',
        title: 'Update available',
        description: 'Reload to get the latest version.',
        icon: 'i-lucide-refresh-cw',
        duration: 0,
        actions: [{ label: 'Reload', onClick: reload }]
      })

    watch(
      () => pwa.needRefresh,
      (needRefresh) => needRefresh && show(),
      { immediate: true }
    )

    // An installed app can stay open for days; look for a new version whenever it comes back.
    // Offline, the check fails; the next return to the app tries again.
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update().catch(() => undefined)
    })
  })
})
