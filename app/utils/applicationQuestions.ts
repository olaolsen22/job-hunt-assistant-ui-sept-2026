export const QUESTION_MAX = 1000
export const NOTES_MAX = 2000
export const ANSWER_MAX = 10000
export const CHAR_LIMIT_MAX = 10000
export const QUESTIONS_PER_LISTING = 20

// answer.length matches the server's count, and the API rejects an answer over the limit
// (or over ANSWER_MAX when there is none).
export const isOverLimit = (answer: string, charLimit: number | null | undefined) =>
  answer.length > (charLimit ?? ANSWER_MAX)

export interface PastedQuestion {
  question: string
  charLimit: number | null
  // Past the listing's remaining slots, so it can't be added.
  overflow: boolean
  error?: string
}

// "Paste several": one question per line, in form order. A trailing "(500)" is the character limit
// and a leading "1." or "1)" is dropped, since questions copied from a form are often numbered.
export const parseQuestionLines = (text: string, remaining: number): PastedQuestion[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const match = /^(.*?)\s*\((\d+)\)$/.exec(line)
      const question = (match ? match[1]! : line).replace(/^\d+[.)]\s+/, '').trim()
      const charLimit = match ? Number(match[2]) : null
      let error: string | undefined
      if (!question)
        error =
          charLimit !== null
            ? 'A limit on its own line. Join it to the line above.'
            : 'No question text'
      else if (question.length > QUESTION_MAX) error = `Over ${QUESTION_MAX} characters`
      else if (charLimit !== null && (charLimit < 1 || charLimit > CHAR_LIMIT_MAX))
        error = `Remove (${charLimit}) or use a limit from 1 to ${CHAR_LIMIT_MAX}`
      return { question, charLimit, overflow: i >= remaining, error }
    })
