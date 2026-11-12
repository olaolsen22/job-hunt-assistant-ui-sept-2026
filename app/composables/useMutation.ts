import { ERROR_MESSAGES } from '~/constants/errorMessages'

type PayloadErrors = readonly { __typename: string; message: string }[] | null | undefined

// Runs a mutation whose payload has typed `errors`, showing the API's own message on failure.
// A *NotFoundError means our copy of the listing is stale, so `onStale` refetches it.
export const useMutation = (onStale?: () => void) => {
  const notify = useAppToast()
  const loading = ref(false)

  const run = async (mutate: () => Promise<PayloadErrors>) => {
    loading.value = true
    try {
      const error = (await mutate())?.[0]
      if (!error) return true
      notify.error(error.message)
      if (error.__typename.endsWith('NotFoundError')) onStale?.()
      return false
    } catch {
      notify.error(ERROR_MESSAGES.generic)
      return false
    } finally {
      loading.value = false
    }
  }

  return { run, loading }
}
