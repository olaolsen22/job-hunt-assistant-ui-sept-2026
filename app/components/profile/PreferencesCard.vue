<script setup lang="ts">
import { COUNTRY_OPTIONS } from '~/constants/countries'
import { EMPLOYMENT_TYPE_OPTIONS, WORK_MODE_OPTIONS } from '~/constants/listing'
import type { ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

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

const open = ref(false)

const labelOf = (options: readonly { label: string; value: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value

const rows = computed(() => {
  const salary = profile.minSalary
    ? `${profile.minSalary.toLocaleString('nb-NO')} ${profile.salaryCurrency ?? ''}`.trim()
    : null
  const notice = profile.noticePeriodMonths
  return [
    { label: 'Job roles', value: profile.jobRoles.map((r) => r.name).join(', ') },
    {
      label: 'Work modes',
      value: profile.workModes.map((m) => labelOf(WORK_MODE_OPTIONS, m)).join(', ')
    },
    {
      label: 'Employment types',
      value: profile.employmentTypes.map((t) => labelOf(EMPLOYMENT_TYPE_OPTIONS, t)).join(', ')
    },
    { label: 'Minimum salary', value: salary },
    {
      label: 'Notice period',
      value: notice === null ? null : notice === 1 ? '1 month' : `${notice} months`
    }
  ].filter((row) => row.value)
})

const empty = computed(() => !rows.value.length && !profile.targetLocations.length)

const newCountry = ref<string>()
const newCity = ref<string>()

const onCountryChange = () => {
  newCity.value = undefined
}

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
  if (!ok) return
  // Adding can create a city name.
  clearNuxtState('name-lookups')
  newCountry.value = undefined
  newCity.value = undefined
  emit('changed')
}
</script>

<template>
  <ProfileSection
    title="Preferences"
    icon="i-lucide-sliders-horizontal"
    testid="profile-preferences"
    :empty="empty"
    empty-message="No preferences yet."
    add-label="Set preferences"
    @add="open = true"
  >
    <template v-if="!empty" #actions>
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Edit preferences"
        data-testid="profile-preferences-edit"
        @click="open = true"
      />
    </template>

    <dl v-if="rows.length" class="space-y-3" data-testid="profile-preferences-rows">
      <div v-for="row in rows" :key="row.label">
        <dt class="text-sm text-muted">{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <div class="space-y-2" :class="{ 'mt-4 border-t border-default pt-4': rows.length }">
      <h3 class="text-sm text-muted">Target locations</h3>
      <ul v-if="profile.targetLocations.length" class="space-y-1">
        <li
          v-for="l in profile.targetLocations"
          :key="l.id"
          class="flex items-center gap-2"
          data-testid="profile-target-location"
        >
          <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate">{{ formatLocation(l) }}</span>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Remove ${formatLocation(l)}`"
            :disabled="loading"
            @click="setTarget(l, false)"
          />
        </li>
      </ul>
      <div class="space-y-2">
        <USelectMenu
          v-model="newCountry"
          :items="COUNTRY_OPTIONS"
          value-key="value"
          placeholder="Country"
          class="w-full"
          data-testid="profile-target-country"
          @update:model-value="onCountryChange"
        />
        <ListingsNameCombobox
          v-if="newCountry"
          v-model="newCity"
          lookup="locations"
          :country-code="newCountry"
          placeholder="City (blank = whole country)"
        />
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          :disabled="!newCountry"
          :loading="loading"
          data-testid="profile-target-add"
          @click="setTarget({ countryCode: newCountry!, city: newCity }, true)"
          >Add location</UButton
        >
      </div>
    </div>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfilePreferencesModal
    v-model:open="open"
    :profile="profile"
    @saved="emit('saved', $event)"
    @changed="emit('changed')"
  />
</template>
