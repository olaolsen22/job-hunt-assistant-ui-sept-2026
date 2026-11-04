// Mirrors the ContactChannel and ContactDirection enums in the API's schema.graphql.
export const CONTACT_CHANNEL_OPTIONS = [
  { label: 'Email', value: 'EMAIL', icon: 'i-lucide-mail' },
  { label: 'LinkedIn', value: 'LINKED_IN', icon: 'i-lucide-linkedin' },
  { label: 'Phone', value: 'PHONE', icon: 'i-lucide-phone' },
  { label: 'Meeting', value: 'MEETING', icon: 'i-lucide-users' },
  { label: 'Other', value: 'OTHER', icon: 'i-lucide-message-circle' }
] as const

// `label` is the toggle in the log form, `verb` starts a timeline entry ("You sent · Email").
export const CONTACT_DIRECTION_OPTIONS = [
  { label: 'Sent', value: 'SENT', verb: 'You sent', icon: 'i-lucide-arrow-up-right' },
  { label: 'Received', value: 'RECEIVED', verb: 'Received', icon: 'i-lucide-arrow-down-left' }
] as const

export type ContactChannel = (typeof CONTACT_CHANNEL_OPTIONS)[number]['value']
export type ContactDirection = (typeof CONTACT_DIRECTION_OPTIONS)[number]['value']
