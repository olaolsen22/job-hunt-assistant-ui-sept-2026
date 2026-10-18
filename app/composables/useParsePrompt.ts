import type { ResultOf } from 'gql.tada'
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
  mutation ParseListing($text: String!, $mode: ParseMode!, $requestId: UUID) {
    parseListing(input: { text: $text, mode: $mode, requestId: $requestId }) {
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
        ... on AiSafetyError {
          code
        }
      }
    }
  }
`)

const PARSE_LISTING_FROM_URL = graphql(`
  mutation ParseListingFromUrl($listingId: Int!, $requestId: UUID) {
    parseListingFromUrl(input: { listingId: $listingId, requestId: $requestId }) {
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
        ... on AiSafetyError {
          code
        }
      }
    }
  }
`)

const PARSE_URL = graphql(`
  mutation ParseUrl($url: String!, $requestId: UUID) {
    parseUrl(input: { url: $url, requestId: $requestId }) {
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
        ... on AiSafetyError {
          code
        }
      }
    }
  }
`)

// The three parse mutations answer alike; only their error unions differ.
type ParsePayload =
  | ResultOf<typeof PARSE_LISTING>['parseListing']
  | ResultOf<typeof PARSE_LISTING_FROM_URL>['parseListingFromUrl']
  | ResultOf<typeof PARSE_URL>['parseUrl']

// code: the API's AiSafetyError code, so callers can stop a batch or ask before another try.
// detail: the technical reason behind a generic message, for the owner to see what went wrong.
export type ParseOutcome = { result: string } | { error: string; code?: string; detail?: string }

// Call load() (or loadPrompt() where promptError is shown) before the user can click copy:
// browsers can refuse a clipboard write that follows an await.
export const useParsePrompt = (name: PromptName) => {
  const toast = useToast()
  const llm = useLlmModels()
  const { attempt, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyText } = useAiPrompt(
    async () => (await gql(QUERIES[name])).prompt.instructions
  )

  // For pages without an error spot of their own; the modal shows promptError instead.
  const load = async () => {
    await loadPrompt()
    if (promptError.value) {
      toast.add({ title: ERROR_MESSAGES.generic, color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  const copy = (posting: string) =>
    copyText(`${instructions.value}\n\n<posting>\n${posting.trim()}\n</posting>`)

  // For AIs that can browse: the prompt points at the ad instead of containing it.
  const copyLink = (url: string) =>
    copyText(
      `${instructions.value}\n\nOpen this job ad link and use the ad on that page as the posting:\n${url.trim()}`
    )

  // For pages without an error spot of their own. A daily limit is changed in Settings.
  const toastError = ({ error, code }: { error: string; code?: string }) =>
    toast.add({
      title: error,
      color: 'error',
      icon: 'i-lucide-circle-alert',
      actions:
        code === 'daily-limit-reached'
          ? [{ label: 'Daily limits in Settings', to: '/settings' }]
          : undefined
    })

  // input identifies the action, so a retry after a network failure reuses its requestId.
  const run = async (
    busy: Ref<boolean>,
    input: unknown,
    request: (requestId: string) => Promise<ParsePayload>
  ): Promise<ParseOutcome> => {
    busy.value = true
    try {
      const { parseJob, errors } = await attempt(input, request)
      if (parseJob?.status === 'SUCCEEDED' && parseJob.result) return { result: parseJob.result }
      // The saved default model is gone: the message is shown, and the list is fetched again so
      // Settings and the notice show the new default.
      if (isUnknownModel(errors)) await llm.refresh()
      const message = errors?.[0]?.message ?? parseJob?.error
      if (message) return { error: message, code: aiSafetyCode(errors) }
      return {
        error: ERROR_MESSAGES.generic,
        detail: parseJob
          ? `The parse job ended ${parseJob.status} without a result.`
          : 'The API returned no parse job and no error.'
      }
    } catch (cause) {
      // A network or server failure, or a GraphQL error (gql throws its message).
      return {
        error: ERROR_MESSAGES.generic,
        detail: cause instanceof Error ? cause.message : String(cause)
      }
    } finally {
      busy.value = false
    }
  }

  // The server adds the prompt, so only the ad goes up. Returns the AI's JSON reply, or the error
  // for the caller to show (inline in the modal, a toast elsewhere) before falling back to copy-paste.
  const parsing = ref(false)
  const parse = (posting: string) => {
    const input = { text: posting.trim(), mode: PARSE_MODES[name] }
    return run(
      parsing,
      input,
      async (requestId) => (await gql(PARSE_LISTING, { ...input, requestId })).parseListing
    )
  }

  // The API fetches the saved listing's own URL (10-25 s). Failures are expected (login walls, JS-only pages), so
  // they come back for the modal to show next to the paste fallback instead of as a toast.
  const parsingUrl = ref(false)
  const parseFromUrl = (listingId: number) =>
    run(
      parsingUrl,
      { listingId },
      async (requestId) =>
        (await gql(PARSE_LISTING_FROM_URL, { listingId, requestId })).parseListingFromUrl
    )

  // Same as parseFromUrl but for an unsaved listing: the API reads the given URL (always a FULL
  // parse) and saves nothing.
  const parsingNewUrl = ref(false)
  const parseNewUrl = (url: string) =>
    run(
      parsingNewUrl,
      { url: url.trim() },
      async (requestId) => (await gql(PARSE_URL, { url: url.trim(), requestId })).parseUrl
    )

  return {
    instructions,
    promptLoading,
    promptError,
    copied,
    load,
    loadPrompt,
    copy,
    copyLink,
    parsing,
    parse,
    parsingUrl,
    parseFromUrl,
    parsingNewUrl,
    parseNewUrl,
    needsConfirm,
    safetyMessage,
    confirmRetry,
    toastError
  }
}
