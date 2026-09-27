import { ERROR_MESSAGES } from '~/constants/errorMessages'

// Both aliased to `prompt` so either document has the same result shape.
const QUERIES = {
  listingParsePrompt: graphql(`
    query ListingParsePrompt {
      prompt: listingParsePrompt {
        instructions
      }
    }
  `),
  listingQuickParsePrompt: graphql(`
    query ListingQuickParsePrompt {
      prompt: listingQuickParsePrompt {
        instructions
      }
    }
  `)
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
      const { prompt } = await gql(QUERIES[name])
      instructions.value = prompt.instructions
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
