// UModal content classes that make a long form full screen on phones, so the body scrolls and the
// footer (Save) stays in view. Nuxt UI's `fullscreen` prop can't be limited to a breakpoint.
export const PHONE_FULLSCREEN_MODAL =
  'max-sm:inset-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none max-sm:ring-0'

// Success confirmations close a bit sooner than Nuxt UI's 5s default so they clear the screen
// quickly on phones; errors and toasts with actions keep the default.
export const SUCCESS_TOAST_DURATION = 4000
