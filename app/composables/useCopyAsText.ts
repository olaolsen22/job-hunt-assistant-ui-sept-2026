// Copies a CV or letter as plain text, for application forms without a PDF upload. `copied` flips
// for a moment for a button that shows it; returns whether it worked, for a toast elsewhere.
export const useCopyAsText = (noun: string) => {
  const notify = useAppToast()
  const copied = ref(false)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
      return true
    } catch {
      notify.error(`Couldn't copy the ${noun}`, { description: 'Try again.' })
      return false
    }
  }

  return { copied, copy }
}
