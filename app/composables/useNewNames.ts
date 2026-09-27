import type { InjectionKey } from 'vue'

export type NameLookup = 'companies' | 'jobRoles' | 'skills' | 'locations'

type IsNewName = (lookup: NameLookup, name: string, countryCode?: string) => boolean
type ListingFormState = ReturnType<typeof useListingForm>['state']

const IS_NEW_NAME: InjectionKey<IsNewName> = Symbol('isNewName')
const HITS = 10

const keyOf = (lookup: NameLookup, name: string, countryCode = '') =>
  `${lookup}:${countryCode}:${name.toLowerCase()}`

// A parsed draft can bring names the API doesn't know yet. The add page checks them and provides
// the result, so fields deep inside ListingsForm can flag them without props through every level.
export const provideNewNames = () => {
  const newKeys = ref(new Set<string>())
  provide(IS_NEW_NAME, (lookup, name, countryCode) =>
    newKeys.value.has(keyOf(lookup, name, countryCode))
  )

  const checkNewNames = async (state: ListingFormState) => {
    newKeys.value = new Set()
    const all: { lookup: NameLookup; name: string; countryCode?: string }[] = [
      { lookup: 'companies', name: state.companyName ?? '' },
      { lookup: 'jobRoles', name: state.jobRoleName ?? '' },
      ...state.skills.map((s) => ({ lookup: 'skills' as const, name: s.name })),
      ...state.locations.map((l) => ({
        lookup: 'locations' as const,
        name: l.city,
        countryCode: l.countryCode
      }))
    ]
    const names = all.filter((n) => n.name)
    if (!names.length) return

    // One aliased query instead of a request per name. `search` is a contains-match, so look for
    // the name among the hits, case-insensitively like the API's find-or-create.
    const params = names.map((n, i) =>
      n.countryCode ? `$n${i}: String, $c${i}: String!` : `$n${i}: String`
    )
    const fields = names.map((n, i) =>
      n.countryCode
        ? `n${i}: locations(search: $n${i}, first: ${HITS}, where: { countryCode: { eq: $c${i} } }) { nodes { name: city } }`
        : `n${i}: ${n.lookup}(search: $n${i}, first: ${HITS}) { nodes { name } }`
    )
    const variables = Object.fromEntries(
      names.flatMap((n, i) => [
        [`n${i}`, n.name],
        [`c${i}`, n.countryCode]
      ])
    )
    try {
      const data = await gql(
        batchDocument<{ nodes: { name: string | null }[] | null } | null>(
          `query NewNameCheck(${params.join(', ')}) { ${fields.join(' ')} }`
        ),
        variables
      )
      newKeys.value = new Set(
        names
          .filter(
            (n, i) =>
              !data[`n${i}`]?.nodes?.some((x) => x.name?.toLowerCase() === n.name.toLowerCase())
          )
          .map((n) => keyOf(n.lookup, n.name, n.countryCode))
      )
    } catch {
      // The badges are only a hint; saving works the same without them.
    }
  }

  return { checkNewNames }
}

// Without a provider (e.g. the edit page) nothing is flagged.
export const useIsNewName = () => inject(IS_NEW_NAME, () => false)
