<script setup lang="ts">
type Lookup = 'companies' | 'jobRoles' | 'skills' | 'locations'

// countryCode is only for `locations`: cities are suggested within the picked country.
const props = defineProps<{ lookup: Lookup; placeholder?: string; countryCode?: string }>()
const model = defineModel<string>()

// Only names: createListing takes names and creates any it doesn't know. A null $q lists all.
const QUERIES: Record<Lookup, string> = {
  companies:
    'query CompanySearch($q: String) { companies(search: $q, first: 20, order: { name: ASC }) { nodes { name } } }',
  jobRoles:
    'query JobRoleSearch($q: String) { jobRoles(search: $q, first: 20, order: { name: ASC }) { nodes { name } } }',
  skills:
    'query SkillSearch($q: String) { skills(search: $q, first: 20, order: { name: ASC }) { nodes { name } } }',
  // Country-only locations have no city, so they're not city suggestions.
  locations:
    'query CitySearch($q: String, $country: String!) { locations(search: $q, first: 20, where: { countryCode: { eq: $country }, city: { neq: null } }, order: { city: ASC }) { nodes { name: city } } }'
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

let timer: ReturnType<typeof setTimeout> | undefined

watch(searchTerm, (q) => {
  clearTimeout(timer)
  // Closing the menu clears the search term; that must not trigger a fetch.
  timer = setTimeout(() => open.value && search(q), 200)
})

// Refetch on every open so the list is never stale (e.g. after the row's country changed).
watch(open, (isOpen) => {
  if (isOpen && !searchTerm.value) search('')
})

const search = async (q: string) => {
  loading.value = true
  try {
    const data = await gql<Record<Lookup, { nodes: { name: string }[] }>>(QUERIES[props.lookup], {
      q: q.trim() || null,
      country: props.countryCode
    })
    // A slower, older response must not overwrite results for what's typed now.
    if (q === searchTerm.value) items.value = data[props.lookup].nodes.map((n) => n.name)
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
