// Only http(s) counts as a web address; `new URL` also accepts mailto:, javascript: and the like.
export const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
