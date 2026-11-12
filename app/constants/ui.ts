// UModal content classes that make a long form full screen on phones, so the body scrolls and the
// footer (Save) stays in view. Nuxt UI's `fullscreen` prop can't be limited to a breakpoint.
export const PHONE_FULLSCREEN_MODAL =
  'max-sm:inset-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none max-sm:ring-0'

// How long each kind of toast stays (see useAppToast). Success clears quickly on phones; errors,
// warnings and Undo need time to read or act on. Hovering pauses the timer.
export const TOAST_DURATION = {
  success: 4000,
  info: 5000,
  warning: 8000,
  error: 8000,
  undoable: 8000
} as const
