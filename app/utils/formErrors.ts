import type { FormError } from '@nuxt/ui'

// A form's `validate` result from one check per field: a message where it fails, false where it passes.
export const formErrors = (checks: Record<string, string | false>): FormError[] =>
  Object.entries(checks).flatMap(([name, message]) => (message ? [{ name, message }] : []))

// AppMonthField reports a half-filled value as null plus `partial`, which would otherwise read as empty.
export const monthError = (value: string | null, partial: boolean, required = false) =>
  partial ? 'Pick both month and year.' : required && !value ? 'Pick a month.' : false

export const requiredError = (value: string | undefined, label: string) =>
  !value?.trim() && `Enter ${label}.`
