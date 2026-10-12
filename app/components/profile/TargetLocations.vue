<script setup lang="ts">
import { COUNTRY_OPTIONS } from '~/constants/countries'
import type { ProfileData } from '~/composables/useProfile'

// Target locations in the Preferences form. Each add or remove saves right away, apart from the
// form's Save, since they are locations flagged as targets rather than profile fields.
const { locations } = defineProps<{ locations: ProfileData['targetLocations'] }>()
const emit = defineEmits<{ changed: [] }>()

const SAVE_LOCATION = graphql(`
  mutation SaveLocation($input: SaveLocationInput!) {
    saveLocation(input: $input) {
      location {
        id
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

type Target = ProfileData['targetLocations'][number]

const newCountry = ref<string>()
const newCity = ref<string>()
const removing = ref<Target | null>(null)
const removeOpen = computed({
  get: () => !!removing.value,
  set: (value) => {
    if (!value) removing.value = null
  }
})

const { run, loading } = useMutation(() => emit('changed'))

const setTarget = async (
  location: { countryCode: string; city?: string | null },
  isTarget: boolean
) => {
  const ok = await run(async () => {
    const { saveLocation } = await gql(SAVE_LOCATION, {
      input: { countryCode: location.countryCode, city: location.city || null, isTarget }
    })
    return saveLocation.errors
  })
  return ok
}

const add = async () => {
  if (!(await setTarget({ countryCode: newCountry.value!, city: newCity.value }, true))) return
  // Adding can create a city name.
  clearNuxtState('name-lookups')
  newCountry.value = undefined
  newCity.value = undefined
  emit('changed')
}

const remove = async () => {
  const ok = await setTarget(removing.value!, false)
  removing.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <div class="space-y-2" data-testid="profile-target-locations">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-medium text-highlighted">Target locations</h3>
      <span class="text-xs text-muted">Saves immediately</span>
    </div>
    <ul v-if="locations.length" class="space-y-1">
      <li
        v-for="l in locations"
        :key="l.id"
        class="flex items-center gap-2"
        data-testid="profile-target-location"
      >
        <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
        <span class="min-w-0 flex-1 truncate">{{ formatLocation(l) }}</span>
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Remove ${formatLocation(l)}`"
          :disabled="loading"
          @click="removing = l"
        />
      </li>
    </ul>
    <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <USelectMenu
        v-model="newCountry"
        :items="COUNTRY_OPTIONS"
        value-key="value"
        placeholder="Country"
        aria-label="Country"
        class="w-full"
        data-testid="profile-target-country"
        @update:model-value="newCity = undefined"
      />
      <ListingsNameCombobox
        v-if="newCountry"
        v-model="newCity"
        lookup="locations"
        :country-code="newCountry"
        placeholder="City (blank = whole country)"
      />
      <UInput v-else disabled placeholder="Pick a country first" class="w-full" />
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        :disabled="!newCountry"
        :loading="loading"
        data-testid="profile-target-add"
        @click="add"
        >Add</UButton
      >
    </div>

    <AppConfirmModal
      v-model:open="removeOpen"
      title="Remove this target location?"
      :description="removing ? formatLocation(removing) : undefined"
      confirm-label="Remove"
      :loading="loading"
      @confirm="remove"
    />
  </div>
</template>
