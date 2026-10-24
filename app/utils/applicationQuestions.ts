export const QUESTION_MAX = 1000
export const NOTES_MAX = 2000
export const ANSWER_MAX = 10000
export const CHAR_LIMIT_MAX = 10000
export const QUESTIONS_PER_LISTING = 20

// answer.length matches the server's count, and the API rejects an answer over the limit
// (or over ANSWER_MAX when there is none).
export const isOverLimit = (answer: string, charLimit: number | null | undefined) =>
  answer.length > (charLimit ?? ANSWER_MAX)
