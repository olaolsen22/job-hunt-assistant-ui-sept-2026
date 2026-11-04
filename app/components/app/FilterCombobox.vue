<script setup lang="ts" generic="T extends string | number">
import { COUNTRY_OPTIONS } from '~/constants/countries'

// Unlike NameCombobox: several values, only existing ones (no "create"), and locations by id.
// Used by the /listings and /companies filter sheets.
const props = defineProps<{
  lookup: 'skills' | 'locations' | 'industries'
  placeholder?: string
}>()
// T is the value type: skill or industry names (string), or location ids (number).
const model = defineModel<T[]>({ required: true })

interface Item {
  label: string
  value: T
}

const QUERIES = {
  skills: graphql(`
    query SkillFilterSearch($q: String) {
      skills(search: $q, first: 20, order: { name: ASC }) {
        nodes {
          name
        }
      }
    }
  `),
  industries: graphql(`
    query IndustryFilterSearch($q: String) {
      industries(search: $q, first: 20, order: { name: ASC }) {
        nodes {
          name
        }
      }
    }
  `),
  // `search` matches the city, so country-only locations show only before anything is typed.
  locations: graphql(`
    query LocationFilterSearch($q: String) {
      locations(search: $q, first: 20, order: [{ countryCode: ASC }, { city: ASC }]) {
        nodes {
          id
          city
          countryCode
        }
      }
    }
  `)
}

const countryNames = new Map(COUNTRY_OPTIONS.map((option) => [option.value, option.label]))

// The lookup decides T, which TypeScript can't link to the prop, hence the casts.
const fetchItems = async (q: string | null): Promise<Item[]> => {
  if (props.lookup === 'skills') {
    const { skills } = await gql(QUERIES.skills, { q })
    return skills?.nodes?.map((n) => ({ label: n.name, value: n.name as T })) ?? []
  }
  if (props.lookup === 'industries') {
    const { industries } = await gql(QUERIES.industries, { q })
    return industries?.nodes?.map((n) => ({ label: n.name, value: n.name as T })) ?? []
  }
  const { locations } = await gql(QUERIES.locations, { q })
  return (
    locations?.nodes?.map((n) => {
      const country = countryNames.get(n.countryCode) ?? n.countryCode
      return { label: n.city ? `${n.city}, ${country}` : country, value: n.id as T }
    }) ?? []
  )
}

const searchTerm = ref('')
const open = ref(false)
const loading = ref(false)
const results = shallowRef<Item[]>([])
// Selected values can drop out of the current results; their labels are kept so the tags still read.
// After a remount (reopening the filter sheet, a deep link) the map is empty, so a value shows as
// itself until the first search brings its label back; a location shows its id until then.
const selected = new Map<T, Item>()
const items = computed(() => {
  const extra = model.value
    .filter((v) => !results.value.some((r) => r.value === v))
    .map((v) => selected.get(v) ?? { label: String(v), value: v })
  return [...extra, ...results.value]
})
watch(results, (list) => list.forEach((i) => selected.set(i.value, i)))

const search = async (q: string) => {
  loading.value = true
  try {
    const list = await fetchItems(q.trim() || null)
    // A slower, older response must not overwrite results for what's typed now.
    if (q === searchTerm.value) results.value = list
  } finally {
    loading.value = false
  }
}

// Closing the menu clears the search term; that must not trigger a fetch.
watch(
  searchTerm,
  useDebounce((q: string) => open.value && search(q), 200)
)
watch(open, (isOpen) => {
  if (isOpen) search(searchTerm.value)
})
</script>

<template>
  <!-- UInputMenu's model typing can't resolve an open generic T, so the binding widens it. -->
  <UInputMenu
    v-model:search-term="searchTerm"
    v-model:open="open"
    :model-value="model as (string | number)[]"
    :items="items as { label: string; value: string | number }[]"
    value-key="value"
    multiple
    :loading="loading"
    :placeholder="placeholder"
    ignore-filter
    open-on-focus
    class="w-full"
    @update:model-value="(v) => (model = v as T[])"
  />
</template>
