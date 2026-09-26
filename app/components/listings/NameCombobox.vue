<script setup lang="ts">
type Lookup = 'companies' | 'jobRoles' | 'skills' | 'locations'

// countryCode is only for `locations`: cities are suggested within the picked country.
const props = defineProps<{ lookup: Lookup; placeholder?: string; countryCode?: string }>()
const model = defineModel<string>()

const PAGE_SIZE = 20

// Only names: createListing takes names and creates any it doesn't know. A null $q lists all.
const QUERIES: Record<Lookup, string> = {
  companies: `query CompanySearch($q: String) { companies(search: $q, first: ${PAGE_SIZE}, order: { name: ASC }) { nodes { name } } }`,
  jobRoles: `query JobRoleSearch($q: String) { jobRoles(search: $q, first: ${PAGE_SIZE}, order: { name: ASC }) { nodes { name } } }`,
  skills: `query SkillSearch($q: String) { skills(search: $q, first: ${PAGE_SIZE}, order: { name: ASC }) { nodes { name } } }`,
  // Country-only locations have no city, so they're not city suggestions.
  locations: `query CitySearch($q: String, $country: String!) { locations(search: $q, first: ${PAGE_SIZE}, where: { countryCode: { eq: $country }, city: { neq: null } }, order: { city: ASC }) { nodes { name: city } } }`
}

const searchTerm = ref('')
const items = ref<string[]>([])
const loading = ref(false)
const open = ref(false)
const createdName = ref<string>()
// The name only exists once the listing is saved, so say so; otherwise it looks like an existing match.
const isNew = computed(() => !!model.value && model.value === createdName.value)
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

let timer: ReturnType<typeof setTimeout> | undefined

watch(searchTerm, (q) => {
  clearTimeout(timer)
  // Closing the menu clears the search term; that must not trigger a fetch.
  timer = setTimeout(() => open.value && search(q), 200)
})

watch(open, (isOpen) => {
  if (isOpen && !searchTerm.value) search('')
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
    const data = await gql<Record<Lookup, { nodes: { name: string }[] }>>(QUERIES[props.lookup], {
      q: term || null,
      country: props.countryCode
    })
    const names = data[props.lookup].nodes.map((n) => n.name)
    cache.value[cacheKey.value] = {
      names: [...new Set([...(cached?.names ?? []), ...names])].sort((a, b) => a.localeCompare(b)),
      complete: cached?.complete || (!term && names.length < PAGE_SIZE)
    }
    // A slower, older response must not overwrite results for what's typed now.
    if (q === searchTerm.value) items.value = names
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
      :items="items"
      :loading="loading"
      :placeholder="placeholder"
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
