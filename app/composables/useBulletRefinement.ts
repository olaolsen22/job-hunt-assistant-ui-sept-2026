import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { AiOutcome } from '~/utils/aiOutcome'

const PROMPT = graphql(`
  query ProfileBulletRefinementPrompt($bulletId: Int, $kind: ProfileEntryKind, $entryId: Int) {
    profileBulletRefinementPrompt(bulletId: $bulletId, kind: $kind, entryId: $entryId) {
      instructions
    }
  }
`)
const SUGGESTION_FIELDS = graphql(`
  fragment BulletRefinementFields on ProfileBulletRefinementSuggestion {
    status
    error
    bullets {
      bulletId
      text
      note
    }
  }
`)
const REFINE = graphql(
  `
    mutation RefineProfileBullets(
      $bulletId: Int
      $kind: ProfileEntryKind
      $entryId: Int
      $requestId: UUID
    ) {
      refineProfileBullets(
        input: { bulletId: $bulletId, kind: $kind, entryId: $entryId, requestId: $requestId }
      ) {
        result {
          ...BulletRefinementFields
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
  `,
  [SUGGESTION_FIELDS]
)
const PREVIEW = graphql(
  `
    mutation PreviewProfileBulletRefinement(
      $json: String!
      $bulletId: Int
      $kind: ProfileEntryKind
      $entryId: Int
    ) {
      previewProfileBulletRefinement(
        input: { json: $json, bulletId: $bulletId, kind: $kind, entryId: $entryId }
      ) {
        result {
          ...BulletRefinementFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [SUGGESTION_FIELDS]
)
const APPLY = graphql(`
  mutation ApplyProfileBulletRefinement($bullets: [ProfileBulletTextInput!]!) {
    applyProfileBulletRefinement(input: { bullets: $bullets }) {
      profile {
        id
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

// Which bullets the AI looks at: none given = the whole profile, an entry, or one bullet. Sent as
// separate arguments, so the API never receives a mixed scope.
export type BulletScope = {
  bulletId?: number
  kind?: 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'PROJECT'
  entryId?: number
}
// text is null when the AI only asks a question (note) and proposes no new wording.
export type BulletSuggestion = NonNullable<ResultOf<typeof SUGGESTION_FIELDS>['bullets']>[number]

const readSuggestion = (
  result: ResultOf<typeof SUGGESTION_FIELDS> | null | undefined
): AiOutcome<BulletSuggestion[]> =>
  result?.status === 'SUCCEEDED'
    ? { value: result.bullets ?? [] }
    : { error: result?.error ?? ERROR_MESSAGES.generic }

export const useBulletRefinement = (scope: () => BulletScope) => {
  const { run, needsConfirm, safetyMessage, confirmRetry } = useAiRequest()
  const busy = ref(false)
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => (await gql(PROMPT, scope())).profileBulletRefinementPrompt.instructions
  )

  const suggest = () =>
    run(
      busy,
      scope(),
      async (requestId) => (await gql(REFINE, { ...scope(), requestId })).refineProfileBullets,
      ({ result }) => readSuggestion(result)
    )

  const preview = async (json: string): Promise<AiOutcome<BulletSuggestion[]>> => {
    busy.value = true
    try {
      const { previewProfileBulletRefinement: payload } = await gql(PREVIEW, { ...scope(), json })
      if (payload.errors?.length) return { error: payload.errors[0]!.message }
      return readSuggestion(payload.result)
    } catch (e) {
      return { error: genericError(e) }
    } finally {
      busy.value = false
    }
  }

  const apply = async (selection: {
    bullets: { id: number; text: string }[]
  }): Promise<{ error?: string }> => {
    busy.value = true
    try {
      const { applyProfileBulletRefinement: payload } = await gql(APPLY, selection)
      return payload.errors?.length ? { error: payload.errors[0]!.message } : {}
    } catch (e) {
      return { error: genericError(e) }
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    instructions,
    promptLoading,
    promptError,
    copied,
    needsConfirm,
    safetyMessage,
    confirmRetry,
    loadPrompt,
    copyPrompt,
    suggest,
    preview,
    apply
  }
}
