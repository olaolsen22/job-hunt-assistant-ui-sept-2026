import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { AiOutcome } from '~/utils/aiOutcome'

type PayloadErrors =
  readonly { __typename: string; message?: string; code?: string }[] | null | undefined

// The API's guard rails on AI calls (one run per user, duplicate requests, daily limits).
const safetyError = (errors: PayloadErrors) => errors?.find((e) => e.__typename === 'AiSafetyError')
export const aiSafetyCode = (errors: PayloadErrors) => safetyError(errors)?.code

// crypto.randomUUID exists only in secure contexts (https or localhost), so opening the app over
// plain http on another host would break every AI call. getRandomValues works everywhere.
const newRequestId = () => {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40 // version 4
  b[8] = (b[8]! & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// The last attempt may have run (and been billed) without a result reaching us.
const CONFIRM_CODES = ['operation-interrupted', 'result-unavailable']

// How many built-in AI requests are waiting for an answer, app-wide. The layout's leave guard asks
// before navigating away from one: its answer would be lost, and it may still count as a run.
export const useAiInFlight = () => useState('ai-in-flight', () => 0)

// One per AI action (a modal, a page). Every user action gets a new requestId so the API can tell
// a double submit from a new run; the id is kept only when the request got no usable answer and
// the user sends the same input again, so the API can answer the retry from the first attempt.
// Nothing here retries on its own.
export const useAiRequest = () => {
  const llm = useLlmModels()
  const inFlight = useAiInFlight()
  let kept: { input: string; id: string } | undefined
  const safetyCode = ref<string>()
  // Kept until the user confirms, so the warning survives closing and reopening the modal.
  const safetyMessage = ref('')
  const needsConfirm = computed(() => CONFIRM_CODES.includes(safetyCode.value ?? ''))

  const attempt = async <T extends { errors?: PayloadErrors }>(
    input: unknown,
    request: (requestId: string) => Promise<T>
  ) => {
    const key = JSON.stringify(input)
    const id = kept?.input === key ? kept.id : newRequestId()
    kept = { input: key, id }
    inFlight.value++
    let payload: T
    try {
      payload = await request(id)
    } finally {
      inFlight.value--
    }
    kept = undefined
    const error = safetyError(payload.errors)
    safetyCode.value = error?.code
    safetyMessage.value = error?.message ?? ''
    return payload
  }

  // The user accepted that another attempt may be charged: it is a new action with a new id.
  const confirmRetry = () => {
    kept = undefined
    safetyCode.value = undefined
    safetyMessage.value = ''
  }

  // The usual built-in call: busy while it runs, then the API's first error (with its safety code),
  // else `read` turns the answer into a value or a message. A saved default model that went away on
  // the server refetches the list, so Settings and the cost notice show the new default.
  const run = async <P extends { errors?: PayloadErrors }, V>(
    busy: Ref<boolean>,
    input: unknown,
    request: (requestId: string) => Promise<P>,
    read: (payload: P) => AiOutcome<V>
  ): Promise<AiOutcome<V>> => {
    busy.value = true
    try {
      const payload = await attempt(input, request)
      if (isUnknownModel(payload.errors)) await llm.refresh()
      const first = payload.errors?.[0]
      if (first) {
        return {
          error: first.message ?? ERROR_MESSAGES.generic,
          code: aiSafetyCode(payload.errors)
        }
      }
      return read(payload)
    } catch (e) {
      return { error: genericError(e) }
    } finally {
      busy.value = false
    }
  }

  return { attempt, run, safetyCode, safetyMessage, needsConfirm, confirmRetry }
}
