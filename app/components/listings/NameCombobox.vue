<script setup lang="ts">
import type { NameLookup as Lookup } from '~/composables/useNewNames'

// countryCode is only for `locations`: cities are suggested within the picked country.
const props = defineProps<{
  lookup: Lookup
  placeholder?: string
  countryCode?: string
  // Optional fields (the industry on the company edit page) need a way back to empty.
  clear?: boolean
  disabled?: boolean
}>()
const model = defineModel<string>()

const PAGE_SIZE = 20

// Only names: createListing takes names and creates any it doesn't know. A null $q lists all.
// The root field is aliased to `result` so every lookup reads the same. gql.tada only types
// literal documents, so the page size is written out rather than interpolated.
const QUERIES = {
  companies: graphql(`
    query CompanySearch($q: String) {
      result: companies(search: $q, first: 20, order: { name: ASC }) {
        nodes {
          name
        }
      }
    }
  `),
  jobRoles: graphql(`
    query JobRoleSearch($q: String) {
      result: jobRoles(search: $q, first: 20, order: { name: ASC }) {
        nodes {
          name
        }
      }
    }
  `),
  industries: graphql(`
    query IndustrySearch($q: String) {
      result: industries(search: $q, first: 20, order: { name: ASC }) {
        nodes {
          name
        }
      }
    }
  `),
  skills: graphql(`
    query SkillSearch($q: String) {
      result: skills(search: $q, first: 20, order: { name: ASC }) {
        nodes {
          name
        }
      }
    }
  `),
  // Country-only locations have no city, so they're not city suggestions.
  locations: graphql(`
    query CitySearch($q: String, $country: String!) {
      result: locations(
        search: $q
        first: 20
        where: { countryCode: { eq: $country }, city: { neq: null } }
        order: { city: ASC }
      ) {
        nodes {
          name: city
        }
      }
    }
  `)
}

const searchTerm = ref('')
// The search box can hold the current value before anything is typed. That isn't a search, so
// the menu lists everything, like a select would.
const query = computed(() => (searchTerm.value === model.value ? '' : searchTerm.value))
const items = ref<string[]>([])
// The current value may not be in the fetched page, or not fetched yet; without it in the list the
// menu offers "Create <value>" for a name that exists.
const menuItems = computed(() => {
  const value = model.value
  const term = query.value.trim().toLowerCase()
  const listed = items.value.some((i) => i.toLowerCase() === value?.toLowerCase())
  return value && !listed && value.toLowerCase().includes(term)
    ? [value, ...items.value]
    : items.value
})
const loading = ref(false)
const open = ref(false)
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false
  }
)
const createdName = ref<string>()
const isNewName = useIsNewName()
// The name only exists once the listing is saved, so say so; otherwise it looks like an existing match.
const isNew = computed(
  () =>
    !!model.value &&
    (model.value === createdName.value || isNewName(props.lookup, model.value, props.countryCode))
)
// The create item doesn't close the menu on its own; picking it should feel like picking any item.
const onCreate = (name: string) => {
  model.value = name
  createdName.value = name
  open.value = false
}

// Names fetched so far, shared by every combobox and kept across page visits so typing filters
// locally. `complete` means the unfiltered fetch got every name, so the API has nothing more.
// add.vue clears it after a save, since the save may have created names.
const cache = useState<Record<string, { names: string[]; complete: boolean }>>(
  'name-lookups',
  () => ({})
)
const cacheKey = computed(() => `${props.lookup}:${props.countryCode ?? ''}`)

// Closing the menu clears the search term; that must not trigger a fetch.
watch(
  query,
  useDebounce((q: string) => open.value && search(q), 200)
)

watch(open, (isOpen) => {
  if (isOpen) search(query.value)
})

const search = async (q: string) => {
  const term = q.trim().toLowerCase()
  const cached = cache.value[cacheKey.value]
  if (cached) {
    const local = cached.names.filter((n) => n.toLowerCase().includes(term))
    // Local hits can miss names the first page didn't include; accepted to save a request.
    if (local.length || cached.complete) {
      items.value = local
      return
    }
  }

  loading.value = true
  try {
    const searchQ = term || null
    const { result } =
      props.lookup === 'locations'
        ? // A locations combobox always gets the row's country.
          await gql(QUERIES.locations, { q: searchQ, country: props.countryCode! })
        : await gql(QUERIES[props.lookup], { q: searchQ })
    // `city` is nullable in the schema, but the query filters out null cities.
    const names = result?.nodes?.map((n) => n.name!) ?? []
    cache.value[cacheKey.value] = {
      names: [...new Set([...(cached?.names ?? []), ...names])].sort((a, b) => a.localeCompare(b)),
      complete: cached?.complete || (!term && names.length < PAGE_SIZE)
    }
    // A slower, older response must not overwrite results for what's typed now.
    if (q === query.value) items.value = names
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <UInputMenu
      v-model="model"
      v-model:search-term="searchTerm"
      v-model:open="open"
      :items="menuItems"
      :loading="loading"
      :placeholder="placeholder"
      :clear="clear"
      :disabled="disabled"
      ignore-filter
      open-on-focus
      :create-item="{ position: 'top', when: 'always' }"
      class="w-full"
      @create="onCreate"
    />
    <p v-if="isNew" class="mt-1 text-xs text-muted" data-testid="name-combobox-new-hint">
      New, will be created when you save.
    </p>
  </div>
</template>
