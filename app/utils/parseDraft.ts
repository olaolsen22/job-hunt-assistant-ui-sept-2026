export const INVALID_DRAFT_JSON = 'That doesn’t look like valid JSON.'

// AIs often wrap the JSON in a code fence or a sentence, so take the outermost object.
// Returns null when the reply holds no valid JSON object.
export const parseDraft = (reply: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1))
  } catch {
    return null
  }
}
