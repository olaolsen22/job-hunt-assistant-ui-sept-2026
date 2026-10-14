// What actually went wrong behind a generic "Something went wrong": the HTTP status and the
// server's message for a failed request, or the message of a GraphQL error `gql` threw.
export const errorDetail = (e: unknown) => {
  const err = e as { statusCode?: number; statusMessage?: string; data?: unknown; message?: string }
  // A rejected GraphQL request (HTTP 400) carries its reason in `errors`, not in `message`.
  const data = err?.data as
    | { errors?: { message?: string }[]; message?: string; statusMessage?: string }
    | string
    | undefined
  const body =
    typeof data === 'string'
      ? data
      : (data?.errors?.[0]?.message ?? data?.message ?? data?.statusMessage)
  const status = err?.statusCode
    ? `HTTP ${err.statusCode}${err.statusMessage ? ` ${err.statusMessage}` : ''}`
    : ''
  return (
    [status, body ?? (status ? '' : err?.message)].filter(Boolean).join(': ') || 'Unknown error'
  )
}
