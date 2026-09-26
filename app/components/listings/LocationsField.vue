<script setup lang="ts">
import { COUNTRY_OPTIONS } from '~/constants/countries'
import type { ListingLocation } from '~/composables/useListingForm'

const locations = defineModel<ListingLocation[]>({ required: true })

const addLocation = () => locations.value.push({ countryCode: 'NO', city: '' })
</script>

<template>
  <!-- Stacked rows look alike on phones, so more space between them than inside them -->
  <div class="space-y-4 sm:space-y-2">
    <div
      v-for="(loc, i) in locations"
      :key="i"
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
      data-testid="location-row"
    >
      <USelectMenu
        v-model="loc.countryCode"
        :items="COUNTRY_OPTIONS"
        value-key="value"
        class="w-full sm:flex-1"
      />
      <div class="flex items-center gap-2 sm:flex-1 sm:gap-3">
        <ListingsNameCombobox
          v-model="loc.city"
          lookup="locations"
          :country-code="loc.countryCode"
          placeholder="City (empty = anywhere)"
          class="flex-1"
        />
        <UButton
          v-if="locations.length > 1"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="shrink-0"
          @click="locations.splice(i, 1)"
        />
      </div>
    </div>
    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      class="w-full justify-center sm:w-auto"
      @click="addLocation"
    >
      Add location
    </UButton>
  </div>
</template>
