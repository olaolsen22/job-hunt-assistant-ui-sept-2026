import { ERROR_MESSAGES } from '~/constants/errorMessages'

const QUERIES = {
  listingParsePrompt: `query ListingParsePrompt { listingParsePrompt { instructions } }`,
  listingQuickParsePrompt: `query ListingQuickParsePrompt { listingQuickParsePrompt { instructions } }`
}

type PromptName = keyof typeof QUERIES

// Call load() before the user can click copy: browsers can refuse a clipboard write that follows
// an await, so the instructions must already be here.
export const useParsePrompt = (name: PromptName) => {
  const toast = useToast()
  const instructions = ref('')
  const copied = ref(false)

  const load = async () => {
    try {
      const data = await gql<Record<PromptName, { instructions: string }>>(QUERIES[name])
      instructions.value = data[name].instructions
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  const copy = async (posting: string) => {
    await navigator.clipboard.writeText(
      `${instructions.value}\n\n<posting>\n${posting.trim()}\n</posting>`
    )
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }

  return { instructions, copied, load, copy }
}
