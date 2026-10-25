import { SUCCESS_TOAST_DURATION } from '~/constants/ui'

// The one look for "it worked": green with a check, closing sooner than errors (see constants/ui).
export const useSuccessToast = () => {
  const toast = useToast()
  return (title: string, description?: string) =>
    toast.add({
      title,
      description,
      color: 'success',
      icon: 'i-lucide-check',
      duration: SUCCESS_TOAST_DURATION
    })
}
