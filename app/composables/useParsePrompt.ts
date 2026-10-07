import { ERROR_MESSAGES } from '~/constants/errorMessages'

// All aliased to `prompt` so every document has the same result shape.
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
  `),
  companyParsePrompt: graphql(`
    query CompanyParsePrompt {
      prompt: companyParsePrompt {
        instructions
      }
    }
  `)
}

type PromptName = keyof typeof QUERIES

const PARSE_MODES = {
  listingParsePrompt: 'FULL',
  listingQuickParsePrompt: 'QUICK',
  companyParsePrompt: 'COMPANIES'
} as const

const PARSE_LISTING = graphql(`
  mutation ParseListing($text: String!, $mode: ParseMode!) {
    parseListing(input: { text: $text, mode: $mode }) {
      parseJob {
        status
        result
        error
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const PARSE_LISTING_FROM_URL = graphql(`
  mutation ParseListingFromUrl($listingId: Int!) {
    parseListingFromUrl(input: { listingId: $listingId }) {
      parseJob {
        status
        result
        error
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

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

  // The server adds the prompt, so only the ad goes up. Returns the AI's JSON reply, or undefined
  // after a toast so the caller can fall back to copy-paste.
  const parsing = ref(false)
  const parse = async (posting: string) => {
    parsing.value = true
    try {
      const { parseListing } = await gql(PARSE_LISTING, {
        text: posting.trim(),
        mode: PARSE_MODES[name]
      })
      const { parseJob, errors } = parseListing
      if (parseJob?.status === 'SUCCEEDED' && parseJob.result) return parseJob.result
      toast.add({
        title: errors?.[0]?.message ?? parseJob?.error ?? ERROR_MESSAGES.generic,
        color: 'error',
        icon: 'i-lucide-circle-alert'
      })
    } catch {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error', icon: 'i-lucide-circle-alert' })
    } finally {
      parsing.value = false
    }
  }

  // The API fetches the saved listing's own URL (10-25 s). Failures are expected (login walls, JS-only pages), so
  // they come back for the modal to show next to the paste fallback instead of as a toast.
  const parsingUrl = ref(false)
  const parseFromUrl = async (listingId: number) => {
    parsingUrl.value = true
    try {
      const { parseListingFromUrl } = await gql(PARSE_LISTING_FROM_URL, { listingId })
      const { parseJob, errors } = parseListingFromUrl
      if (parseJob?.status === 'SUCCEEDED' && parseJob.result) return { result: parseJob.result }
      return { error: errors?.[0]?.message ?? parseJob?.error ?? ERROR_MESSAGES.generic }
    } catch {
      return { error: ERROR_MESSAGES.generic }
    } finally {
      parsingUrl.value = false
    }
  }

  return { instructions, copied, load, copy, parsing, parse, parsingUrl, parseFromUrl }
}
