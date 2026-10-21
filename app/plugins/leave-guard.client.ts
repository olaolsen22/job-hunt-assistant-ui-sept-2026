// Mobile browsers often reload a backgrounded tab, which loses whatever was in progress (e.g. an AI
// modal while the owner is in another app with the copied prompt). A beforeunload handler makes
// Chromium less likely to discard the tab, and asks before every reload or close of the app.
export default defineNuxtPlugin(() => {
  window.addEventListener('beforeunload', (event) => {
    event.preventDefault()
    event.returnValue = ''
  })
})
