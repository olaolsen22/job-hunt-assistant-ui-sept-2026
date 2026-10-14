<script setup lang="ts">
import { COUNTRY_OPTIONS } from '~/constants/countries'

// Country plus optional city, both optional together: no country means no location.
// Changing the country resets the city, which only makes sense within one country.
const countryCode = defineModel<string>('countryCode')
const city = defineModel<string>('city')

const onCountryChange = () => {
  city.value = undefined
}
</script>

<template>
  <!-- Sized by its container, not the viewport, so it also stacks in a half-width compare column. -->
  <div class="@container">
    <div class="grid gap-4 @md:grid-cols-2">
      <UFormField label="Country">
        <USelectMenu
          v-model="countryCode"
          :items="COUNTRY_OPTIONS"
          value-key="value"
          clear
          placeholder="No location"
          class="w-full"
          data-testid="location-country"
          @update:model-value="onCountryChange"
        />
      </UFormField>
      <UFormField label="City">
        <ListingsNameCombobox
          v-if="countryCode"
          v-model="city"
          lookup="locations"
          :country-code="countryCode"
          placeholder="City (optional)"
          clear
        />
        <UInput v-else disabled placeholder="Pick a country first" class="w-full" />
      </UFormField>
    </div>
  </div>
</template>
