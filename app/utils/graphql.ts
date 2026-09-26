interface GraphQLResponse<T> {
  data?: T | null
  errors?: { message: string }[]
}

// A handful of hand-written documents doesn't justify a GraphQL client package.
export const gql = async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
  const res = await $fetch<GraphQLResponse<T>>('/graphql', {
    method: 'POST',
    body: { query, variables }
  })
  if (res.errors?.length || !res.data) {
    throw new Error(res.errors?.[0]?.message ?? 'GraphQL response has no data')
  }
  return res.data
}
