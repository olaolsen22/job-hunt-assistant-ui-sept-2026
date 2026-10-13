import type { ResultOf } from 'gql.tada'

const MODELS = graphql(`
  query LlmModels {
    llmModels {
      models {
        id
        label
        provider
        keySource
      }
      defaultModel
    }
  }
`)

const SET_DEFAULT = graphql(`
  mutation SetDefaultLlmModel($model: String) {
    setDefaultLlmModel(input: { model: $model }) {
      llmModels {
        models {
          id
          label
          provider
          keySource
        }
        defaultModel
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

export type LlmModel = ResultOf<typeof MODELS>['llmModels']['models'][number]

// The model went away on the server (config changed): no AI call was made, so callers refresh
// the list and fall back to the new default.
export const isUnknownModel = (errors: readonly { __typename: string }[] | null | undefined) =>
  !!errors?.some((e) => e.__typename === 'UnknownLlmModelError')

// Shared key: a modal, its composable and its picker all call this. defer joins a request already
// in flight and getCachedData reuses a loaded list, so they make one request; only an explicit
// refresh() asks again. The server decides which models an account gets, so nothing here looks at
// the role.
export const useLlmModels = () => {
  const { data, status, error, refresh } = useAsyncData('llm-models', () => gql(MODELS), {
    server: false,
    dedupe: 'defer',
    getCachedData: (key, nuxtApp, { cause }) =>
      cause === 'refresh:manual' ? undefined : nuxtApp.payload.data[key]
  })
  const models = computed(() => data.value?.llmModels.models ?? [])
  const defaultModel = computed(() => data.value?.llmModels.defaultModel)
  const label = (id: string) => models.value.find((m) => m.id === id)?.label ?? id

  // null resets to the app default. Usage counts the default model, so it follows the change.
  const { run, loading: saving } = useMutation()
  const setDefault = (model: string | null) =>
    run(async () => {
      const { setDefaultLlmModel: payload } = await gql(SET_DEFAULT, { model })
      if (payload.llmModels) {
        data.value = { llmModels: payload.llmModels }
        await refreshNuxtData('dashboard-llm-usage')
      }
      if (isUnknownModel(payload.errors)) await refresh()
      return payload.errors
    })

  return {
    models,
    defaultModel,
    status,
    error,
    refresh,
    label,
    setDefault,
    saving
  }
}
