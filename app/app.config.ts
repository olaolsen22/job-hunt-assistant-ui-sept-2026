// Form controls default to lg (~36px) so they're usable as touch targets. `max-sm:text-base`
// keeps input text at 16px on phones: iOS Safari zooms the page on focus below that.
const touchInput = { defaultVariants: { size: 'lg' }, slots: { base: 'max-sm:text-base' } } as const

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    },
    input: touchInput,
    inputMenu: touchInput,
    select: touchInput,
    selectMenu: touchInput,
    textarea: touchInput,
    // py-2.5 makes buttons 40px on phones, level with the 16px-text inputs next to them.
    button: { defaultVariants: { size: 'lg' }, slots: { base: 'max-sm:py-2.5' } },
    switch: { defaultVariants: { size: 'lg' } },
    // A toast added without useAppToast must not look like a success (the default is primary).
    toast: { defaultVariants: { color: 'neutral' } }
  }
})
