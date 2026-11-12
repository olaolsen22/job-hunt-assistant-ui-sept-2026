import { readFileSync } from 'node:fs'
import type { DocumentNode, SelectionSetNode, ValueNode } from '@0no-co/graphql.web'

// The listings and companies queries are assembled as text at runtime, so gql.tada can't check
// them. This checks their `where`/`order` arguments against the API's input types instead, read
// from the introspection `pnpm gql:gen` writes to app/graphql-env.d.ts, so it follows the schema.
const introspection = readFileSync('app/graphql-env.d.ts', 'utf8')

// input type -> field -> the field's named type (list/non-null wrappers dropped)
const inputTypes = new Map<string, Map<string, string>>()
for (const [, typeName, body] of introspection.matchAll(
  /'(\w+)': \{ kind: 'INPUT_OBJECT'; name: '\w+'; isOneOf: \w+; inputFields: \[(.*?)\]; \};/g
)) {
  const fields = new Map<string, string>()
  for (const [, field, type] of body!.matchAll(/\{ name: '(\w+)'; type: (.*?); defaultValue:/g))
    fields.set(field!, [...type!.matchAll(/name: '(\w+)'/g)].at(-1)![1]!)
  inputTypes.set(typeName!, fields)
}

export const inputFieldsOf = (typeName: string) => {
  const fields = inputTypes.get(typeName)
  if (!fields) throw new Error(`${typeName} is not an input type in app/graphql-env.d.ts`)
  return fields
}

// Hot Chocolate turns down a null comparison on an Int filter (`jobRoleId: { neq: null }`) with
// HC0026 at runtime, though the schema types `neq` as nullable Int. Timestamp, string and enum
// filters accept null.
const NULL_REJECTING_FILTERS = new Set(['IntOperationFilterInput'])

const checkValue = (value: ValueNode, typeName: string, path: string, problems: string[]) => {
  if (value.kind === 'ListValue') {
    for (const item of value.values) checkValue(item, typeName, path, problems)
    return
  }
  if (value.kind !== 'ObjectValue') return
  const fields = inputFieldsOf(typeName)
  for (const field of value.fields) {
    const at = `${path}.${field.name.value}`
    const fieldType = fields.get(field.name.value)
    if (!fieldType) problems.push(`${at}: no such field on ${typeName}`)
    else if (field.value.kind === 'NullValue' && NULL_REJECTING_FILTERS.has(typeName))
      problems.push(`${at}: the API rejects null on ${typeName} (HC0026)`)
    else checkValue(field.value, fieldType, at, problems)
  }
}

/**
 * Problems the API would reject in every inline `where` and `order` argument of `rootField`
 * (also under aliases). Variables aren't checked here; pass their values to `inputValueProblems`.
 */
export const argumentProblems = (
  document: DocumentNode,
  rootField: string,
  types: { where: string; order?: string }
) => {
  const problems: string[] = []
  const visit = (selectionSet: SelectionSetNode) => {
    for (const selection of selectionSet.selections) {
      if (selection.kind !== 'Field') continue
      if (selection.name.value === rootField)
        for (const arg of selection.arguments ?? []) {
          const typeName = types[arg.name.value as keyof typeof types]
          const label = `${selection.alias?.value ?? rootField}(${arg.name.value})`
          if (typeName) checkValue(arg.value, typeName, label, problems)
        }
      if (selection.selectionSet) visit(selection.selectionSet)
    }
  }
  for (const definition of document.definitions)
    if (definition.kind === 'OperationDefinition') visit(definition.selectionSet)
  return problems
}

/** Field names in a variable's value (e.g. `[{ postedOn: 'ASC' }]`) that `typeName` lacks. */
export const inputValueProblems = (value: unknown, typeName: string, path = 'value'): string[] => {
  if (Array.isArray(value))
    return value.flatMap((item, i) => inputValueProblems(item, typeName, `${path}[${i}]`))
  if (!value || typeof value !== 'object') return []
  const fields = inputFieldsOf(typeName)
  return Object.entries(value).flatMap(([key, inner]) => {
    const fieldType = fields.get(key)
    return fieldType
      ? inputValueProblems(inner, fieldType, `${path}.${key}`)
      : [`${path}.${key}: no such field on ${typeName}`]
  })
}
