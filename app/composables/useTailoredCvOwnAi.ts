import type { Ref } from 'vue'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { Language } from '~/constants/listing'
import type { TailoredCvSuggestion } from '~/composables/useTailoredCvDraft'
import type { TailoredCv, TailoredCvSectionKey } from '~/utils/tailoredCv'

const PROMPT = graphql(`
  query TailoredCvExternalPrompt(
    $listingId: Int!
    $template: TailoredCvTemplate
    $language: Language
  ) {
    tailoredCvExternalPrompt(listingId: $listingId, template: $template, language: $language) {
      instructions
    }
  }
`)

const PREVIEW = graphql(
  `
    mutation PreviewTailoredCvDraft($input: PreviewTailoredCvDraftInput!) {
      previewTailoredCvDraft(input: $input) {
        candidate {
          content {
            ...TailoredCvContentFields
          }
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
  [CV_CONTENT_FIELDS]
)

// The tailored CV's "use your own AI": the prompt for the current template and language, and the
// reply taken in as suggestions (or directly into a new candidate).
export const useTailoredCvOwnAi = ({
  listingId,
  cv,
  suggestions,
  writtenTemplate,
  offer,
  fillsDirectly
}: {
  listingId: number
  cv: Ref<TailoredCv | undefined>
  suggestions: Ref<TailoredCvSuggestion[]>
  writtenTemplate: Ref<TailoredCv['template'] | undefined>
  offer: (key: TailoredCvSectionKey, value: unknown, direct: boolean) => void
  fillsDirectly: () => boolean
}) => {
  // The template and language the shown prompt was written for; the pasted reply is previewed with
  // the same ones.
  const promptTemplate = ref<TailoredCv['template']>()
  const promptLanguage = ref<Language>()
  const { instructions, promptLoading, promptError, copied, loadPrompt, copyPrompt } = useAiPrompt(
    async () => {
      // A switch while the request is out fetches again, so the prompt never trails the choice.
      let template
      let language
      let text
      do {
        template = cv.value?.template
        language = cv.value?.language
        text = (await gql(PROMPT, { listingId, template, language })).tailoredCvExternalPrompt
          .instructions
      } while (template !== cv.value?.template || language !== cv.value?.language)
      promptTemplate.value = template
      promptLanguage.value = language
      return text
    }
  )
  // A prompt already on screen is fetched again, so the copied text matches the new template or
  // language. One loaded before the draft went out without a template, which the API reads as
  // Detailed, and without a language, which it reads as the saved draft's.
  watch(
    () => [cv.value?.template, cv.value?.language] as const,
    ([template, language]) => {
      const changed =
        template !== (promptTemplate.value ?? 'DETAILED') ||
        (!!promptLanguage.value && language !== promptLanguage.value)
      if (instructions.value && !promptLoading.value && changed) void loadPrompt()
    }
  )
  // Returns the API's error to show next to the pasted JSON, or null when the reply was taken in.
  const previewing = ref(false)
  // `scope` takes one section from the reply: the API has a single whole-CV prompt.
  const preview = async (json: string, scope?: TailoredCvSectionKey): Promise<string | null> => {
    if (!cv.value) return null
    previewing.value = true
    try {
      const language = promptLanguage.value ?? cv.value.language
      const { previewTailoredCvDraft } = await gql(PREVIEW, {
        input: {
          listingId,
          json: json.trim(),
          template: promptTemplate.value ?? cv.value.template,
          language
        }
      })
      const { candidate, errors } = previewTailoredCvDraft
      if (!candidate) return errors?.[0]?.message ?? ERROR_MESSAGES.generic
      const next = mergeExternalCandidate(cv.value, tailoredCvFromContent(candidate.content))
      next.language = language
      if (scope) {
        const value = getCvSection(next, scope)
        if (value === undefined) return 'The reply has nothing for this section.'
        offer(scope, value, fillsDirectly())
      } else {
        writtenTemplate.value = promptTemplate.value ?? cv.value.template
        if (fillsDirectly()) {
          cv.value = next
          suggestions.value = []
        } else {
          for (const { key, value } of changedCvSections(cv.value, next)) offer(key, value, false)
        }
      }
      return null
    } catch (e) {
      return genericError(e)
    } finally {
      previewing.value = false
    }
  }

  return {
    instructions,
    promptError,
    promptLoading,
    copied,
    loadPrompt,
    copyPrompt,
    previewing,
    preview
  }
}
