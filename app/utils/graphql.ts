import { parse, print } from '@0no-co/graphql.web'
import { initGraphQLTada } from 'gql.tada'
import type { TadaDocumentNode } from 'gql.tada'
import type { introspection } from '../graphql-env.d.ts'

// Types come from app/graphql-env.d.ts; run `pnpm gql:gen` after the API schema changes.
// Masking is off so a fragment's fields read like the query's own, without readFragment().
export const graphql = initGraphQLTada<{
  introspection: introspection
  scalars: {
    DateTime: string
    // Hot Chocolate sends decimals as JSON numbers; only cost estimates use them.
    Decimal: number
    LocalDate: string
    Long: number
    Upload: File
    UUID: string
  }
  disableMasking: true
}>()

// For batches built at runtime (one alias per item): gql.tada can only type literal documents,
// so the caller names the type of each aliased result.
export const batchDocument = <Item>(source: string) =>
  parse(source) as TadaDocumentNode<Record<string, Item>, Record<string, unknown>>

interface GraphQLResponse<T> {
  data?: T | null
  errors?: { message: string }[]
}

// A handful of documents doesn't justify a GraphQL client package.
export const gql = async <Result, Variables>(
  document: TadaDocumentNode<Result, Variables>,
  variables?: Variables
): Promise<Result> => {
  const res = await $fetch<GraphQLResponse<Result>>('/graphql', {
    method: 'POST',
    body: { query: print(document), variables }
  })
  if (res.errors?.length || !res.data) {
    throw new Error(res.errors?.[0]?.message ?? 'GraphQL response has no data')
  }
  return res.data
}
