import type { ResultOf } from 'gql.tada'
import type { ProfileData } from '~/composables/useProfile'
import type { AiOutcome } from '~/utils/aiOutcome'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const CONTENT = graphql(`
  fragment RequirementMapContentFields on RequirementMapContent {
    needs {
      text
      kind
      importance
      match
      bulletIds
      entries {
        kind
        id
      }
      note
    }
  }
`)
const MAP = graphql(
  `
    fragment RequirementMapFields on RequirementMap {
      id
      createdAt
      updatedAt
      content {
        ...RequirementMapContentFields
      }
    }
  `,
  [CONTENT]
)
const READ = graphql(
  `
    query RequirementMap($listingId: Int!) {
      requirementMap(listingId: $listingId) {
        ...RequirementMapFields
      }
    }
  `,
  [MAP]
)
const GENERATE = graphql(
  `
    mutation GenerateRequirementMap($input: GenerateRequirementMapInput!) {
      generateRequirementMap(input: $input) {
        result {
          status
          error
          errorCode
          content {
            ...RequirementMapContentFields
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
  `,
  [CONTENT]
)
const PROMPT = graphql(`
  query RequirementMapExternalPrompt($listingId: Int!) {
    requirementMapExternalPrompt(listingId: $listingId) {
      version
      instructions
    }
  }
`)
const PREVIEW = graphql(
  `
    mutation PreviewRequirementMap($input: PreviewRequirementMapInput!) {
      previewRequirementMap(input: $input) {
        candidate {
          ...RequirementMapContentFields
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
  [CONTENT]
)
const SAVE = graphql(
  `
    mutation SaveRequirementMap($input: SaveRequirementMapInput!) {
      saveRequirementMap(input: $input) {
        requirementMap {
          ...RequirementMapFields
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
  [MAP]
)
const DELETE = graphql(`
  mutation DeleteRequirementMap($input: DeleteRequirementMapInput!) {
    deleteRequirementMap(input: $input) {
      listingId
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)
export type SavedRequirementMap = NonNullable<ResultOf<typeof READ>['requirementMap']>
export type RequirementMapContent = ResultOf<typeof CONTENT>

export const useRequirementMapQuery = (listingId: number) =>
  useAsyncData(
    `requirement-map-${listingId}`,
    () => gql(READ, { listingId }).then((r) => r.requirementMap),
    { server: false, dedupe: 'defer' }
  )
const copyNeeds = (needs: RequirementMapContent['needs']) =>
  JSON.parse(JSON.stringify(needs)) as RequirementMapContent['needs']

export const useRequirementMap = (
  listingId: number,
  profile: Ref<ProfileData | null | undefined>
) => {
  const query = useRequirementMapQuery(listingId)
  const needs = ref<RequirementMapContent['needs']>([])
  const baseline = ref<RequirementMapContent['needs']>([])
  const initialized = ref(false)
  const candidateLoaded = ref(false)
  let before: { needs: RequirementMapContent['needs']; pending: boolean } | undefined
  const normalized = computed(() =>
    profile.value ? toRequirementMapInput(needs.value, profile.value).needs : needs.value
  )
  const normalizedBaseline = computed(() =>
    profile.value ? toRequirementMapInput(baseline.value, profile.value).needs : baseline.value
  )
  const dirty = computed(
    () =>
      candidateLoaded.value ||
      JSON.stringify(normalized.value) !== JSON.stringify(normalizedBaseline.value)
  )
  // Baseline remains a snapshot: refreshes must never replace edits, including while profile resolves.
  watch(
    [query.status, query.data, profile],
    () => {
      if (query.status.value !== 'success' || !profile.value || (initialized.value && dirty.value))
        return
      needs.value = copyNeeds(query.data.value?.content.needs ?? [])
      baseline.value = copyNeeds(needs.value)
      initialized.value = true
    },
    { immediate: true }
  )
  const loadCandidate = (content: RequirementMapContent) => {
    before ??= { needs: copyNeeds(needs.value), pending: candidateLoaded.value }
    needs.value = copyNeeds(content.needs)
    candidateLoaded.value = true
  }
  const discard = () => {
    if (!before) return
    needs.value = before.needs
    candidateLoaded.value = before.pending
    before = undefined
  }
  const issues = computed(() => normalized.value.map(needIssue))
  const countIssue = computed(() =>
    needs.value.length < 1 || needs.value.length > 30 ? 'Add between 1 and 30 requirements.' : ''
  )
  const error = ref('')
  const submitted = ref(false)
  const { run, loading: saving } = useMutation()
  const { run: runDelete, loading: deleting } = useMutation()
  const notify = useAppToast()
  const save = async () => {
    submitted.value = true
    error.value = ''
    if (!profile.value || !initialized.value) {
      error.value = 'Load your profile before saving.'
      return false
    }
    if (countIssue.value || issues.value.some(Boolean)) return false
    let saved: SavedRequirementMap | null = null
    const ok = await run(async () => {
      const payload = (
        await gql(SAVE, { input: { listingId, content: { needs: normalized.value } } })
      ).saveRequirementMap
      error.value =
        payload.errors?.[0]?.message ?? (!payload.requirementMap ? ERROR_MESSAGES.generic : '')
      saved = payload.requirementMap
      return payload.errors
    })
    if (!ok || !saved) {
      error.value ||= ERROR_MESSAGES.generic
      return false
    }
    query.data.value = saved
    needs.value = copyNeeds((saved as SavedRequirementMap).content.needs)
    baseline.value = copyNeeds(needs.value)
    candidateLoaded.value = false
    before = undefined
    submitted.value = false
    notify.success('Requirements saved')
    return true
  }
  const remove = async () => {
    error.value = ''
    const ok = await runDelete(async () => {
      const payload = (await gql(DELETE, { input: { listingId } })).deleteRequirementMap
      error.value = payload.errors?.[0]?.message ?? ''
      return payload.errors
    })
    if (!ok) {
      error.value ||= ERROR_MESSAGES.generic
      return false
    }
    query.data.value = null
    needs.value = baseline.value = []
    candidateLoaded.value = false
    before = undefined
    notify.success('Requirement map deleted')
    return true
  }
  const ai = useAiRequest()
  const generating = ref(false)
  const previewing = ref(false)
  const generate = () =>
    ai.run(
      generating,
      { listingId },
      async (requestId) =>
        (await gql(GENERATE, { input: { listingId, requestId } })).generateRequirementMap,
      ({ result }): AiOutcome<RequirementMapContent> => {
        if (result?.status === 'SUCCEEDED' && result.content) return { value: result.content }
        const message = result?.error ?? ERROR_MESSAGES.generic
        return { error: result?.errorCode ? `${message} (${result.errorCode})` : message }
      }
    )
  const prompt = useAiPrompt(
    async () => (await gql(PROMPT, { listingId })).requirementMapExternalPrompt.instructions
  )
  const preview = async (json: string): Promise<AiOutcome<RequirementMapContent>> => {
    previewing.value = true
    try {
      const payload = (await gql(PREVIEW, { input: { listingId, json: json.trim() } }))
        .previewRequirementMap
      if (payload.errors?.length) return { error: payload.errors[0]!.message }
      return payload.candidate ? { value: payload.candidate } : { error: ERROR_MESSAGES.generic }
    } catch (e) {
      return { error: genericError(e) }
    } finally {
      previewing.value = false
    }
  }
  return {
    query,
    needs,
    normalized,
    initialized,
    dirty,
    candidateLoaded,
    loadCandidate,
    discard,
    issues,
    countIssue,
    error,
    submitted,
    save,
    saving,
    remove,
    deleting,
    generate,
    generating,
    preview,
    previewing,
    ...prompt,
    safetyCode: ai.safetyCode,
    safetyMessage: ai.safetyMessage,
    needsConfirm: ai.needsConfirm,
    confirmRetry: ai.confirmRetry
  }
}
