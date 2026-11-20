// Copies a CV or letter as plain text, for application forms without a PDF upload. `copied` flips
// for a moment for a button that shows it, and `copiedKey` says which one when a list has several
// Copy buttons; returns whether it worked, for a toast elsewhere.
export const useCopyAsText = (noun: string) => {
  const notify = useAppToast()
  const copied = ref(false)
  const copiedKey = ref<string | number | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  if (getCurrentScope()) onScopeDispose(() => clearTimeout(timer))

  const copy = async (text: string, key: string | number | null = null) => {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      copiedKey.value = key
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied.value = false
        copiedKey.value = null
      }, 2000)
      return true
    } catch {
      notify.error(`Couldn't copy the ${noun}`, { description: 'Try again.' })
      return false
    }
  }

  return { copied, copiedKey, copy }
}
