import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { Language } from '~/constants/listing'
import type { AiOutcome } from '~/utils/aiOutcome'

const SUGGEST = graphql(`
  mutation SuggestTailoredCvSkillGroups(
    $skillNames: [String!]!
    $language: Language!
    $requestId: UUID
  ) {
    suggestTailoredCvSkillGroups(
      input: { skillNames: $skillNames, language: $language, requestId: $requestId }
    ) {
      result {
        status
        error
        groups {
          name
          group
        }
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

const PROMPT = graphql(`
  query TailoredCvSkillGroupPrompt($skillNames: [String!]!, $language: Language!) {
    tailoredCvSkillGroupPrompt(skillNames: $skillNames, language: $language) {
      instructions
    }
  }
`)

export interface SkillGroupsInput {
  skillNames: string[]
  language: Language
}

// A pasted own-AI answer: {"groups":[{"name":"…","group":"…"}]}, maybe in a ```json fence.
// Entries that aren't a name/group pair of strings are skipped, like unknown names.
export const parseSkillGroupsReply = (reply: string): AiOutcome<Map<string, string>> => {
  const groups = parseDraft(reply)?.groups
  if (!Array.isArray(groups)) return { error: 'Paste a reply with a "groups" list.' }
  return {
    value: new Map(
      groups
        .filter((g) => typeof g?.name === 'string' && typeof g?.group === 'string')
        .map((g) => [g.name, g.group])
    )
  }
}

// Built-in AI or your own: the skill names in, a group label per name out. Nothing is saved here.
export const useTailoredCvSkillGroups = (input: () => SkillGroupsInput) => {
  const { run, safetyCode, safetyMessage, needsConfirm, confirmRetry } = useAiRequest()
  const busy = ref(false)

  const suggest = () => {
    const vars = input()
    return run(
      busy,
      vars,
      async (requestId) =>
        (await gql(SUGGEST, { ...vars, requestId })).suggestTailoredCvSkillGroups,
      ({ result }): AiOutcome<Map<string, string>> =>
        result?.status === 'SUCCEEDED'
          ? { value: new Map((result.groups ?? []).map((g) => [g.name, g.group])) }
          : { error: result?.error ?? ERROR_MESSAGES.generic }
    )
  }

  const prompt = useAiPrompt(
    async () => (await gql(PROMPT, input())).tailoredCvSkillGroupPrompt.instructions
  )

  return { busy, suggest, safetyCode, safetyMessage, needsConfirm, confirmRetry, ...prompt }
}
