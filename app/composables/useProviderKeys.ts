import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const KEY_FIELDS = graphql(`
  fragment ProviderKeyFields on ProviderKeyStatus {
    provider
    configured
    credentialId
    last4
    createdAt
    retiredAt
  }
`)

const KEYS = graphql(
  `
    query ProviderKeys {
      providerKeys(includeRetired: true) {
        ...ProviderKeyFields
      }
    }
  `,
  [KEY_FIELDS]
)

const SET_KEY = graphql(
  `
    mutation SetProviderKey($provider: String!, $apiKey: String!) {
      setProviderKey(input: { provider: $provider, apiKey: $apiKey }) {
        providerKey {
          ...ProviderKeyFields
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
  [KEY_FIELDS]
)

const REMOVE_KEY = graphql(
  `
    mutation RemoveProviderKey($provider: String!) {
      removeProviderKey(input: { provider: $provider }) {
        providerKey {
          ...ProviderKeyFields
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
  [KEY_FIELDS]
)

const LIMIT_FIELDS = graphql(`
  fragment LlmCallLimitFields on LlmCallLimit {
    provider
    dailyRequestLimit
    requestsConsumed
    remainingRequests
    resetsAt
  }
`)

const LIMITS = graphql(
  `
    query LlmCallLimits {
      llmCallLimits {
        ...LlmCallLimitFields
      }
    }
  `,
  [LIMIT_FIELDS]
)

const SET_LIMIT = graphql(
  `
    mutation SetLlmCallLimit($provider: String!, $dailyRequestLimit: Int) {
      setLlmCallLimit(input: { provider: $provider, dailyRequestLimit: $dailyRequestLimit }) {
        limit {
          ...LlmCallLimitFields
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
  [LIMIT_FIELDS]
)

export type ProviderKey = ResultOf<typeof KEY_FIELDS>
export type LlmCallLimit = ResultOf<typeof LIMIT_FIELDS>

// Owner only: the caller renders nothing that uses this for a Guest. The key itself is only ever
// a mutation variable; nothing here keeps it.
export const useProviderKeys = () => {
  // Retired keys come too: usage history names the key a past request ran on.
  const { data, status, error, refresh } = useAsyncData('provider-keys', () => gql(KEYS), {
    server: false
  })
  const llm = useLlmModels()
  const limits = useLlmCallLimits(false)
  // A key changes which models the account has and which providers can be limited. The usage
  // numbers follow the default model, which may have run on the key. Setting a key retires the
  // previous one, so the list is fetched again rather than patched.
  const refreshAfterKeyChange = () =>
    Promise.all([
      refresh(),
      llm.refresh(),
      limits.refresh(),
      refreshNuxtData('dashboard-llm-usage')
    ])
  const all = computed(() => data.value?.providerKeys ?? [])
  // One row per provider: its live key, or the "not connected" placeholder.
  const keys = computed(() =>
    all.value
      .filter((k) => !k.retiredAt)
      .sort((a, b) => providerLabel(a.provider).localeCompare(providerLabel(b.provider)))
  )
  const keyFor = (credentialId: string) => all.value.find((k) => k.credentialId === credentialId)

  // Returns the API's message for the modal to show, or nothing when saved.
  const saving = ref(false)
  const setKey = async (provider: string, apiKey: string) => {
    saving.value = true
    try {
      const { setProviderKey: payload } = await gql(SET_KEY, { provider, apiKey })
      if (payload.errors?.length) return payload.errors[0]!.message
      await refreshAfterKeyChange()
    } catch {
      return ERROR_MESSAGES.generic
    } finally {
      saving.value = false
    }
  }

  const { run, loading: removing } = useMutation()
  const removeKey = (provider: string) =>
    run(async () => {
      const { removeProviderKey: payload } = await gql(REMOVE_KEY, { provider })
      if (payload.providerKey) await refreshAfterKeyChange()
      return payload.errors
    })

  return { keys, keyFor, status, error, refresh, saving, setKey, removing, removeKey }
}

// Shared key: Settings lists the limits and the AI cost notice shows what is left. getCachedData
// reuses a loaded list, so opening a modal with the notice doesn't ask again; refresh() does.
export const useLlmCallLimits = (immediate = true) => {
  const { data, status, error, refresh, execute } = useAsyncData(
    'llm-call-limits',
    () => gql(LIMITS),
    {
      server: false,
      immediate,
      dedupe: 'defer',
      getCachedData: (key, nuxtApp, { cause }) =>
        cause === 'refresh:manual' ? undefined : nuxtApp.payload.data[key]
    }
  )
  const limits = computed(() => data.value?.llmCallLimits ?? [])

  const saving = ref(false)
  const setLimit = async (provider: string, dailyRequestLimit: number | null) => {
    saving.value = true
    try {
      const { setLlmCallLimit: payload } = await gql(SET_LIMIT, { provider, dailyRequestLimit })
      if (payload.errors?.length) return payload.errors[0]!.message
      const limit = payload.limit
      if (limit && data.value)
        data.value = {
          llmCallLimits: data.value.llmCallLimits.map((l) =>
            l.provider === limit.provider ? limit : l
          )
        }
    } catch {
      return ERROR_MESSAGES.generic
    } finally {
      saving.value = false
    }
  }

  return { limits, status, error, refresh, execute, saving, setLimit }
}
