// Closing or reloading the tab is covered by plugins/leave-guard.client.ts; these cover links and
// the browser's Back inside the app.

const useLeaveConfirmed = () => useState('leave-confirmed', () => false)

// For a page that already asked before leaving: the layout's AI guard lets this navigation through,
// so leaving is confirmed once.
export const navigateAfterConfirm = async (to: string) => {
  const confirmed = useLeaveConfirmed()
  confirmed.value = true
  try {
    await navigateTo(to)
  } finally {
    confirmed.value = false
  }
}

// A page's "Leave without saving?" for in-app navigation while `unsaved()` holds.
export const useLeaveConfirm = (unsaved: () => boolean) => {
  const open = ref(false)
  let destination = ''
  let leaving = false
  onBeforeRouteLeave((to) => {
    if (leaving || !unsaved()) return true
    destination = to.fullPath
    open.value = true
    return false
  })
  const leave = async () => {
    leaving = true
    open.value = false
    await navigateAfterConfirm(destination)
  }
  return { open, leave }
}

// Used once, by the default layout: leaving a page while a built-in AI request is still waiting
// loses its answer, and the request may still count, so any page or modal asks first.
// Query-only changes (the listings filters) stay on the page and never ask.
export const useAiLeaveGuard = () => {
  const router = useRouter()
  const inFlight = useAiInFlight()
  const confirmed = useLeaveConfirmed()
  const open = ref(false)
  let destination = ''

  const remove = router.beforeEach((to, from) => {
    if (confirmed.value || inFlight.value === 0 || to.path === from.path) return true
    destination = to.fullPath
    open.value = true
    return false
  })
  onScopeDispose(remove)

  const leave = async () => {
    open.value = false
    await navigateAfterConfirm(destination)
  }
  return { open, leave }
}
