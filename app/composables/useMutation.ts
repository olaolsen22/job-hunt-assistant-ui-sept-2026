import { ERROR_MESSAGES } from '~/constants/errorMessages'

type PayloadErrors = readonly { __typename: string; message: string }[] | null | undefined

// Runs a mutation whose payload has typed `errors`, showing the API's own message on failure.
// A *NotFoundError means our copy of the listing is stale, so `onStale` refetches it.
export const useMutation = (onStale?: () => void) => {
  const toast = useToast()
  const loading = ref(false)

  const run = async (mutate: () => Promise<PayloadErrors>) => {
    loading.value = true
    try {
      const error = (await mutate())?.[0]
      if (!error) return true
      toast.add({ title: error.message, color: 'error' })
      if (error.__typename.endsWith('NotFoundError')) onStale?.()
      return false
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
      return false
    } finally {
      loading.value = false
    }
  }

  return { run, loading }
}
