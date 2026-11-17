import type { MaybeRefOrGetter } from 'vue'

export interface BackLinkOptions {
  /** Destination's short name, shown beside the arrow from `sm` ("Listings", "Company"). */
  label: MaybeRefOrGetter<string>
  /** Fixed target, so list filters survive and deep links (PWA) still have somewhere to go. */
  to: MaybeRefOrGetter<string>
}

interface BackLinkState {
  path: string
  to: string
  label: string
}

/** The back control in the layout's fixed navbar, so it never scrolls away. */
export const useBackLinkState = () => useState<BackLinkState | null>('back-link', () => null)

/**
 * Registers this page's back target. Keyed by path rather than cleared on unmount: during a
 * navigation the next page can register before the previous one unmounts, and a clear would then
 * wipe the new link.
 */
export const useBackLink = (options: BackLinkOptions) => {
  const route = useRoute()
  const path = route.path
  const state = useBackLinkState()
  const router = useRouter()
  watchEffect(() => {
    // An outgoing page whose view changes mid-navigation must not overwrite the incoming link.
    if (router.currentRoute.value.path !== path) return
    state.value = {
      path,
      to: toValue(options.to),
      label: toValue(options.label)
    }
  })
}
