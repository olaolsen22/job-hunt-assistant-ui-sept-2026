export type AiMethod = 'builtin' | 'own'

// The AI the owner used last, so every AI modal opens on it. A cookie, so server and client
// render the same tab. Write it after a successful run, not on a tab click.
export const useAiMethod = () =>
  useCookie<AiMethod | null>('ai-method', { default: () => null, maxAge: 60 * 60 * 24 * 365 })
