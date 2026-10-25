import { ERROR_MESSAGES } from '~/constants/errorMessages'

// What an AI step hands back to its modal: the value, or the message to show with the API's
// AiSafetyError code when there is one.
export type AiOutcome<T> =
  { value: T; error?: never; code?: never } | { error: string; code?: string }

// The generic text alone hides why a request failed, so append what the API or network said.
export const genericError = (e: unknown) => `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
